/**
 * server/routes/transport.routes.js
 * Express router for CampusSphere AI Transport Management System.
 */
'use strict';

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const { allowRoles } = require('../middleware/role.middleware');

const {
  createVehicle,
  getVehicles,
  getVehicleById,
  updateVehicle,
  archiveVehicle,
  createRoute,
  getRoutes,
  getRouteById,
  updateRoute,
  assignVehicleAndStaffToRoute,
  createStop,
  getStops,
  createStaffRecord,
  getStaffRecords,
  createApplication,
  getApplications,
  reviewApplication,
  allocateStudent,
  getAllocations,
  cancelAllocation,
  createTrip,
  getTrips,
  updateTripStatus,
  recordMaintenance,
  getMaintenanceRecords,
  reportIncident,
  getIncidents,
  getTransportPolicy,
  updateTransportPolicy,
  getStudentTransportOverview,
  getTransportMetrics,
  exportTransportCsv,
} = require('../controllers/transport.controller');

// All transport routes require authentication
router.use(authMiddleware);

// ── 1. Student Portal Overview ───────────────────────────────────────────────
router.get('/student/overview', allowRoles('student'), getStudentTransportOverview);

// ── 2. Admin & Manager Metrics and CSV Exports ──────────────────────────────
router.get('/admin/metrics', allowRoles('admin', 'transport_manager'), getTransportMetrics);
router.get('/reports/export', allowRoles('admin', 'transport_manager'), exportTransportCsv);

// ── 3. Policy Settings ───────────────────────────────────────────────────────
router.get('/policy', allowRoles('admin', 'transport_manager', 'student'), getTransportPolicy);
router.patch('/policy', allowRoles('admin', 'transport_manager'), updateTransportPolicy);

// ── 4. Vehicles Management ───────────────────────────────────────────────────
router.post('/vehicles', allowRoles('admin', 'transport_manager'), createVehicle);
router.get('/vehicles', allowRoles('admin', 'transport_manager', 'driver', 'attendant', 'student'), getVehicles);
router.get('/vehicles/:id', allowRoles('admin', 'transport_manager', 'driver', 'attendant'), getVehicleById);
router.patch('/vehicles/:id', allowRoles('admin', 'transport_manager'), updateVehicle);
router.delete('/vehicles/:id', allowRoles('admin', 'transport_manager'), archiveVehicle);

// ── 5. Routes & Stops Management ─────────────────────────────────────────────
router.post('/routes', allowRoles('admin', 'transport_manager'), createRoute);
router.get('/routes', allowRoles('admin', 'transport_manager', 'student', 'faculty', 'driver', 'attendant'), getRoutes);
router.get('/routes/:id', allowRoles('admin', 'transport_manager', 'student', 'faculty', 'driver', 'attendant'), getRouteById);
router.patch('/routes/:id', allowRoles('admin', 'transport_manager'), updateRoute);
router.post('/routes/:id/assign', allowRoles('admin', 'transport_manager'), assignVehicleAndStaffToRoute);
router.post('/routes/:id/stops', allowRoles('admin', 'transport_manager'), createStop);
router.get('/routes/:id/stops', allowRoles('admin', 'transport_manager', 'student', 'faculty', 'driver', 'attendant'), getStops);

// ── 6. Staff (Drivers & Attendants) ──────────────────────────────────────────
router.post('/staff', allowRoles('admin', 'transport_manager'), createStaffRecord);
router.get('/staff', allowRoles('admin', 'transport_manager'), getStaffRecords);

// ── 7. Student Applications ──────────────────────────────────────────────────
router.post('/applications', allowRoles('student'), createApplication);
router.get('/applications', allowRoles('admin', 'transport_manager', 'student'), getApplications);
router.patch('/applications/:id/review', allowRoles('admin', 'transport_manager'), reviewApplication);

// ── 8. Student Route Allocation ──────────────────────────────────────────────
router.post('/allocations', allowRoles('admin', 'transport_manager'), allocateStudent);
router.get('/allocations', allowRoles('admin', 'transport_manager', 'student'), getAllocations);
router.post('/allocations/:id/cancel', allowRoles('admin', 'transport_manager', 'student'), cancelAllocation);

// ── 9. Daily Trip Operations ─────────────────────────────────────────────────
router.post('/trips', allowRoles('admin', 'transport_manager', 'driver'), createTrip);
router.get('/trips', allowRoles('admin', 'transport_manager', 'driver', 'attendant', 'student'), getTrips);
router.patch('/trips/:id', allowRoles('admin', 'transport_manager', 'driver'), updateTripStatus);

// ── 10. Vehicle Maintenance ──────────────────────────────────────────────────
router.post('/maintenance', allowRoles('admin', 'transport_manager'), recordMaintenance);
router.get('/maintenance', allowRoles('admin', 'transport_manager'), getMaintenanceRecords);

// ── 11. Transport Incidents ──────────────────────────────────────────────────
router.post('/incidents', allowRoles('admin', 'transport_manager', 'driver', 'attendant', 'student'), reportIncident);
router.get('/incidents', allowRoles('admin', 'transport_manager'), getIncidents);

module.exports = router;

