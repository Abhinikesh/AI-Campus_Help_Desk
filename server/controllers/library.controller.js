/**
 * server/controllers/library.controller.js
 * Comprehensive Library Management, Book Inventory, Circulation, Issue/Return & Fine Tracking.
 * Enforces integer paise arithmetic, strict Anti-IDOR, fair FIFO reservation queues,
 * multi-tier fine waivers, and spreadsheet formula injection protection.
 */
'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');
const Book = require('../models/Book');
const BookCopy = require('../models/BookCopy');
const LibraryLoan = require('../models/LibraryLoan');
const BookReservation = require('../models/BookReservation');
const LibraryFine = require('../models/LibraryFine');
const LibraryPolicy = require('../models/LibraryPolicy');
const LibraryAuditLog = require('../models/LibraryAuditLog');
const Student = require('../models/Student');
const User = require('../models/User');
const libraryService = require('../services/library.service');
const notificationService = require('../services/notification.service');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Resolves current student profile for authenticated user
 * @param {Object} req
 * @returns {Promise<Object|null>}
 */
async function resolveCurrentStudent(req) {
  const userId = req.user?.userId || req.user?._id || req.user?.id;
  if (!userId) return null;
  return await Student.findOne({ user: userId });
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. BOOK CATALOG MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/library/books
 * Admin or Librarian creates a bibliographic book entry.
 */
const createBook = asyncHandler(async (req, res) => {
  const {
    title,
    subtitle,
    isbn,
    authors,
    publisher,
    edition,
    publicationYear,
    language,
    category,
    subject,
    description,
    coverImage,
    shelfNumber,
    rackNumber,
    location,
  } = req.body;

  if (!title || !category || !authors) {
    throw new ApiError(400, 'Title, category, and at least one author are required');
  }

  const cleanAuthors = Array.isArray(authors)
    ? authors.map((a) => String(a).trim()).filter(Boolean)
    : String(authors)
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean);

  if (cleanAuthors.length === 0) {
    throw new ApiError(400, 'At least one author name is required');
  }

  const cleanIsbn = typeof isbn === 'string' ? isbn.trim().toUpperCase() : '';

  // Optional ISBN uniqueness check if provided
  if (cleanIsbn) {
    const existing = await Book.findOne({ isbn: cleanIsbn, status: 'active' });
    if (existing) {
      throw new ApiError(409, `A book with ISBN '${cleanIsbn}' already exists in the catalog`);
    }
  }

  const book = await Book.create({
    title: title.trim(),
    subtitle: (subtitle || '').trim(),
    isbn: cleanIsbn,
    authors: cleanAuthors,
    publisher: (publisher || '').trim(),
    edition: (edition || '').trim(),
    publicationYear: publicationYear ? Number(publicationYear) : null,
    language: (language || 'English').trim(),
    category: category.trim(),
    subject: (subject || '').trim(),
    description: (description || '').trim(),
    coverImage: (coverImage || '').trim(),
    shelfNumber: (shelfNumber || '').trim(),
    rackNumber: (rackNumber || '').trim(),
    location: (location || 'Central Library - Main Stack').trim(),
    createdBy: req.user?.userId || req.user?._id,
  });

  await LibraryAuditLog.create({
    action: 'book_created',
    entityType: 'book',
    entityId: book._id,
    performedBy: req.user?.userId || req.user?._id,
    details: { title: book.title, isbn: book.isbn, category: book.category },
  });

  return res.status(201).json({
    success: true,
    data: book,
    message: 'Book added to catalog successfully',
  });
});

/**
 * GET /api/library/books
 * Search and browse book catalog with filters.
 */
const getBooks = asyncHandler(async (req, res) => {
  const { category, search, availableOnly, status = 'active', page = 1, limit = 20 } = req.query;
  const filter = {};

  if (status && status !== 'all') {
    filter.status = status;
  }

  if (category && category !== 'all') {
    filter.category = category;
  }

  if (availableOnly === 'true' || availableOnly === true) {
    filter.availableCopies = { $gt: 0 };
  }

  if (search && search.trim()) {
    filter.$or = [
      { title: { $regex: search.trim(), $options: 'i' } },
      { authors: { $regex: search.trim(), $options: 'i' } },
      { isbn: { $regex: search.trim(), $options: 'i' } },
      { category: { $regex: search.trim(), $options: 'i' } },
      { subject: { $regex: search.trim(), $options: 'i' } },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);
  const total = await Book.countDocuments(filter);
  const books = await Book.find(filter)
    .sort({ title: 1 })
    .skip(skip)
    .limit(Number(limit));

  return res.status(200).json({
    success: true,
    data: books,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / Number(limit)),
    },
    message: 'Books fetched successfully',
  });
});

/**
 * GET /api/library/books/:id
 * Retrieve single book details including copy breakdown.
 */
const getBookById = asyncHandler(async (req, res) => {
  const book = await Book.findById(req.params.id);
  if (!book) {
    throw new ApiError(404, 'Book not found');
  }

  const copies = await BookCopy.find({ book: book._id }).sort({ accessionNumber: 1 });

  return res.status(200).json({
    success: true,
    data: {
      book,
      copies,
    },
    message: 'Book details loaded successfully',
  });
});

/**
 * PUT /api/library/books/:id
 * Update book metadata.
 */
const updateBook = asyncHandler(async (req, res) => {
  const book = await Book.findById(req.params.id);
  if (!book) {
    throw new ApiError(404, 'Book not found');
  }

  const updatableFields = [
    'title',
    'subtitle',
    'isbn',
    'publisher',
    'edition',
    'publicationYear',
    'language',
    'category',
    'subject',
    'description',
    'coverImage',
    'shelfNumber',
    'rackNumber',
    'location',
    'status',
  ];

  for (const field of updatableFields) {
    if (req.body[field] !== undefined) {
      book[field] = req.body[field];
    }
  }

  if (req.body.authors) {
    book.authors = Array.isArray(req.body.authors)
      ? req.body.authors.map((a) => a.trim()).filter(Boolean)
      : String(req.body.authors)
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean);
  }

  await book.save();

  return res.status(200).json({
    success: true,
    data: book,
    message: 'Book updated successfully',
  });
});

/**
 * DELETE /api/library/books/:id
 * Archive a book from active circulation.
 */
const archiveBook = asyncHandler(async (req, res) => {
  const book = await Book.findById(req.params.id);
  if (!book) {
    throw new ApiError(404, 'Book not found');
  }

  if (book.issuedCopies > 0) {
    throw new ApiError(400, 'Cannot archive book while copies are actively issued on loan');
  }

  book.status = 'archived';
  await book.save();

  return res.status(200).json({
    success: true,
    data: book,
    message: 'Book archived from active catalog',
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. PHYSICAL COPY INVENTORY MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/library/copies
 * Adds a physical copy with accession number to a book.
 */
const addBookCopy = asyncHandler(async (req, res) => {
  const { accessionNumber, barcode, shelfLocation, condition, priceInPaise, price, acquisitionSource } =
    req.body;
  const bookId = req.body.bookId || req.params.bookId || req.params.id;

  if (!bookId || !accessionNumber) {
    throw new ApiError(400, 'Book ID and accession number are required');
  }

  const book = await Book.findById(bookId);
  if (!book) {
    throw new ApiError(404, 'Book not found');
  }

  const cleanAccession = accessionNumber.trim().toUpperCase();
  const existingCopy = await BookCopy.findOne({ accessionNumber: cleanAccession });
  if (existingCopy) {
    throw new ApiError(409, `A copy with accession number '${cleanAccession}' already exists`);
  }

  const copyCount = await BookCopy.countDocuments({ book: book._id });
  const copyId = `CPY-${(book.isbn || book._id).toString().slice(-6)}-${String(copyCount + 1).padStart(2, '0')}`.toUpperCase();

  const rawPriceInPaise =
    priceInPaise !== undefined ? Math.round(Number(priceInPaise)) : price ? Math.round(Number(price) * 100) : 0;

  const copy = await BookCopy.create({
    copyId,
    book: book._id,
    accessionNumber: cleanAccession,
    barcode: (barcode || cleanAccession).trim(),
    shelfLocation: (shelfLocation || book.shelfNumber || '').trim(),
    condition: condition || 'good',
    priceInPaise: rawPriceInPaise,
    acquisitionSource: (acquisitionSource || 'Institutional Purchase').trim(),
    status: 'available',
    statusHistory: [
      {
        status: 'available',
        condition: condition || 'good',
        changedBy: req.user?.userId || req.user?._id,
        reason: 'Initial copy accessioning',
        timestamp: new Date(),
      },
    ],
  });

  await libraryService.syncBookCounts(book._id);

  return res.status(201).json({
    success: true,
    data: copy,
    message: 'Physical copy registered successfully',
  });
});

/**
 * GET /api/library/copies
 * List physical copies with filtering.
 */
const getCopies = asyncHandler(async (req, res) => {
  const { bookId, status, condition, search, page = 1, limit = 25 } = req.query;
  const filter = {};

  if (bookId) filter.book = bookId;
  if (status && status !== 'all') filter.status = status;
  if (condition && condition !== 'all') filter.condition = condition;

  if (search && search.trim()) {
    filter.$or = [
      { accessionNumber: { $regex: search.trim(), $options: 'i' } },
      { copyId: { $regex: search.trim(), $options: 'i' } },
      { barcode: { $regex: search.trim(), $options: 'i' } },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);
  const total = await BookCopy.countDocuments(filter);
  const copies = await BookCopy.find(filter)
    .populate('book', 'title isbn category authors')
    .populate({
      path: 'currentLoan',
      populate: {
        path: 'student',
        populate: { path: 'user', select: 'name rollNumber loginId' },
      },
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  return res.status(200).json({
    success: true,
    data: copies,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / Number(limit)),
    },
    message: 'Copies loaded successfully',
  });
});

/**
 * PATCH /api/library/copies/:id/status
 * Update physical condition or status of a copy.
 */
const updateCopyStatus = asyncHandler(async (req, res) => {
  const { status, condition, reason } = req.body;
  const copy = await BookCopy.findById(req.params.id);
  if (!copy) {
    throw new ApiError(404, 'Book copy not found');
  }

  if (status && status !== copy.status) {
    if (copy.status === 'issued' && status === 'available') {
      throw new ApiError(400, 'Cannot directly mark an issued copy available without processing a return');
    }
    copy.status = status;
  }

  if (condition) {
    copy.condition = condition;
  }

  copy.statusHistory.push({
    status: copy.status,
    condition: copy.condition,
    changedBy: req.user?.userId || req.user?._id,
    reason: (reason || 'Manual administrative update').trim(),
    timestamp: new Date(),
  });

  await copy.save();
  await libraryService.syncBookCounts(copy.book);

  return res.status(200).json({
    success: true,
    data: copy,
    message: 'Copy status updated successfully',
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. BOOK CIRCULATION: ISSUE WORKFLOW
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/library/loans/issue
 * Issue an available physical copy to a student.
 */
const issueBook = asyncHandler(async (req, res) => {
  const { studentId, rollNumber, copyId, accessionNumber, bookId, customDueDate, notes } = req.body;

  // 1. Resolve Student
  let student;
  if (studentId) {
    student = await Student.findById(studentId).populate('user');
  } else if (rollNumber) {
    student = await Student.findOne({ rollNumber: rollNumber.trim().toUpperCase() }).populate('user');
  }

  if (!student) {
    throw new ApiError(404, 'Student not found');
  }

  // 2. Resolve Physical Copy
  let copy;
  if (copyId) {
    copy = await BookCopy.findById(copyId).populate('book');
  } else if (accessionNumber) {
    copy = await BookCopy.findOne({ accessionNumber: accessionNumber.trim().toUpperCase() }).populate('book');
  } else if (bookId) {
    copy = await BookCopy.findOne({ book: bookId, status: 'available' }).populate('book');
  }

  if (!copy) {
    throw new ApiError(404, 'Physical book copy not found');
  }

  // Check if copy is already issued or unavailable
  if (copy.status !== 'available') {
    if (copy.status === 'reserved') {
      // Allowed only if reserved for this specific student
      const reservation = await BookReservation.findOne({
        reservedCopy: copy._id,
        student: student._id,
        status: 'available_for_pickup',
      });
      if (!reservation) {
        throw new ApiError(400, 'This physical copy is currently reserved for another student');
      }
    } else {
      throw new ApiError(400, `Copy '${copy.accessionNumber}' is not available (Current status: ${copy.status})`);
    }
  }

  const policy = await libraryService.getActivePolicy();

  // 3. Check Loan Limit
  const activeLoanCount = await LibraryLoan.countDocuments({
    student: student._id,
    status: 'active',
  });

  if (activeLoanCount >= policy.maxBooksPerStudent) {
    throw new ApiError(
      400,
      `Student has reached the maximum permitted loan limit of ${policy.maxBooksPerStudent} books`
    );
  }

  // 4. Check duplicate active loan of same book title
  const existingSameBookLoan = await LibraryLoan.findOne({
    student: student._id,
    book: copy.book._id,
    status: 'active',
  });

  if (existingSameBookLoan) {
    throw new ApiError(400, 'Student already has an active loan of this book title');
  }

  // 5. Calculate Due Date
  const issueDate = new Date();
  let dueDate;
  if (customDueDate) {
    dueDate = new Date(customDueDate);
  } else {
    dueDate = new Date(issueDate.getTime() + policy.loanDurationDays * 24 * 60 * 60 * 1000);
  }

  const issueId = `ISS-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

  // 6. Create Loan & Atomically Mark Copy Issued
  const loan = await LibraryLoan.create({
    issueId,
    student: student._id,
    book: copy.book._id,
    copy: copy._id,
    issueDate,
    dueDate,
    status: 'active',
    issuedBy: req.user?.userId || req.user?._id,
    policySnapshot: {
      loanDurationDays: policy.loanDurationDays,
      finePerOverdueDayInPaise: policy.finePerOverdueDayInPaise,
      gracePeriodDays: policy.gracePeriodDays,
      maxRenewals: policy.maxRenewals,
      maxFinePerBookInPaise: policy.maxFinePerBookInPaise,
    },
    notes: (notes || '').trim(),
  });

  copy.status = 'issued';
  copy.currentLoan = loan._id;
  copy.currentReservation = null;
  copy.statusHistory.push({
    status: 'issued',
    condition: copy.condition,
    changedBy: req.user?.userId || req.user?._id,
    reason: `Issued to student ${student.rollNumber} under ${issueId}`,
    timestamp: new Date(),
  });
  await copy.save();

  // If this copy fulfilled a reservation, mark reservation fulfilled
  await BookReservation.updateMany(
    { reservedCopy: copy._id, student: student._id, status: 'available_for_pickup' },
    { status: 'fulfilled' }
  );

  await libraryService.syncBookCounts(copy.book._id);

  await LibraryAuditLog.create({
    action: 'book_issued',
    entityType: 'loan',
    entityId: loan._id,
    performedBy: req.user?.userId || req.user?._id,
    details: {
      issueId,
      student: student.rollNumber,
      bookTitle: copy.book.title,
      accessionNumber: copy.accessionNumber,
      dueDate,
    },
  });

  // Notify student
  if (student.user?._id || student.user) {
    const recipientId = student.user._id || student.user;
    try {
      await notificationService.createNotification({
        recipient: recipientId,
        title: 'Library Book Issued',
        message: `"${copy.book.title}" (Copy: ${copy.accessionNumber}) has been issued. Due date: ${dueDate.toLocaleDateString()}.`,
        category: 'library',
        priority: 'normal',
        relatedEntityType: 'library_loan',
        relatedEntityId: loan._id,
        targetRoute: '/student/library',
        actorName: 'Central Library Desk',
        actorRole: 'admin',
        eventId: `lib_issue_${loan._id}`,
      });
    } catch (err) {
      console.warn('⚠️ Notification skipped:', err.message);
    }
  }

  return res.status(201).json({
    success: true,
    data: loan,
    message: `Book issued successfully. Due on ${dueDate.toLocaleDateString()}.`,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. BOOK CIRCULATION: RETURN WORKFLOW
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/library/loans/:id/return
 * Records the physical return of an issued book copy, calculates overdue fines, and processes queues.
 */
const returnBook = asyncHandler(async (req, res) => {
  const {
    condition,
    conditionOnReturn,
    returnDate,
    damageFeeInPaise,
    damagePenaltyInPaise,
    damageFee,
    notes,
    remarks,
  } = req.body;

  const loan = await LibraryLoan.findById(req.params.id)
    .populate('book')
    .populate('copy')
    .populate({
      path: 'student',
      populate: { path: 'user', select: 'name email loginId' },
    });

  if (!loan) {
    throw new ApiError(404, 'Library loan record not found');
  }

  if (loan.status === 'returned') {
    throw new ApiError(400, 'This book loan has already been closed and returned');
  }

  const effectiveReturnDate = returnDate ? new Date(returnDate) : new Date();
  const staffUserId = req.user?.userId || req.user?._id;
  const returnCond = condition || conditionOnReturn || loan.copy?.condition || 'good';

  loan.actualReturnDate = effectiveReturnDate;
  loan.returnedTo = staffUserId;
  loan.returnCondition = returnCond;
  loan.status = 'returned';
  if (notes || remarks) loan.notes = (notes || remarks).trim();

  // 1. Calculate Overdue Fine
  const fineCalculation = libraryService.calculateOverdueFine(loan, effectiveReturnDate);
  let createdFine = null;

  if (fineCalculation.fineInPaise > 0) {
    const fineNumber = `FINE-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    createdFine = await LibraryFine.create({
      fineNumber,
      student: loan.student._id,
      loan: loan._id,
      book: loan.book._id,
      copy: loan.copy._id,
      fineType: 'overdue',
      amountInPaise: fineCalculation.fineInPaise,
      reason: `Overdue return: ${fineCalculation.overdueDays} days late (grace: ${fineCalculation.graceDays} days) at ₹${fineCalculation.ratePerDayInPaise / 100}/day`,
      calculationDetails: fineCalculation,
      status: 'pending',
      recordedBy: staffUserId,
    });
    loan.fine = createdFine._id;
  }

  // 2. Assess Damage or Lost Fine if applicable
  const rawDamagePaise =
    damageFeeInPaise !== undefined
      ? Math.round(Number(damageFeeInPaise))
      : damagePenaltyInPaise !== undefined
      ? Math.round(Number(damagePenaltyInPaise))
      : damageFee
      ? Math.round(Number(damageFee) * 100)
      : 0;

  if (rawDamagePaise > 0 || returnCond === 'damaged' || returnCond === 'lost') {
    const policy = await libraryService.getActivePolicy();
    const copyPrice = loan.copy?.priceInPaise || 25000;
    const penaltyType = returnCond === 'lost' ? 'lost_book' : 'damaged_book';
    const penaltyPaise =
      rawDamagePaise > 0
        ? rawDamagePaise
        : returnCond === 'lost'
        ? Math.round(copyPrice * (policy.defaultLostPenaltyMultiplier || 1.5))
        : copyPrice;

    const penaltyNumber = `FINE-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    await LibraryFine.create({
      fineNumber: penaltyNumber,
      student: loan.student._id,
      loan: loan._id,
      book: loan.book._id,
      copy: loan.copy._id,
      fineType: penaltyType,
      amountInPaise: penaltyPaise,
      reason: `Book copy returned in ${returnCond} condition: ${notes || remarks || 'Assessment penalty'}`,
      status: 'pending',
      recordedBy: staffUserId,
    });
  }

  await loan.save();

  // 3. Update Physical Copy Status
  const copy = await BookCopy.findById(loan.copy._id || loan.copy);
  copy.currentLoan = null;
  copy.condition = returnCond;

  if (returnCond === 'damaged') {
    copy.status = 'damaged';
    copy.statusHistory.push({
      status: 'damaged',
      condition: 'damaged',
      changedBy: staffUserId,
      reason: 'Returned in damaged condition',
      timestamp: new Date(),
    });
    await copy.save();
    await libraryService.syncBookCounts(loan.book._id);
  } else if (returnCond === 'lost') {
    copy.status = 'lost';
    copy.statusHistory.push({
      status: 'lost',
      condition: 'lost',
      changedBy: staffUserId,
      reason: 'Reported lost upon loan closing',
      timestamp: new Date(),
    });
    await copy.save();
    await libraryService.syncBookCounts(loan.book._id);
  } else {
    // Healthy copy: process reservation queue or return to available
    copy.statusHistory.push({
      status: 'returned',
      condition: returnCond,
      changedBy: staffUserId,
      reason: 'Returned in acceptable condition',
      timestamp: new Date(),
    });
    await libraryService.processNextReservation(loan.book._id, copy);
  }

  await LibraryAuditLog.create({
    action: 'book_returned',
    entityType: 'loan',
    entityId: loan._id,
    performedBy: staffUserId,
    details: {
      issueId: loan.issueId,
      student: loan.student?.rollNumber,
      fineInPaise: fineCalculation.fineInPaise,
      condition: returnCond,
    },
  });

  // Notify student
  const studentUser = loan.student?.user;
  if (studentUser?._id || studentUser) {
    const recipientId = studentUser._id || studentUser;
    try {
      const fineMsg =
        fineCalculation.fineInPaise > 0
          ? ` Overdue fine assessed: ₹${fineCalculation.fineInPaise / 100}.`
          : '';
      await notificationService.createNotification({
        recipient: recipientId,
        title: 'Library Book Returned',
        message: `"${loan.book?.title}" has been successfully returned and checked in.${fineMsg}`,
        category: 'library',
        priority: 'normal',
        relatedEntityType: 'library_loan',
        relatedEntityId: loan._id,
        targetRoute: '/student/library',
        actorName: 'Central Library Desk',
        actorRole: 'admin',
        eventId: `lib_return_${loan._id}`,
      });
    } catch (err) {
      console.warn('⚠️ Return notification skipped:', err.message);
    }
  }

  return res.status(200).json({
    success: true,
    data: {
      loan,
      fine: createdFine,
      overdueCalculation: fineCalculation,
    },
    message: 'Book returned successfully',
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. LOAN RENEWALS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/library/loans/:id/renew
 * Extends loan due date subject to policy limits and pending reservation constraints.
 */
const renewLoan = asyncHandler(async (req, res) => {
  const loan = await LibraryLoan.findById(req.params.id).populate('book').populate('student');
  if (!loan) {
    throw new ApiError(404, 'Loan not found');
  }

  if (loan.status !== 'active') {
    throw new ApiError(400, `Cannot renew a loan that is currently '${loan.status}'`);
  }

  // IDOR Protection: Students can only renew their own loans
  if (req.user?.role === 'student') {
    const currentStudent = await resolveCurrentStudent(req);
    if (!currentStudent || String(loan.student._id) !== String(currentStudent._id)) {
      throw new ApiError(403, 'Forbidden: You cannot renew another student book loan');
    }
  }

  const policy = await libraryService.getActivePolicy();

  // Check max renewals limit
  if (loan.renewalCount >= policy.maxRenewals) {
    throw new ApiError(400, `Maximum renewal limit of ${policy.maxRenewals} reached for this loan`);
  }

  // Check if overdue
  if (new Date() > new Date(loan.dueDate) && !policy.allowRenewIfOverdue) {
    throw new ApiError(400, 'Overdue books cannot be renewed. Please return the book at the library desk.');
  }

  // Check if book has active pending reservations
  if (!policy.allowRenewIfReserved) {
    const hasPendingReservations = await BookReservation.exists({
      book: loan.book._id,
      status: 'pending',
    });
    if (hasPendingReservations) {
      throw new ApiError(
        400,
        'This title has pending student reservations and cannot be renewed. Please return by due date.'
      );
    }
  }

  const prevDueDate = loan.dueDate;
  const newDueDate = new Date(prevDueDate.getTime() + policy.renewalDurationDays * 24 * 60 * 60 * 1000);

  loan.renewalCount += 1;
  loan.renewalHistory.push({
    previousDueDate: prevDueDate,
    newDueDate,
    renewedAt: new Date(),
    renewedBy: req.user?.userId || req.user?._id,
    reason: (req.body && req.body.reason) || 'User renewal request',
  });
  loan.dueDate = newDueDate;
  await loan.save();

  await LibraryAuditLog.create({
    action: 'loan_renewed',
    entityType: 'loan',
    entityId: loan._id,
    performedBy: req.user?.userId || req.user?._id,
    details: {
      issueId: loan.issueId,
      previousDueDate: prevDueDate,
      newDueDate,
      renewalCount: loan.renewalCount,
    },
  });

  return res.status(200).json({
    success: true,
    data: loan,
    message: `Loan renewed successfully. New due date is ${newDueDate.toLocaleDateString()}.`,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. BOOK RESERVATIONS & QUEUEING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/library/reservations
 * Student or Librarian places a hold/reservation for a book title with zero available physical copies.
 */
const createReservation = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const bookId = body.bookId || req.params.bookId || req.params.id;
  const studentId = body.studentId;

  let student;
  if (req.user?.role === 'student') {
    student = await resolveCurrentStudent(req);
  } else if (studentId) {
    student = await Student.findById(studentId);
  }

  if (!student) {
    throw new ApiError(404, 'Student profile not found');
  }

  const book = await Book.findById(bookId);
  if (!book) {
    throw new ApiError(404, 'Book not found');
  }

  if (book.status === 'archived') {
    throw new ApiError(400, 'Cannot reserve an archived book');
  }

  // If physical copies are currently available on shelf, direct borrowing is required
  if (book.availableCopies > 0) {
    throw new ApiError(
      400,
      'Copies of this book are currently available on the shelf. Please pick up directly at the library desk instead of placing a reservation.'
    );
  }

  // Prevent duplicate active reservation for same book
  const existingRes = await BookReservation.findOne({
    student: student._id,
    book: book._id,
    status: { $in: ['pending', 'available_for_pickup'] },
  });

  if (existingRes) {
    throw new ApiError(409, 'You already have an active reservation for this book title');
  }

  const reservationNumber = `RES-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const requestDate = new Date();

  const reservation = await BookReservation.create({
    reservationNumber,
    student: student._id,
    book: book._id,
    requestDate,
    status: 'pending',
  });

  const queuePosition = await libraryService.getReservationQueuePosition(reservation._id, book._id, requestDate);

  await libraryService.syncBookCounts(book._id);

  return res.status(201).json({
    success: true,
    data: {
      reservation,
      queuePosition,
    },
    message: `Reservation confirmed. Your queue position is #${queuePosition}.`,
  });
});

/**
 * PATCH /api/library/reservations/:id/cancel
 * Cancels a pending or held reservation.
 */
const cancelReservation = asyncHandler(async (req, res) => {
  const { cancellationReason } = req.body || {};
  const reservation = await BookReservation.findById(req.params.id).populate('book');

  if (!reservation) {
    throw new ApiError(404, 'Reservation not found');
  }

  if (req.user?.role === 'student') {
    const student = await resolveCurrentStudent(req);
    if (!student || String(reservation.student) !== String(student._id)) {
      throw new ApiError(403, 'Forbidden: You cannot cancel another student reservation');
    }
  }

  if (reservation.status === 'cancelled' || reservation.status === 'fulfilled') {
    throw new ApiError(400, `Cannot cancel reservation in '${reservation.status}' status`);
  }

  const wasHeldCopy = reservation.reservedCopy;
  reservation.status = 'cancelled';
  reservation.cancellationReason = (cancellationReason || 'User cancelled').trim();
  await reservation.save();

  // If a physical copy was held for this reservation, reassign or free it
  if (wasHeldCopy) {
    const copy = await BookCopy.findById(wasHeldCopy);
    if (copy && copy.status === 'reserved') {
      await libraryService.processNextReservation(reservation.book._id, copy);
    }
  }

  await libraryService.syncBookCounts(reservation.book._id);

  return res.status(200).json({
    success: true,
    data: reservation,
    message: 'Reservation cancelled successfully',
  });
});

/**
 * GET /api/library/reservations
 * List reservations with role scoping.
 */
const getReservations = asyncHandler(async (req, res) => {
  const { bookId, status, page = 1, limit = 20 } = req.query;
  const filter = {};

  if (req.user?.role === 'student') {
    const student = await resolveCurrentStudent(req);
    if (!student) throw new ApiError(404, 'Student profile not found');
    filter.student = student._id;
  } else {
    if (bookId) filter.book = bookId;
    if (status && status !== 'all') filter.status = status;
  }

  const skip = (Number(page) - 1) * Number(limit);
  const total = await BookReservation.countDocuments(filter);
  const reservations = await BookReservation.find(filter)
    .populate('book', 'title isbn category authors shelfNumber rackNumber')
    .populate({
      path: 'student',
      populate: { path: 'user', select: 'name rollNumber email' },
    })
    .populate('reservedCopy', 'accessionNumber copyId shelfLocation')
    .sort({ requestDate: -1 })
    .skip(skip)
    .limit(Number(limit));

  // Augment pending items with queue positions
  const augmented = await Promise.all(
    reservations.map(async (r) => {
      const obj = r.toObject();
      if (r.status === 'pending') {
        obj.queuePosition = await libraryService.getReservationQueuePosition(r._id, r.book?._id, r.requestDate);
      }
      return obj;
    })
  );

  return res.status(200).json({
    success: true,
    data: augmented,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / Number(limit)),
    },
    message: 'Reservations loaded successfully',
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. LIBRARY FINES & WAIVERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/library/fines
 * List fines with filtering and role scoping.
 */
const getFines = asyncHandler(async (req, res) => {
  const { status, fineType, page = 1, limit = 20 } = req.query;
  const filter = {};

  if (req.user?.role === 'student') {
    const student = await resolveCurrentStudent(req);
    if (!student) throw new ApiError(404, 'Student profile not found');
    filter.student = student._id;
  } else {
    if (status && status !== 'all') filter.status = status;
    if (fineType && fineType !== 'all') filter.fineType = fineType;
  }

  const skip = (Number(page) - 1) * Number(limit);
  const total = await LibraryFine.countDocuments(filter);
  const fines = await LibraryFine.find(filter)
    .populate('book', 'title isbn')
    .populate({
      path: 'student',
      populate: { path: 'user', select: 'name rollNumber email' },
    })
    .populate('waivedBy', 'name email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  return res.status(200).json({
    success: true,
    data: fines,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / Number(limit)),
    },
    message: 'Fines loaded successfully',
  });
});

/**
 * PATCH /api/library/fines/:id/waive
 * Admin or Librarian waives an unpaid library fine with mandatory reason.
 */
const waiveFine = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const reasonText = (body.waiverReason || body.reason || '').trim();
  if (!reasonText || reasonText.length < 5) {
    throw new ApiError(400, 'A detailed waiver justification reason (min 5 characters) is required');
  }

  const fine = await LibraryFine.findById(req.params.id)
    .populate('book')
    .populate({
      path: 'student',
      populate: { path: 'user', select: 'name email loginId' },
    });

  if (!fine) {
    throw new ApiError(404, 'Fine record not found');
  }

  if (fine.status !== 'pending') {
    throw new ApiError(400, `Cannot waive fine with status '${fine.status}'`);
  }

  const staffUserId = req.user?.userId || req.user?._id;
  fine.status = 'waived';
  fine.waivedBy = staffUserId;
  fine.waivedAt = new Date();
  fine.waiverReason = reasonText;
  await fine.save();

  await LibraryAuditLog.create({
    action: 'fine_waived',
    entityType: 'fine',
    entityId: fine._id,
    performedBy: staffUserId,
    details: {
      fineNumber: fine.fineNumber,
      amountInPaise: fine.amountInPaise,
      waiverReason: reasonText,
    },
  });

  // Notify student
  const studentUser = fine.student?.user;
  if (studentUser?._id || studentUser) {
    const recipientId = studentUser._id || studentUser;
    try {
      await notificationService.createNotification({
        recipient: recipientId,
        title: 'Library Fine Waived',
        message: `Your library fine ${fine.fineNumber} of ₹${fine.amountInRupees} has been formally waived.`,
        category: 'library',
        priority: 'normal',
        relatedEntityType: 'library_fine',
        relatedEntityId: fine._id,
        targetRoute: '/student/library',
        actorName: 'Central Library Desk',
        actorRole: 'admin',
        eventId: `lib_fine_waived_${fine._id}`,
      });
    } catch (err) {
      console.warn('⚠️ Waiver notification skipped:', err.message);
    }
  }

  return res.status(200).json({
    success: true,
    data: fine,
    message: 'Fine waived successfully',
  });
});

/**
 * PATCH /api/library/fines/:id/pay
 * Mark fine as paid with verified receipt/reference.
 */
const recordFinePayment = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const { paymentReference, paymentMode, paymentDate } = body;
  const fine = await LibraryFine.findById(req.params.id);
  if (!fine) {
    throw new ApiError(404, 'Fine record not found');
  }

  if (fine.status !== 'pending') {
    throw new ApiError(400, `Cannot pay fine with status '${fine.status}'`);
  }

  fine.status = 'paid';
  fine.paymentReference = (paymentReference || `CASH-REC-${Date.now()}`).trim();
  fine.paymentDate = paymentDate ? new Date(paymentDate) : new Date();
  fine.paymentMode = paymentMode || 'cash';
  fine.paidAt = new Date();
  await fine.save();

  return res.status(200).json({
    success: true,
    data: fine,
    message: 'Fine payment recorded successfully',
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. STUDENT PORTAL DEDICATED SUMMARY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/library/student/overview
 * Complete student library overview (active loans, reservations, fines).
 */
const getStudentLibraryOverview = asyncHandler(async (req, res) => {
  const student = await resolveCurrentStudent(req);
  if (!student) {
    throw new ApiError(404, 'Student profile not found');
  }

  const [activeLoans, pastLoansCount, pendingReservations, unpaidFines] = await Promise.all([
    LibraryLoan.find({ student: student._id, status: 'active' })
      .populate('book', 'title isbn category authors coverImage shelfNumber')
      .populate('copy', 'accessionNumber condition')
      .sort({ dueDate: 1 }),
    LibraryLoan.countDocuments({ student: student._id, status: 'returned' }),
    BookReservation.find({
      student: student._id,
      status: { $in: ['pending', 'available_for_pickup'] },
    })
      .populate('book', 'title isbn authors category')
      .populate('reservedCopy', 'accessionNumber shelfLocation')
      .sort({ requestDate: 1 }),
    LibraryFine.find({ student: student._id, status: 'pending' }).populate('book', 'title'),
  ]);

  const totalOutstandingFinesInPaise = unpaidFines.reduce((sum, f) => sum + (f.amountInPaise || 0), 0);
  const overdueCount = activeLoans.filter((l) => new Date() > new Date(l.dueDate)).length;

  const policy = await libraryService.getActivePolicy();

  return res.status(200).json({
    success: true,
    data: {
      metrics: {
        activeLoansCount: activeLoans.length,
        maxPermittedLoans: policy.maxBooksPerStudent,
        remainingBorrowQuota: Math.max(0, policy.maxBooksPerStudent - activeLoans.length),
        overdueCount,
        pendingReservationsCount: pendingReservations.length,
        pastLoansCount,
        totalOutstandingFinesInPaise,
        totalOutstandingFinesInRupees: totalOutstandingFinesInPaise / 100,
      },
      activeLoans,
      pendingReservations,
      unpaidFines,
    },
    message: 'Student library overview loaded successfully',
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. ADMIN ANALYTICS & CSV AUDIT EXPORT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/library/admin/metrics
 * Comprehensive administrative statistics on catalog, circulation, and fines.
 */
const getAdminLibraryMetrics = asyncHandler(async (req, res) => {
  const [totalBooks, copyAgg, activeLoansCount, overdueLoansCount, pendingResCount, fineAgg] =
    await Promise.all([
      Book.countDocuments({ status: 'active' }),
      BookCopy.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]),
      LibraryLoan.countDocuments({ status: 'active' }),
      LibraryLoan.countDocuments({ status: 'active', dueDate: { $lt: new Date() } }),
      BookReservation.countDocuments({ status: 'pending' }),
      LibraryFine.aggregate([
        {
          $group: {
            _id: '$status',
            totalAmountInPaise: { $sum: '$amountInPaise' },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

  const copyStats = {
    totalCopies: 0,
    available: 0,
    issued: 0,
    reserved: 0,
    damaged: 0,
    lost: 0,
  };

  for (const c of copyAgg) {
    copyStats.totalCopies += c.count;
    if (copyStats[c._id] !== undefined) {
      copyStats[c._id] = c.count;
    }
  }

  const fineStats = {
    pendingAmountInRupees: 0,
    pendingCount: 0,
    paidAmountInRupees: 0,
    paidCount: 0,
  };

  for (const f of fineAgg) {
    if (f._id === 'pending') {
      fineStats.pendingAmountInRupees = (f.totalAmountInPaise || 0) / 100;
      fineStats.pendingCount = f.count;
    } else if (f._id === 'paid') {
      fineStats.paidAmountInRupees = (f.totalAmountInPaise || 0) / 100;
      fineStats.paidCount = f.count;
    }
  }

  return res.status(200).json({
    success: true,
    data: {
      totalBooks,
      copyStats,
      circulation: {
        activeLoansCount,
        overdueLoansCount,
        pendingResCount,
      },
      fineStats,
    },
    message: 'Admin library metrics loaded successfully',
  });
});

/**
 * GET /api/library/admin/export-csv
 * Export comprehensive book inventory and circulation records with formula injection guards (CWE-1236).
 */
const exportLibraryReportCSV = asyncHandler(async (req, res) => {
  const { type = 'inventory' } = req.query;

  if (type === 'loans') {
    const loans = await LibraryLoan.find({})
      .populate('book', 'title isbn category')
      .populate('copy', 'accessionNumber')
      .populate({
        path: 'student',
        populate: { path: 'user', select: 'name rollNumber loginId' },
      })
      .sort({ createdAt: -1 });

    const headers = [
      'Issue ID',
      'Book Title',
      'ISBN',
      'Accession Number',
      'Student Name',
      'Roll Number',
      'Issue Date',
      'Due Date',
      'Actual Return Date',
      'Status',
      'Renewal Count',
    ];

    const rows = loans.map((l) => [
      libraryService.sanitizeCsvValue(l.issueId),
      libraryService.sanitizeCsvValue(l.book?.title || 'Unknown'),
      libraryService.sanitizeCsvValue(l.book?.isbn || ''),
      libraryService.sanitizeCsvValue(l.copy?.accessionNumber || ''),
      libraryService.sanitizeCsvValue(l.student?.user?.name || 'Student'),
      libraryService.sanitizeCsvValue(l.student?.rollNumber || ''),
      libraryService.sanitizeCsvValue(new Date(l.issueDate).toISOString().slice(0, 10)),
      libraryService.sanitizeCsvValue(new Date(l.dueDate).toISOString().slice(0, 10)),
      libraryService.sanitizeCsvValue(l.actualReturnDate ? new Date(l.actualReturnDate).toISOString().slice(0, 10) : ''),
      libraryService.sanitizeCsvValue(l.status),
      libraryService.sanitizeCsvValue(l.renewalCount),
    ]);

    const csvContent = [headers.map((h) => `"${h}"`).join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=campussphere_library_loans_${Date.now()}.csv`);
    return res.status(200).send(csvContent);
  }

  // Default: Inventory CSV
  const copies = await BookCopy.find({})
    .populate('book', 'title isbn category authors shelfNumber rackNumber location')
    .sort({ accessionNumber: 1 });

  const headers = [
    'Accession Number',
    'Copy ID',
    'Book Title',
    'ISBN',
    'Category',
    'Authors',
    'Condition',
    'Status',
    'Location',
    'Price (INR)',
    'Acquisition Date',
  ];

  const rows = copies.map((c) => [
    libraryService.sanitizeCsvValue(c.accessionNumber),
    libraryService.sanitizeCsvValue(c.copyId),
    libraryService.sanitizeCsvValue(c.book?.title || 'Unknown'),
    libraryService.sanitizeCsvValue(c.book?.isbn || ''),
    libraryService.sanitizeCsvValue(c.book?.category || ''),
    libraryService.sanitizeCsvValue(c.book?.authors?.join('; ') || ''),
    libraryService.sanitizeCsvValue(c.condition),
    libraryService.sanitizeCsvValue(c.status),
    libraryService.sanitizeCsvValue(c.shelfLocation || c.book?.location || ''),
    libraryService.sanitizeCsvValue(c.priceInRupees),
    libraryService.sanitizeCsvValue(new Date(c.acquisitionDate).toISOString().slice(0, 10)),
  ]);

  const csvContent = [headers.map((h) => `"${h}"`).join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=campussphere_library_inventory_${Date.now()}.csv`);
  return res.status(200).send(csvContent);
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. LIBRARY POLICY CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/library/policies
 * Retrieve active circulation policy.
 */
const getPolicy = asyncHandler(async (req, res) => {
  const policy = await libraryService.getActivePolicy();
  return res.status(200).json({
    success: true,
    data: policy,
    message: 'Library policy loaded',
  });
});

/**
 * PATCH /api/library/policies
 * Update library rules (loan limits, fine rates, grace days).
 */
const updatePolicy = asyncHandler(async (req, res) => {
  const policy = await libraryService.getActivePolicy();

  const updatableFields = [
    'maxBooksPerStudent',
    'loanDurationDays',
    'maxRenewals',
    'renewalDurationDays',
    'gracePeriodDays',
    'finePerOverdueDayInPaise',
    'maxFinePerBookInPaise',
    'reservationExpiryDays',
    'allowRenewIfOverdue',
    'allowRenewIfReserved',
  ];

  for (const field of updatableFields) {
    if (req.body[field] !== undefined) {
      policy[field] = req.body[field];
    }
  }

  if (req.body.finePerOverdueDay !== undefined) {
    policy.finePerOverdueDayInPaise = Math.round(Number(req.body.finePerOverdueDay) * 100);
  }

  policy.updatedBy = req.user?.userId || req.user?._id;
  await policy.save();

  return res.status(200).json({
    success: true,
    data: policy,
    message: 'Library circulation policy updated',
  });
});

module.exports = {
  createBook,
  getBooks,
  getBookById,
  updateBook,
  archiveBook,
  addBookCopy,
  getCopies,
  updateCopyStatus,
  issueBook,
  returnBook,
  renewLoan,
  createReservation,
  cancelReservation,
  getReservations,
  getFines,
  waiveFine,
  recordFinePayment,
  getStudentLibraryOverview,
  getAdminLibraryMetrics,
  exportLibraryReportCSV,
  exportInventoryCsv: exportLibraryReportCSV,
  exportCirculationCsv: exportLibraryReportCSV,
  getPolicy,
  updatePolicy,
};
