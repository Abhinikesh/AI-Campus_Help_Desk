/**
 * server/models/Book.js
 * Bibliographic Book Catalog Entity.
 */
'use strict';

const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Book title is required'],
      trim: true,
      maxlength: [300, 'Title cannot exceed 300 characters'],
      index: true,
    },
    subtitle: {
      type: String,
      default: '',
      trim: true,
      maxlength: [300, 'Subtitle cannot exceed 300 characters'],
    },
    isbn: {
      type: String,
      default: '',
      trim: true,
      uppercase: true,
      index: true,
    },
    authors: {
      type: [String],
      required: [true, 'At least one author is required'],
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0 && v.every((a) => a && a.trim()),
        message: 'At least one author is required',
      },
    },
    publisher: {
      type: String,
      default: '',
      trim: true,
    },
    edition: {
      type: String,
      default: '',
      trim: true,
    },
    publicationYear: {
      type: Number,
      min: [1000, 'Invalid publication year'],
      max: [new Date().getFullYear() + 2, 'Publication year cannot be far in the future'],
      default: null,
    },
    language: {
      type: String,
      default: 'English',
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
      index: true,
    },
    subject: {
      type: String,
      default: '',
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    coverImage: {
      type: String,
      default: '',
      trim: true,
    },
    shelfNumber: {
      type: String,
      default: '',
      trim: true,
    },
    rackNumber: {
      type: String,
      default: '',
      trim: true,
    },
    location: {
      type: String,
      default: 'Central Library - Main Stack',
      trim: true,
    },
    totalCopies: {
      type: Number,
      default: 0,
      min: [0, 'Total copies cannot be negative'],
    },
    availableCopies: {
      type: Number,
      default: 0,
      min: [0, 'Available copies cannot be negative'],
    },
    issuedCopies: {
      type: Number,
      default: 0,
      min: [0, 'Issued copies cannot be negative'],
    },
    reservedCopies: {
      type: Number,
      default: 0,
      min: [0, 'Reserved copies cannot be negative'],
    },
    status: {
      type: String,
      enum: ['active', 'archived'],
      default: 'active',
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

// Full-text search index for catalog lookup
bookSchema.index(
  {
    title: 'text',
    subtitle: 'text',
    authors: 'text',
    isbn: 'text',
    category: 'text',
    subject: 'text',
  },
  {
    weights: {
      title: 10,
      isbn: 8,
      authors: 6,
      category: 4,
      subject: 3,
      subtitle: 2,
    },
    name: 'BookTextSearchIndex',
  }
);

bookSchema.index({ category: 1, status: 1 });
bookSchema.index({ availableCopies: 1, status: 1 });

module.exports = mongoose.model('Book', bookSchema);

