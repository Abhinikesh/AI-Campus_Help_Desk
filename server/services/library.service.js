/**
 * server/services/library.service.js
 * Library Circulation Business Logic, Overdue Calculations, Fair Queueing & Inventory Synchronizer.
 */
'use strict';

const mongoose = require('mongoose');
const Book = require('../models/Book');
const BookCopy = require('../models/BookCopy');
const LibraryPolicy = require('../models/LibraryPolicy');
const BookReservation = require('../models/BookReservation');
const notificationService = require('./notification.service');

class LibraryService {
  /**
   * Retrieves the current active library circulation policy.
   * Creates sensible institutional defaults if no policy exists.
   * @returns {Promise<Object>}
   */
  async getActivePolicy() {
    let policy = await LibraryPolicy.findOne({ status: 'active', isDefault: true });
    if (!policy) {
      policy = await LibraryPolicy.findOne({ status: 'active' });
    }
    if (!policy) {
      policy = await LibraryPolicy.create({
        name: 'Standard Institutional Library Policy',
        code: 'DEFAULT',
        maxBooksPerStudent: 3,
        loanDurationDays: 14,
        maxRenewals: 2,
        renewalDurationDays: 14,
        gracePeriodDays: 1,
        finePerOverdueDayInPaise: 500, // ₹5/day
        maxFinePerBookInPaise: 100000, // ₹1,000 cap
        reservationExpiryDays: 3,
        allowRenewIfOverdue: false,
        allowRenewIfReserved: false,
        isDefault: true,
        status: 'active',
      });
    }
    return policy;
  }

  /**
   * Recalculates and synchronizes available, issued, reserved, and total copies on Book document.
   * @param {string|mongoose.Types.ObjectId} bookId
   * @returns {Promise<Object>} updated book
   */
  async syncBookCounts(bookId) {
    const copies = await BookCopy.find({ book: bookId });
    const totalCopies = copies.filter((c) => c.status !== 'withdrawn').length;
    const availableCopies = copies.filter((c) => c.status === 'available').length;
    const issuedCopies = copies.filter((c) => c.status === 'issued').length;
    const reservedCopies = copies.filter((c) => c.status === 'reserved').length;

    const book = await Book.findByIdAndUpdate(
      bookId,
      {
        totalCopies,
        availableCopies,
        issuedCopies,
        reservedCopies,
      },
      { new: true }
    );
    return book;
  }

  /**
   * Calculates overdue fine in integer paise based on loan policy snapshot.
   * @param {Object} loan - LibraryLoan document
   * @param {Date} [returnDate=new Date()]
   * @returns {{ overdueDays: number, graceDays: number, fineInPaise: number, ratePerDayInPaise: number }}
   */
  calculateOverdueFine(loan, returnDate = new Date(), customPolicy = null) {
    if (!loan || !loan.dueDate) {
      return { overdueDays: 0, graceDays: 0, fineInPaise: 0, fineAmountInPaise: 0, ratePerDayInPaise: 0 };
    }

    const dueTime = new Date(loan.dueDate).getTime();
    const retTime = new Date(returnDate).getTime();

    if (retTime <= dueTime) {
      return { overdueDays: 0, graceDays: 0, fineInPaise: 0, fineAmountInPaise: 0, ratePerDayInPaise: 0 };
    }

    const diffDays = Math.floor((retTime - dueTime) / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) {
      return { overdueDays: 0, graceDays: 0, fineInPaise: 0, fineAmountInPaise: 0, ratePerDayInPaise: 0 };
    }

    const policy = customPolicy || loan.policySnapshot || {};
    const graceDays = Number(policy.gracePeriodDays ?? 1);
    const ratePerDay = Number(policy.finePerOverdueDayInPaise ?? 500);
    const maxCap = Number(policy.maxFinePerBookInPaise ?? 100000);

    if (diffDays <= graceDays) {
      return { overdueDays: diffDays, graceDays, fineInPaise: 0, fineAmountInPaise: 0, ratePerDayInPaise: ratePerDay };
    }

    const rawFine = diffDays * ratePerDay;
    const fineInPaise = Math.min(rawFine, maxCap);

    return {
      overdueDays: diffDays,
      graceDays,
      fineInPaise,
      fineAmountInPaise: fineInPaise,
      ratePerDayInPaise: ratePerDay,
    };
  }

  /**
   * Checks the reservation queue when a physical copy becomes available.
   * Automatically allocates copy to next pending student in fair FIFO order.
   * @param {string|mongoose.Types.ObjectId} bookId
   * @param {Object} copy - BookCopy document that became free
   * @param {Object} [policy] - Active policy
   * @returns {Promise<Object|null>} reservation if allocated
   */
  async processNextReservation(bookId, copy, policy = null) {
    const activePolicy = policy || (await this.getActivePolicy());

    // Find earliest pending reservation for this book
    const nextReservation = await BookReservation.findOne({
      book: bookId,
      status: 'pending',
    })
      .sort({ requestDate: 1 })
      .populate({
        path: 'student',
        populate: { path: 'user', select: 'name email loginId' },
      })
      .populate('book', 'title');

    if (!nextReservation) {
      // No pending reservations: copy becomes available for open borrowing
      copy.status = 'available';
      copy.currentReservation = null;
      await copy.save();
      await this.syncBookCounts(bookId);
      return null;
    }

    // Allocate copy to the reservation
    const expiryDays = activePolicy.reservationExpiryDays || 3;
    const deadline = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

    copy.status = 'reserved';
    copy.currentReservation = nextReservation._id;
    await copy.save();

    nextReservation.status = 'available_for_pickup';
    nextReservation.reservedCopy = copy._id;
    nextReservation.notifiedAt = new Date();
    nextReservation.pickupDeadline = deadline;
    await nextReservation.save();

    await this.syncBookCounts(bookId);

    // Notify reserved student
    const studentUser = nextReservation.student?.user;
    if (studentUser?._id || studentUser) {
      const recipientId = studentUser._id || studentUser;
      try {
        await notificationService.createNotification({
          recipient: recipientId,
          title: 'Reserved Book Available for Pickup',
          message: `Your reserved copy of "${nextReservation.book?.title || 'Book'}" is held for you at Central Library. Please collect by ${deadline.toLocaleDateString()}.`,
          category: 'library',
          priority: 'high',
          relatedEntityType: 'book_reservation',
          relatedEntityId: nextReservation._id,
          targetRoute: '/student/library',
          actorName: 'Central Library Desk',
          actorRole: 'admin',
          eventId: `lib_res_pickup_${nextReservation._id}`,
        });
      } catch (err) {
        console.warn('⚠️ Reservation notification failed:', err.message);
      }
    }

    return nextReservation;
  }

  /**
   * Calculates the exact integer 1-based queue position for a pending reservation.
   * @param {string|mongoose.Types.ObjectId} reservationId
   * @param {string|mongoose.Types.ObjectId} bookId
   * @param {Date} requestDate
   * @returns {Promise<number>} 1-based position
   */
  async getReservationQueuePosition(reservationId, bookId, requestDate) {
    const reqDate = new Date(requestDate);
    const priorCount = await BookReservation.countDocuments({
      book: bookId,
      status: 'pending',
      $or: [
        { requestDate: { $lt: reqDate } },
        { requestDate: reqDate, _id: { $lt: reservationId } },
      ],
    });
    return priorCount + 1;
  }

  /**
   * Sanitizes input string to prevent CSV / Formula Injection attacks (CWE-1236).
   * @param {string|number|null|undefined} cell
   * @returns {string} Safe CSV cell string
   */
  sanitizeCsvValue(cell) {
    if (cell === null || cell === undefined) return '""';
    let str = String(cell).trim();
    if (/^[=+\-@\t\r]/.test(str)) {
      str = `'${str}`;
    }
    const escaped = str.replace(/"/g, '""');
    return `"${escaped}"`;
  }
}

module.exports = new LibraryService();
