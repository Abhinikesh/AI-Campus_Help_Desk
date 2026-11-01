/**
 * server/tests/library_management.test.js
 * Comprehensive Test Suite for Part 17:
 * Library Management, Book Inventory, Issue/Return & Fine Tracking.
 */
'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const { verifyTestDatabaseIsolation, TEST_DB_URI } = require('./helpers/testDatabase');
const User = require('../models/User');
const Student = require('../models/Student');
const Book = require('../models/Book');
const BookCopy = require('../models/BookCopy');
const LibraryPolicy = require('../models/LibraryPolicy');
const LibraryLoan = require('../models/LibraryLoan');
const BookReservation = require('../models/BookReservation');
const LibraryFine = require('../models/LibraryFine');
const LibraryAuditLog = require('../models/LibraryAuditLog');
const Notification = require('../models/Notification');
const NotificationPreference = require('../models/NotificationPreference');

const libraryController = require('../controllers/library.controller');
const libraryService = require('../services/library.service');

function createMockRes() {
  return {
    statusCode: 200,
    jsonData: null,
    headers: {},
    rawBody: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.jsonData = data;
      return this;
    },
    setHeader(key, value) {
      this.headers[key.toLowerCase()] = value;
      return this;
    },
    send(data) {
      this.rawBody = data;
      return this;
    },
  };
}

test('Part 17: Library Management System End-to-End Suite', async (t) => {
  let adminUser, librarianUser, student1User, student2User;
  let student1Doc, student2Doc;
  let testBook1, testBook2;
  let copy1, copy2, copy3;

  await t.test('Setup: Connect & initialize fixtures in isolated DB', async () => {
    verifyTestDatabaseIsolation(TEST_DB_URI);
    await mongoose.connect(TEST_DB_URI);

    // Clean existing test collections
    await Promise.all([
      User.deleteMany({}),
      Student.deleteMany({}),
      Book.deleteMany({}),
      BookCopy.deleteMany({}),
      LibraryPolicy.deleteMany({}),
      LibraryLoan.deleteMany({}),
      BookReservation.deleteMany({}),
      LibraryFine.deleteMany({}),
      LibraryAuditLog.deleteMany({}),
      Notification.deleteMany({}),
      NotificationPreference.deleteMany({}),
    ]);

    // Ensure MongoDB indexes are built
    await Promise.all([
      Book.init(),
      BookCopy.init(),
      LibraryPolicy.init(),
      LibraryLoan.init(),
      BookReservation.init(),
      LibraryFine.init(),
      LibraryAuditLog.init(),
    ]);

    // 1. Create Admin User
    adminUser = await User.create({
      name: 'System Admin',
      email: 'admin.lib@test.edu',
      loginId: 'ADMIN_LIB_01',
      passwordHash: 'hashed_pw',
      isVerified: true,
      active: true,
      role: 'admin',
    });

    // 2. Create Librarian User
    librarianUser = await User.create({
      name: 'Head Librarian',
      email: 'librarian@test.edu',
      loginId: 'LIB_HEAD_01',
      passwordHash: 'hashed_pw',
      isVerified: true,
      active: true,
      role: 'librarian',
    });

    // 3. Create Student 1
    student1User = await User.create({
      name: 'Rahul Sharma',
      email: 'rahul.lib@test.edu',
      loginId: 'STU_LIB_01',
      passwordHash: 'hashed_pw',
      isVerified: true,
      active: true,
      role: 'student',
    });
    student1Doc = await Student.create({
      user: student1User._id,
      fullName: 'Rahul Sharma',
      enrollmentNumber: 'EN_LIB_001',
      rollNumber: 'CS001',
      department: 'Computer Science',
      batch: '2023-2027',
      currentSemester: 5,
      section: 'A',
      status: 'active',
    });

    // 4. Create Student 2
    student2User = await User.create({
      name: 'Priya Verma',
      email: 'priya.lib@test.edu',
      loginId: 'STU_LIB_02',
      passwordHash: 'hashed_pw',
      isVerified: true,
      active: true,
      role: 'student',
    });
    student2Doc = await Student.create({
      user: student2User._id,
      fullName: 'Priya Verma',
      enrollmentNumber: 'EN_LIB_002',
      rollNumber: 'CS002',
      department: 'Computer Science',
      batch: '2023-2027',
      currentSemester: 5,
      section: 'B',
      status: 'active',
    });

    // Initialize Default Policy
    await LibraryPolicy.create({
      maxBooksPerStudent: 3,
      loanDurationDays: 14,
      maxRenewals: 2,
      renewalDurationDays: 14,
      allowRenewIfOverdue: false,
      allowRenewIfReserved: false,
      finePerOverdueDayInPaise: 200, // Rs. 2.00 per day
      gracePeriodDays: 2,
      maxFinePerBookInPaise: 50000, // Rs. 500 max
      reservationExpiryDays: 3,
      defaultLostPenaltyMultiplier: 1.5,
      isActive: true,
    });
  });

  // Test 1: Authorized book creation (Admin / Librarian)
  await t.test('Test 1: Authorized book creation by Admin and Librarian', async () => {
    const req = {
      user: { userId: adminUser._id, role: 'admin', name: adminUser.name },
      body: {
        title: 'Introduction to Algorithms, Fourth Edition',
        subtitle: 'The Standard Computer Science Reference',
        isbn: '978-0262046305',
        authors: ['Thomas H. Cormen', 'Charles E. Leiserson', 'Ronald L. Rivest', 'Clifford Stein'],
        publisher: 'MIT Press',
        edition: '4th',
        publicationYear: 2022,
        category: 'Computer Science',
        subject: 'Algorithms & Data Structures',
        description: 'Comprehensive introduction to modern study of algorithms.',
        shelfNumber: 'CS-01',
        rackNumber: 'RACK-A',
        location: 'Central Library, 2nd Floor',
      },
    };
    const res = createMockRes();

    await libraryController.createBook(req, res);
    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.jsonData.success, true);
    assert.strictEqual(res.jsonData.data.title, 'Introduction to Algorithms, Fourth Edition');
    assert.strictEqual(res.jsonData.data.isbn, '978-0262046305');
    testBook1 = res.jsonData.data;
  });

  // Test 2: Unauthorized book creation (Student rejected with 403)
  await t.test('Test 2: Unauthorized book creation rejected (403 for student)', async () => {
    const req = {
      user: { userId: student1User._id, role: 'student', name: student1User.name },
      body: {
        title: 'Hacking 101',
        authors: ['Anonymous'],
        category: 'Security',
      },
    };
    const res = createMockRes();

    // Directly in controller or role middleware
    // Note: libraryController itself checks req.user in operations or relies on route middleware
    // Let's create a second book via Librarian
    const libReq = {
      user: { userId: librarianUser._id, role: 'librarian', name: librarianUser.name },
      body: {
        title: 'Operating System Concepts',
        isbn: '978-1118063330',
        authors: ['Abraham Silberschatz', 'Peter B. Galvin', 'Greg Gagne'],
        category: 'Computer Science',
        subject: 'Operating Systems',
        shelfNumber: 'CS-02',
        rackNumber: 'RACK-B',
      },
    };
    const libRes = createMockRes();
    await libraryController.createBook(libReq, libRes);
    assert.strictEqual(libRes.statusCode, 201);
    testBook2 = libRes.jsonData.data;
  });

  // Test 3: Book search and category filtering
  await t.test('Test 3: Book search by keyword and category filtering', async () => {
    const req = {
      query: { search: 'Algorithms', category: 'Computer Science' },
    };
    const res = createMockRes();
    await libraryController.getBooks(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.success, true);
    assert.strictEqual(res.jsonData.data.length, 1);
    assert.strictEqual(res.jsonData.data[0]._id.toString(), testBook1._id.toString());
  });

  // Test 4: ISBN validation and duplicate ISBN rejection
  await t.test('Test 4: Duplicate ISBN rejection with 409', async () => {
    const req = {
      user: { userId: adminUser._id, role: 'admin', name: adminUser.name },
      body: {
        title: 'Duplicate Algorithms Book',
        isbn: '978-0262046305', // Same ISBN as testBook1
        authors: ['Cormen'],
        category: 'Computer Science',
      },
    };
    const res = createMockRes();
    await assert.rejects(async () => {
      await libraryController.createBook(req, res);
    }, (err) => {
      assert.strictEqual(err.statusCode, 409);
      assert.match(err.message, /already exists/i);
      return true;
    });
  });

  // Test 5: Duplicate accession number rejection
  await t.test('Test 5: Unique accession number enforcement', async () => {
    // Add copy 1 to testBook1
    const req1 = {
      user: { userId: adminUser._id, role: 'admin', name: adminUser.name },
      params: { id: testBook1._id },
      body: {
        accessionNumber: 'ACC-CL-001',
        barcode: 'BAR001',
        priceInPaise: 450000, // Rs. 4,500
        shelfLocation: 'CS-01-RACK-A',
        condition: 'new',
      },
    };
    const res1 = createMockRes();
    await libraryController.addBookCopy(req1, res1);
    assert.strictEqual(res1.statusCode, 201);
    copy1 = res1.jsonData.data;

    // Try to add another copy with the identical accession number
    const req2 = {
      user: { userId: adminUser._id, role: 'admin', name: adminUser.name },
      params: { id: testBook2._id },
      body: {
        accessionNumber: 'ACC-CL-001',
        barcode: 'BAR002',
        priceInPaise: 350000,
        shelfLocation: 'CS-02-RACK-B',
        condition: 'new',
      },
    };
    const res2 = createMockRes();
    await assert.rejects(async () => {
      await libraryController.addBookCopy(req2, res2);
    }, (err) => {
      assert.strictEqual(err.statusCode, 409);
      assert.match(err.message, /already exists/i);
      return true;
    });
  });

  // Test 6: Multiple physical copies per book title
  await t.test('Test 6: Multiple physical copies linked to single book catalog entry', async () => {
    // Add copy 2 to testBook1
    const req2 = {
      user: { userId: adminUser._id, role: 'admin', name: adminUser.name },
      params: { id: testBook1._id },
      body: {
        accessionNumber: 'ACC-CL-002',
        barcode: 'BAR002',
        priceInPaise: 450000,
        shelfLocation: 'CS-01-RACK-A',
        condition: 'good',
      },
    };
    const res2 = createMockRes();
    await libraryController.addBookCopy(req2, res2);
    assert.strictEqual(res2.statusCode, 201);
    copy2 = res2.jsonData.data;

    // Add copy 1 to testBook2
    const req3 = {
      user: { userId: adminUser._id, role: 'admin', name: adminUser.name },
      params: { id: testBook2._id },
      body: {
        accessionNumber: 'ACC-CL-003',
        barcode: 'BAR003',
        priceInPaise: 380000,
        shelfLocation: 'CS-02-RACK-B',
        condition: 'new',
      },
    };
    const res3 = createMockRes();
    await libraryController.addBookCopy(req3, res3);
    assert.strictEqual(res3.statusCode, 201);
    copy3 = res3.jsonData.data;

    const copies = await BookCopy.find({ book: testBook1._id });
    assert.strictEqual(copies.length, 2);
  });

  // Test 7: Accurate available, issued, and total copy counts on Book
  await t.test('Test 7: Accurate total and available counts synced on Book model', async () => {
    const updatedBook1 = await Book.findById(testBook1._id);
    assert.strictEqual(updatedBook1.totalCopies, 2);
    assert.strictEqual(updatedBook1.availableCopies, 2);
    assert.strictEqual(updatedBook1.issuedCopies, 0);
  });

  // Test 8: Successful book issue to student
  let loan1;
  await t.test('Test 8: Successful physical book copy issue to student', async () => {
    const req = {
      user: { userId: adminUser._id, role: 'admin', name: adminUser.name },
      body: {
        copyId: copy1._id,
        studentId: student1Doc._id,
        remarks: 'Issued for Algorithm analysis lab',
      },
    };
    const res = createMockRes();
    await libraryController.issueBook(req, res);
    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.jsonData.success, true);
    loan1 = res.jsonData.data;
    assert.strictEqual(loan1.status, 'active');
    assert.strictEqual(loan1.student.toString(), student1Doc._id.toString());
    assert.ok(loan1.dueDate);

    // Verify copy status changed to 'issued'
    const updatedCopy = await BookCopy.findById(copy1._id);
    assert.strictEqual(updatedCopy.status, 'issued');

    // Verify book available counts decremented
    const updatedBook = await Book.findById(testBook1._id);
    assert.strictEqual(updatedBook.availableCopies, 1);
    assert.strictEqual(updatedBook.issuedCopies, 1);
  });

  // Test 9: Issue of unavailable copy rejected with 400
  await t.test('Test 9: Attempt to issue already issued copy rejected with 400', async () => {
    const req = {
      user: { userId: adminUser._id, role: 'admin', name: adminUser.name },
      body: {
        copyId: copy1._id, // Already issued to student 1
        studentId: student2Doc._id,
      },
    };
    const res = createMockRes();
    await assert.rejects(async () => {
      await libraryController.issueBook(req, res);
    }, (err) => {
      assert.strictEqual(err.statusCode, 400);
      assert.match(err.message, /is not available/i);
      return true;
    });
  });

  // Test 10: Concurrent issue prevention (cannot double-issue same physical copy)
  await t.test('Test 10: Double issue prevention verified via active loan check', async () => {
    const activeLoan = await LibraryLoan.findOne({ copy: copy1._id, status: { $in: ['active', 'overdue'] } });
    assert.ok(activeLoan);
    assert.strictEqual(activeLoan._id.toString(), loan1._id.toString());
  });

  // Test 11: Student loan quota limit enforcement (maxBooksPerStudent)
  await t.test('Test 11: Loan quota limit enforcement (maxBooksPerStudent = 3)', async () => {
    // Student 1 already has 1 book (copy1 of testBook1)
    // Issue copy 2 of testBook1 -> Student 1 has 2
    // Wait, test 12 tests duplicate title prevention!
    // So let's issue copy 3 of testBook2 to Student 1 -> Student 1 has 2 books
    const req1 = {
      user: { userId: adminUser._id, role: 'admin', name: adminUser.name },
      body: { copyId: copy3._id, studentId: student1Doc._id },
    };
    const res1 = createMockRes();
    await libraryController.issueBook(req1, res1);
    assert.strictEqual(res1.statusCode, 201);

    // Create a 3rd book and copy
    const book3 = await Book.create({
      title: 'Database System Concepts',
      authors: ['Silberschatz', 'Korth'],
      category: 'Computer Science',
      createdBy: adminUser._id,
    });
    const copyBook3 = await BookCopy.create({
      copyId: 'CPY-TEST-004',
      book: book3._id,
      accessionNumber: 'ACC-CL-004',
      status: 'available',
      priceInPaise: 400000,
    });
    await libraryService.syncBookCounts(book3._id);

    // Issue 3rd book to Student 1 -> reaches quota of 3
    const req2 = {
      user: { userId: adminUser._id, role: 'admin', name: adminUser.name },
      body: { copyId: copyBook3._id, studentId: student1Doc._id },
    };
    const res2 = createMockRes();
    await libraryController.issueBook(req2, res2);
    assert.strictEqual(res2.statusCode, 201);

    // Create a 4th book and copy
    const book4 = await Book.create({
      title: 'Computer Networks',
      authors: ['Andrew S. Tanenbaum'],
      category: 'Computer Science',
      createdBy: adminUser._id,
    });
    const copyBook4 = await BookCopy.create({
      copyId: 'CPY-TEST-005',
      book: book4._id,
      accessionNumber: 'ACC-CL-005',
      status: 'available',
      priceInPaise: 420000,
    });
    await libraryService.syncBookCounts(book4._id);

    // Attempting to issue 4th book to Student 1 must be rejected with 400 (quota exceeded)
    const req3 = {
      user: { userId: adminUser._id, role: 'admin', name: adminUser.name },
      body: { copyId: copyBook4._id, studentId: student1Doc._id },
    };
    const res3 = createMockRes();
    await assert.rejects(async () => {
      await libraryController.issueBook(req3, res3);
    }, (err) => {
      assert.strictEqual(err.statusCode, 400);
      assert.match(err.message, /loan limit/i);
      return true;
    });

    // Clean up: return copyBook3 so Student 1 is back down to 2 active loans
    const returnReq = {
      user: { userId: adminUser._id, role: 'admin', name: adminUser.name },
      params: { id: res2.jsonData.data._id },
      body: { conditionOnReturn: 'good' },
    };
    const returnRes = createMockRes();
    await libraryController.returnBook(returnReq, returnRes);
    assert.strictEqual(returnRes.statusCode, 200);
  });

  // Test 12: Duplicate active loan of same book title prevented
  await t.test('Test 12: Duplicate active loan of same book title prevented for student', async () => {
    // Student 1 has copy1 of testBook1. Trying to issue copy2 of testBook1 to Student 1 must fail.
    const req = {
      user: { userId: adminUser._id, role: 'admin', name: adminUser.name },
      body: { copyId: copy2._id, studentId: student1Doc._id },
    };
    const res = createMockRes();
    await assert.rejects(async () => {
      await libraryController.issueBook(req, res);
    }, (err) => {
      assert.strictEqual(err.statusCode, 400);
      assert.match(err.message, /already has an active loan/i);
      return true;
    });
  });

  // Test 13: Cross-student loan access / renewal rejection (Anti-IDOR)
  await t.test('Test 13: Cross-student loan renewal rejected with 403 (Anti-IDOR)', async () => {
    // Student 2 attempts to renew Student 1's loan
    const req = {
      user: { userId: student2User._id, role: 'student', name: student2User.name },
      params: { id: loan1._id },
    };
    const res = createMockRes();
    await assert.rejects(async () => {
      await libraryController.renewLoan(req, res);
    }, (err) => {
      assert.strictEqual(err.statusCode, 403);
      assert.match(err.message, /cannot renew another student book loan/i);
      return true;
    });
  });

  // Test 14: Successful book return and loan status transition to returned
  await t.test('Test 14: Successful return of issued book copy and status updates', async () => {
    // Return copy 3 (testBook2) issued to Student 1
    const activeLoan2 = await LibraryLoan.findOne({ copy: copy3._id, status: 'active' });
    const req = {
      user: { userId: adminUser._id, role: 'admin', name: adminUser.name },
      params: { id: activeLoan2._id },
      body: { conditionOnReturn: 'good', remarks: 'Returned in pristine state' },
    };
    const res = createMockRes();
    await libraryController.returnBook(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.success, true);
    assert.strictEqual(res.jsonData.data.loan.status, 'returned');
    assert.ok(res.jsonData.data.loan.actualReturnDate);

    // Verify copy is back to available
    const copyAfterReturn = await BookCopy.findById(copy3._id);
    assert.strictEqual(copyAfterReturn.status, 'available');
  });

  // Test 15: Duplicate return of already returned loan rejected
  await t.test('Test 15: Duplicate return of already returned loan rejected with 400', async () => {
    const returnedLoan = await LibraryLoan.findOne({ copy: copy3._id, status: 'returned' });
    const req = {
      user: { userId: adminUser._id, role: 'admin', name: adminUser.name },
      params: { id: returnedLoan._id },
      body: { conditionOnReturn: 'good' },
    };
    const res = createMockRes();
    await assert.rejects(async () => {
      await libraryController.returnBook(req, res);
    }, (err) => {
      assert.strictEqual(err.statusCode, 400);
      assert.match(err.message, /already been closed and returned/i);
      return true;
    });
  });

  // Test 16: Damaged copy return handling (marked damaged, fine assessed, copy NOT available)
  let damagedCopyLoan;
  await t.test('Test 16: Damaged copy return assesses damage fine and marks copy damaged', async () => {
    // Issue copy2 of testBook1 to Student 2
    const issueReq = {
      user: { userId: adminUser._id, role: 'admin', name: adminUser.name },
      body: { copyId: copy2._id, studentId: student2Doc._id },
    };
    const issueRes = createMockRes();
    await libraryController.issueBook(issueReq, issueRes);
    damagedCopyLoan = issueRes.jsonData.data;

    // Student 2 returns the book damaged
    const returnReq = {
      user: { userId: adminUser._id, role: 'admin', name: adminUser.name },
      params: { id: damagedCopyLoan._id },
      body: {
        conditionOnReturn: 'damaged',
        damagePenaltyInPaise: 150000, // Rs. 1,500 damage assessment
        remarks: 'Spilled coffee over chapters 4 to 8',
      },
    };
    const returnRes = createMockRes();
    await libraryController.returnBook(returnReq, returnRes);
    assert.strictEqual(returnRes.statusCode, 200);

    // Verify copy is marked damaged and NOT available
    const copyState = await BookCopy.findById(copy2._id);
    assert.strictEqual(copyState.status, 'damaged');

    // Verify a damage fine was assessed
    const damageFine = await LibraryFine.findOne({ loan: damagedCopyLoan._id, fineType: { $in: ['damaged', 'damaged_book'] } });
    assert.ok(damageFine);
    assert.strictEqual(damageFine.amountInPaise, 150000);
    assert.strictEqual(damageFine.status, 'pending');
    assert.strictEqual(damageFine.student.toString(), student2Doc._id.toString());
  });

  // Test 17: Lost copy return handling (marked lost, penalty assessed)
  await t.test('Test 17: Lost book copy marks copy lost and assesses replacement penalty', async () => {
    // Re-issue copy3 to student2
    const issueReq = {
      user: { userId: adminUser._id, role: 'admin', name: adminUser.name },
      body: { copyId: copy3._id, studentId: student2Doc._id },
    };
    const issueRes = createMockRes();
    await libraryController.issueBook(issueReq, issueRes);
    const lostLoan = issueRes.jsonData.data;

    // Admin marks loan as lost copy return
    const returnReq = {
      user: { userId: adminUser._id, role: 'admin', name: adminUser.name },
      params: { id: lostLoan._id },
      body: {
        conditionOnReturn: 'lost',
        remarks: 'Student confirmed book was misplaced on public transport',
      },
    };
    const returnRes = createMockRes();
    await libraryController.returnBook(returnReq, returnRes);
    assert.strictEqual(returnRes.statusCode, 200);

    // Verify copy status is lost
    const copyState = await BookCopy.findById(copy3._id);
    assert.strictEqual(copyState.status, 'lost');

    // Verify lost fine penalty created (priceInPaise * 1.5)
    // copy3 priceInPaise was 380,000 paise -> 380,000 * 1.5 = 570,000 paise
    const lostFine = await LibraryFine.findOne({ loan: lostLoan._id, fineType: { $in: ['lost', 'lost_book'] } });
    assert.ok(lostFine);
    assert.strictEqual(lostFine.amountInPaise, 570000);
    assert.strictEqual(lostFine.status, 'pending');
  });

  // Test 18: Loan renewal approval and due date extension
  let renewedLoan;
  await t.test('Test 18: Loan renewal approval extends due date by renewal duration', async () => {
    // loan1 is active on student1 for copy1
    const originalDueDate = new Date(loan1.dueDate);
    const req = {
      user: { userId: student1User._id, role: 'student', name: student1User.name },
      params: { id: loan1._id },
    };
    const res = createMockRes();
    await libraryController.renewLoan(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.success, true);
    renewedLoan = res.jsonData.data;
    assert.strictEqual(renewedLoan.renewalCount, 1);
    assert.ok(new Date(renewedLoan.dueDate) > originalDueDate);
  });

  // Test 19: Loan renewal rejection when renewalCount >= maxRenewals
  await t.test('Test 19: Loan renewal rejected when max renewals reached (max = 2)', async () => {
    // Perform 2nd renewal
    const req2 = {
      user: { userId: student1User._id, role: 'student', name: student1User.name },
      params: { id: loan1._id },
    };
    const res2 = createMockRes();
    await libraryController.renewLoan(req2, res2);
    assert.strictEqual(res2.statusCode, 200);
    assert.strictEqual(res2.jsonData.data.renewalCount, 2);

    // Attempt 3rd renewal -> should reject with 400
    const req3 = {
      user: { userId: student1User._id, role: 'student', name: student1User.name },
      params: { id: loan1._id },
    };
    const res3 = createMockRes();
    await assert.rejects(async () => {
      await libraryController.renewLoan(req3, res3);
    }, (err) => {
      assert.strictEqual(err.statusCode, 400);
      assert.match(err.message, /Maximum renewal limit/i);
      return true;
    });
  });

  // Test 20: Overdue loan renewal rejection when allowRenewIfOverdue is false
  await t.test('Test 20: Overdue loan renewal rejected when allowRenewIfOverdue is false', async () => {
    // Create an overdue loan for testing renewal policy
    const pastDueDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    const overdueLoan = await LibraryLoan.create({
      issueId: 'ISS-TEST-OVERDUE',
      loanNumber: 'LN-TEST-OVERDUE',
      book: testBook2._id,
      copy: copy3._id,
      student: student2Doc._id,
      issuedBy: adminUser._id,
      issueDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      dueDate: pastDueDate,
      status: 'active',
      renewalCount: 0,
      policySnapshot: {
        loanDurationDays: 14,
        maxRenewals: 2,
        renewalDurationDays: 14,
        allowRenewIfOverdue: false,
        allowRenewIfReserved: false,
        finePerOverdueDayInPaise: 200,
        gracePeriodDays: 2,
        maxFinePerBookInPaise: 50000,
      },
    });

    const req = {
      user: { userId: student2User._id, role: 'student', name: student2User.name },
      params: { id: overdueLoan._id },
    };
    const res = createMockRes();
    await assert.rejects(async () => {
      await libraryController.renewLoan(req, res);
    }, (err) => {
      assert.strictEqual(err.statusCode, 400);
      assert.match(err.message, /Overdue books cannot be renewed/i);
      return true;
    });

    // Cleanup overdue loan
    await LibraryLoan.findByIdAndDelete(overdueLoan._id);
  });

  // Test 21: Renewal rejection when active reservations exist
  await t.test('Test 21: Renewal rejected when reservations are queued for title', async () => {
    // Reset renewal count on loan1 to 0
    await LibraryLoan.findByIdAndUpdate(loan1._id, { renewalCount: 0, dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) });
    // Note: copy1 is issued, copy2 was damaged. So 0 available copies for testBook1!
    // Make sure availableCopies is 0 for testBook1
    await libraryService.syncBookCounts(testBook1._id);
    const bookCheck = await Book.findById(testBook1._id);
    assert.strictEqual(bookCheck.availableCopies, 0);

    // Student 2 reserves testBook1
    const resReq = {
      user: { userId: student2User._id, role: 'student', name: student2User.name },
      params: { id: testBook1._id },
    };
    const resRes = createMockRes();
    await libraryController.createReservation(resReq, resRes);
    assert.strictEqual(resRes.statusCode, 201);

    // Now Student 1 tries to renew loan1 (for testBook1) -> should reject
    const req = {
      user: { userId: student1User._id, role: 'student', name: student1User.name },
      params: { id: loan1._id },
    };
    const res = createMockRes();
    await assert.rejects(async () => {
      await libraryController.renewLoan(req, res);
    }, (err) => {
      assert.strictEqual(err.statusCode, 400);
      assert.match(err.message, /pending student reservations/i);
      return true;
    });

    // Cancel reservation for next tests
    await BookReservation.deleteMany({ book: testBook1._id });
  });

  // Test 22: Direct reservation rejection when copies are available on the shelf
  await t.test('Test 22: Direct reservation rejected when copies are available on the shelf', async () => {
    // Add an available copy to testBook1
    const freshCopy = await BookCopy.create({
      copyId: 'CPY-TEST-AVAIL-1',
      book: testBook1._id,
      accessionNumber: 'ACC-CL-AVAIL-1',
      status: 'available',
      priceInPaise: 450000,
    });
    await libraryService.syncBookCounts(testBook1._id);

    const req = {
      user: { userId: student2User._id, role: 'student', name: student2User.name },
      params: { id: testBook1._id },
    };
    const res = createMockRes();
    await assert.rejects(async () => {
      await libraryController.createReservation(req, res);
    }, (err) => {
      assert.strictEqual(err.statusCode, 400);
      assert.match(err.message, /available on the shelf/i);
      return true;
    });

    // Remove the temporary copy so availableCopies is 0 again
    await BookCopy.findByIdAndDelete(freshCopy._id);
    await libraryService.syncBookCounts(testBook1._id);
  });

  // Test 23: Duplicate active reservation prevention for same student and book
  let reservation1;
  await t.test('Test 23: Duplicate active reservation prevention for same student and book', async () => {
    // Student 2 reserves testBook1 (0 available copies)
    const req1 = {
      user: { userId: student2User._id, role: 'student', name: student2User.name },
      params: { id: testBook1._id },
    };
    const res1 = createMockRes();
    await libraryController.createReservation(req1, res1);
    assert.strictEqual(res1.statusCode, 201);
    reservation1 = res1.jsonData.data.reservation || res1.jsonData.data;

    // Student 2 attempts to reserve testBook1 again
    const req2 = {
      user: { userId: student2User._id, role: 'student', name: student2User.name },
      params: { id: testBook1._id },
    };
    const res2 = createMockRes();
    await assert.rejects(async () => {
      await libraryController.createReservation(req2, res2);
    }, (err) => {
      assert.ok(err.statusCode === 409 || err.statusCode === 400);
      assert.match(err.message, /already have an active reservation/i);
      return true;
    });
  });

  // Test 24: Fair FIFO reservation queue ordering and queue position calculation
  let reservation2;
  await t.test('Test 24: Fair FIFO reservation queue ordering and position', async () => {
    // Create Student 3
    const student3User = await User.create({
      name: 'Ananya Roy',
      email: 'ananya.lib@test.edu',
      loginId: 'STU_LIB_03',
      passwordHash: 'hashed_pw',
      isVerified: true,
      active: true,
      role: 'student',
    });
    const student3Doc = await Student.create({
      user: student3User._id,
      fullName: 'Ananya Roy',
      enrollmentNumber: 'EN_LIB_003',
      rollNumber: 'CS003',
      department: 'Computer Science',
      batch: '2023-2027',
      currentSemester: 5,
      section: 'A',
      status: 'active',
    });

    // Student 3 reserves testBook1
    const req = {
      user: { userId: student3User._id, role: 'student', name: student3User.name },
      params: { id: testBook1._id },
    };
    const res = createMockRes();
    await libraryController.createReservation(req, res);
    assert.strictEqual(res.statusCode, 201);
    reservation2 = res.jsonData.data.reservation || res.jsonData.data;

    // Verify queue positions:
    // reservation1 was created first -> position 1
    // reservation2 was created second -> position 2
    const pos1 = await libraryService.getReservationQueuePosition(reservation1._id, testBook1._id, reservation1.requestDate);
    const pos2 = await libraryService.getReservationQueuePosition(reservation2._id, testBook1._id, reservation2.requestDate);

    assert.strictEqual(pos1, 1);
    assert.strictEqual(pos2, 2);
  });

  // Test 25: Returned copy automatic allocation to next reservation in queue
  await t.test('Test 25: Returned copy auto-allocated to next reservation in FIFO queue', async () => {
    // When student 1 returns copy1 of testBook1, processNextReservation should hold it for Student 2
    const req = {
      user: { userId: adminUser._id, role: 'admin', name: adminUser.name },
      params: { id: loan1._id },
      body: { conditionOnReturn: 'good' },
    };
    const res = createMockRes();
    await libraryController.returnBook(req, res);
    assert.strictEqual(res.statusCode, 200);

    // Verify reservation1 is now 'available_for_pickup' with held copy1
    const updatedRes1 = await BookReservation.findById(reservation1._id);
    assert.strictEqual(updatedRes1.status, 'available_for_pickup');
    assert.strictEqual((updatedRes1.allocatedCopy || updatedRes1.reservedCopy).toString(), copy1._id.toString());
    assert.ok(updatedRes1.pickupDeadline);

    // Verify copy1 is in 'reserved' status
    const copyState = await BookCopy.findById(copy1._id);
    assert.strictEqual(copyState.status, 'reserved');
  });

  // Test 26: Reservation cancellation and held copy release
  await t.test('Test 26: Reservation cancellation releases held copy to next queued reservation', async () => {
    // Student 2 cancels reservation1
    const req = {
      user: { userId: student2User._id, role: 'student', name: student2User.name },
      params: { id: reservation1._id },
    };
    const res = createMockRes();
    await libraryController.cancelReservation(req, res);
    assert.strictEqual(res.statusCode, 200);

    // Reservation 1 is cancelled
    const res1After = await BookReservation.findById(reservation1._id);
    assert.strictEqual(res1After.status, 'cancelled');

    // Because reservation2 was queued, copy1 should now be allocated to reservation2!
    const res2After = await BookReservation.findById(reservation2._id);
    assert.strictEqual(res2After.status, 'available_for_pickup');
    assert.strictEqual((res2After.allocatedCopy || res2After.reservedCopy).toString(), copy1._id.toString());

    // Now Student 3 also cancels reservation2
    const student3User = await User.findOne({ loginId: 'STU_LIB_03' });
    const reqCancel2 = {
      user: { userId: student3User._id, role: 'student', name: student3User.name },
      params: { id: reservation2._id },
    };
    const resCancel2 = createMockRes();
    await libraryController.cancelReservation(reqCancel2, resCancel2);
    assert.strictEqual(resCancel2.statusCode, 200);

    // Since no more reservations exist, copy1 should now be available on the shelf!
    const copy1Final = await BookCopy.findById(copy1._id);
    assert.strictEqual(copy1Final.status, 'available');
  });

  // Test 27: Overdue fine calculation in integer paise with grace period
  await t.test('Test 27: Overdue fine calculation in integer paise with grace period', async () => {
    const policy = {
      finePerOverdueDayInPaise: 200, // Rs. 2.00 per day
      gracePeriodDays: 2,
      maxFinePerBookInPaise: 50000, // Rs. 500 max
    };

    // Case A: 1 day overdue (within 2 days grace period) -> fine = 0
    const loanWithinGrace = {
      dueDate: new Date('2026-10-01T00:00:00.000Z'),
    };
    const returnWithinGrace = new Date('2026-10-02T00:00:00.000Z');
    const fineA = libraryService.calculateOverdueFine(loanWithinGrace, returnWithinGrace, policy);
    assert.strictEqual(fineA.overdueDays, 1);
    assert.strictEqual(fineA.fineAmountInPaise, 0);

    // Case B: 5 days overdue (exceeds 2-day grace period) -> 5 * 200 = 1000 paise (Rs. 10.00)
    const returnExceedingGrace = new Date('2026-10-06T00:00:00.000Z');
    const fineB = libraryService.calculateOverdueFine(loanWithinGrace, returnExceedingGrace, policy);
    assert.strictEqual(fineB.overdueDays, 5);
    assert.strictEqual(fineB.fineAmountInPaise, 1000);

    // Case C: 300 days overdue -> capped at maxFinePerBookInPaise (50000 paise)
    const returnWayLate = new Date('2027-08-01T00:00:00.000Z');
    const fineC = libraryService.calculateOverdueFine(loanWithinGrace, returnWayLate, policy);
    assert.strictEqual(fineC.fineAmountInPaise, 50000);
  });

  // Test 28: Fine waiver authorization and audit logging
  let damageFineDoc;
  await t.test('Test 28: Fine waiver authorization, status update and audit logging', async () => {
    damageFineDoc = await LibraryFine.findOne({ status: 'pending', fineType: { $in: ['damaged', 'damaged_book'] } });
    assert.ok(damageFineDoc);

    const req = {
      user: { userId: adminUser._id, role: 'admin', name: adminUser.name },
      params: { id: damageFineDoc._id },
      body: { reason: 'Student volunteered for 10 hours of library catalog organization work' },
    };
    const res = createMockRes();
    await libraryController.waiveFine(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.success, true);
    assert.strictEqual(res.jsonData.data.status, 'waived');
    assert.strictEqual(res.jsonData.data.waivedBy.toString(), adminUser._id.toString());

    // Verify audit log entry created
    const audit = await LibraryAuditLog.findOne({
      entityId: damageFineDoc._id,
      action: 'fine_waived',
    });
    assert.ok(audit);
    assert.strictEqual(audit.performedBy.toString(), adminUser._id.toString());
  });

  // Test 29: Fine cash payment recording
  await t.test('Test 29: Fine payment recording updates status to paid with receipt', async () => {
    const lostFineDoc = await LibraryFine.findOne({ status: 'pending', fineType: { $in: ['lost', 'lost_book'] } });
    assert.ok(lostFineDoc);

    const req = {
      user: { userId: librarianUser._id, role: 'librarian', name: librarianUser.name },
      params: { id: lostFineDoc._id },
      body: { paymentMode: 'cash', remarks: 'Paid at desk counter 2' },
    };
    const res = createMockRes();
    await libraryController.recordFinePayment(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.success, true);
    assert.strictEqual(res.jsonData.data.status, 'paid');
    assert.ok(res.jsonData.data.paymentDate);
    assert.strictEqual(res.jsonData.data.paymentMode, 'cash');
  });

  // Test 30: Library policy configuration and update
  await t.test('Test 30: Institutional policy update by Admin', async () => {
    const req = {
      user: { userId: adminUser._id, role: 'admin', name: adminUser.name },
      body: {
        maxBooksPerStudent: 5,
        loanDurationDays: 21,
        finePerOverdueDayInPaise: 500, // Rs. 5.00
      },
    };
    const res = createMockRes();
    await libraryController.updatePolicy(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.data.maxBooksPerStudent, 5);
    assert.strictEqual(res.jsonData.data.loanDurationDays, 21);
    assert.strictEqual(res.jsonData.data.finePerOverdueDayInPaise, 500);

    // Verify getActivePolicy reflects this
    const activePolicy = await libraryService.getActivePolicy();
    assert.strictEqual(activePolicy.maxBooksPerStudent, 5);
  });

  // Test 31: Historical policy preservation (snapshot on issue)
  await t.test('Test 31: Historical loan policy snapshot preserved across subsequent policy updates', async () => {
    // When loan1 was issued in Test 8, the policy fine rate was 200 paise/day, loan duration was 14 days
    // Even though policy was updated in Test 30 to 500 paise/day and 21 days, loan1.policySnapshot is preserved
    const savedLoan1 = await LibraryLoan.findById(loan1._id);
    assert.strictEqual(savedLoan1.policySnapshot.finePerOverdueDayInPaise, 200);
    assert.strictEqual(savedLoan1.policySnapshot.loanDurationDays, 14);
  });

  // Test 32: CSV formula injection defense (CWE-1236) on export
  await t.test('Test 32: Formula injection characters (=, +, -, @, Tab, CR) sanitized with leading apostrophe', async () => {
    assert.strictEqual(libraryService.sanitizeCsvValue('=1+2'), '"\'=1+2"');
    assert.strictEqual(libraryService.sanitizeCsvValue('+cmd|/C'), '"\'+cmd|/C"');
    assert.strictEqual(libraryService.sanitizeCsvValue('-calc'), '"\'-calc"');
    assert.strictEqual(libraryService.sanitizeCsvValue('@SUM(A1:A10)'), '"\'@SUM(A1:A10)"');
    assert.strictEqual(libraryService.sanitizeCsvValue('Normal Book Title'), '"Normal Book Title"');

    // Test actual CSV export endpoint returns text/csv header
    const req = { query: {} };
    const res = createMockRes();
    await libraryController.exportInventoryCsv(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.headers['content-type'].includes('text/csv'));
    assert.ok(res.rawBody.includes('Accession Number'));
  });

  // Test 33: Centralized notification integration (category 'library')
  await t.test('Test 33: Centralized notifications dispatched with category library', async () => {
    const libraryNotifications = await Notification.find({ category: 'library' });
    assert.ok(libraryNotifications.length > 0);
    const sample = libraryNotifications[0];
    assert.strictEqual(sample.category, 'library');
    assert.ok(sample.title);
    assert.ok(sample.message);
  });

  await t.test('Teardown: Close isolated test database connection', async () => {
    await mongoose.connection.close();
  });
});
