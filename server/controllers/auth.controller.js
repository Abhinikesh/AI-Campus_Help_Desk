const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');

// ── Helpers ─────────────────────────────────────────────────────────────────

const ROLE_REDIRECTS = {
  student:   '/student/dashboard',
  faculty:   '/faculty/dashboard',
  parent:    '/parent/dashboard',
  admission: '/admission/dashboard',
  admin:     '/admin/dashboard',
};

const generateToken = (user) => {
  return jwt.sign(
    { userId: user._id, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

const setCookieToken = (res, token) => {
  res.cookie('campus_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  });
};

// ── REGISTER ────────────────────────────────────────────────────────────────

const register = async (req, res) => {
  try {
    const { name, email, password, role, rollNumber } = req.body;

    // ── Basic validation ──
    if (!name || !email || !password || !role) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }

    if (!ROLE_REDIRECTS[role]) {
      return res.status(400).json({ success: false, message: 'Invalid role provided' });
    }

    // ── Student-specific validation ──
    if (role === 'student') {
      if (!rollNumber || !/^\d{8}$/.test(rollNumber)) {
        return res.status(400).json({ success: false, message: 'Students must have a valid 8-digit roll number' });
      }
      const rollExists = await User.findOne({ rollNumber });
      if (rollExists) {
        return res.status(400).json({ success: false, message: 'Roll number already registered' });
      }
    }

    // ── Check duplicate email ──
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    // ── Hash password ──
    const hashedPassword = await bcrypt.hash(password, 10);

    // ── Create User ──
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
      rollNumber: role === 'student' ? rollNumber : null,
    });
    console.log(`✅ User registered: ${email} [${role}]`);

    // ── Create linked profile ──
    if (role === 'student') {
      await Student.create({ userId: user._id, rollNumber });
      console.log(`✅ Student profile created for userId: ${user._id}`);
    }

    if (role === 'faculty') {
      await Faculty.create({ userId: user._id });
      console.log(`✅ Faculty profile created for userId: ${user._id}`);
    }

    return res.status(201).json({ success: true, message: 'Registration successful. You can now log in.' });
  } catch (error) {
    console.error('❌ Register error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error during registration' });
  }
};

// ── LOGIN ────────────────────────────────────────────────────────────────────

const login = async (req, res) => {
  try {
    const { identifier, password, role } = req.body;

    if (!identifier || !password || !role) {
      return res.status(400).json({ success: false, error: 'Identifier, password, and role are required' });
    }

    let user;

    if (role === 'student') {
      // Student logs in with roll number
      const studentProfile = await Student.findOne({ 
        rollNumber: identifier 
      }).populate('userId');
      
      if (!studentProfile || !studentProfile.userId) {
        return res.status(401).json({ 
          success: false, 
          error: 'Invalid roll number or password' 
        });
      }
      user = studentProfile.userId;
    } else {
      // All other roles login with email
      user = await User.findOne({ email: identifier, role });
    }

    if (!user) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid credentials' 
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid credentials' 
      });
    }

    // Check if user is active
    if (user.isActive === false) {
      return res.status(403).json({ success: false, error: 'Your account has been deactivated' });
    }

    const token = generateToken(user);
    setCookieToken(res, token);
    
    console.log(`✅ User logged in: ${identifier} [${role}]`);

    res.json({
      success: true,
      role: user.role,
      name: user.name,
      redirectTo: ROLE_REDIRECTS[user.role]
    });

  } catch (error) {
    console.error('❌ Login error:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Server error' 
    });
  }
};

// ── LOGOUT ───────────────────────────────────────────────────────────────────

const logout = async (req, res) => {
  try {
    res.clearCookie('campus_token', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
    console.log('✅ User logged out, cookie cleared');
    return res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('❌ Logout error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error during logout' });
  }
};

// ── GET ME ────────────────────────────────────────────────────────────────────

const getMe = async (req, res) => {
  try {
    // req.user is set by auth middleware
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    console.log(`✅ getMe success for userId: ${req.user.userId}`);
    return res.status(200).json({
      success: true,
      user: {
        name:       user.name,
        email:      user.email,
        role:       user.role,
        rollNumber: user.rollNumber,
      },
    });
  } catch (error) {
    console.error('❌ getMe error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error fetching user' });
  }
};

// ── ADMISSION LOGIN (GUEST) ────────────────────────────────────────────────
// Allows new admission users to get a session to use the AI Help Desk
const admissionLogin = async (req, res) => {
  try {
    const { name, phone } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ success: false, message: 'Name and phone are required for admission portal' });
    }

    // We don't save these to the User model, just give them a session 'admission' role
    // Create a dummy ID for the session
    const dummyId = `adm_${Date.now()}`;
    const token = jwt.sign(
      { userId: dummyId, role: 'admission', name: name },
      process.env.JWT_SECRET,
      { expiresIn: '2h' } // Short lived session
    );

    setCookieToken(res, token);
    console.log(`✅ Admission guest logged in: ${name}`);

    return res.status(200).json({
      success: true,
      role: 'admission',
      name: name,
      redirectTo: ROLE_REDIRECTS.admission,
    });
  } catch (error) {
    console.error('❌ Admission login error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error during admission login' });
  }
};

module.exports = { register, login, logout, getMe, admissionLogin };
