/**
 * server/models/TransportVehicle.js
 * Centralized Vehicle Inventory for Campus Transport Management.
 */
'use strict';

const mongoose = require('mongoose');

const documentDetailSchema = new mongoose.Schema(
  {
    documentNumber: { type: String, default: '', trim: true },
    providerOrAuthority: { type: String, default: '', trim: true },
    issuedDate: { type: Date, default: null },
    expiryDate: { type: Date, default: null },
    verified: { type: Boolean, default: false },
    notes: { type: String, default: '', trim: true },
  },
  { _id: false }
);

const transportVehicleSchema = new mongoose.Schema(
  {
    registrationNumber: {
      type: String,
      required: [true, 'Vehicle registration number is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    vehicleCode: {
      type: String,
      required: [true, 'Internal vehicle code is required (e.g. BUS-01)'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    vehicleType: {
      type: String,
      enum: ['bus', 'mini_bus', 'van', 'electric_bus', 'shuttle'],
      default: 'bus',
    },
    makeAndModel: {
      type: String,
      required: [true, 'Vehicle make and model is required'],
      trim: true,
    },
    seatingCapacity: {
      type: Number,
      required: [true, 'Seating passenger capacity is required'],
      min: [1, 'Capacity must be at least 1'],
    },
    ownershipType: {
      type: String,
      enum: ['institution_owned', 'contracted'],
      default: 'institution_owned',
    },
    documents: {
      insurance: { type: documentDetailSchema, default: () => ({}) },
      permit: { type: documentDetailSchema, default: () => ({}) },
      fitnessCertificate: { type: documentDetailSchema, default: () => ({}) },
      pollutionCertificate: { type: documentDetailSchema, default: () => ({}) },
    },
    assignedRoute: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TransportRoute',
      default: null,
    },
    assignedDriver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    assignedAttendant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'under_maintenance', 'out_of_service', 'retired'],
      default: 'active',
      index: true,
    },
    maintenanceStatus: {
      type: String,
      enum: ['good', 'service_due', 'critical_repair'],
      default: 'good',
    },
    fuelType: {
      type: String,
      enum: ['diesel', 'cng', 'electric', 'petrol'],
      default: 'diesel',
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

transportVehicleSchema.index({ status: 1, ownershipType: 1 });

module.exports = mongoose.model('TransportVehicle', transportVehicleSchema);

