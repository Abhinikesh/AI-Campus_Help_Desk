/**
 * server/tests/redos_and_search_security.test.js
 * Comprehensive Security Test Suite for Inventory and HR Search ReDoS Remediation.
 */
'use strict';

require('dotenv').config();
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const {
  escapeRegex,
  createSafeRegex,
  sanitizePagination,
  DEFAULT_MAX_SEARCH_LENGTH
} = require('../utils/safeSearch.util');

const InventoryLocation = require('../models/InventoryLocation');
const Asset = require('../models/Asset');
const StockItem = require('../models/StockItem');
const Vendor = require('../models/Vendor');
const Department = require('../models/Department');
const Designation = require('../models/Designation');
const EmployeeProfile = require('../models/EmployeeProfile');
const User = require('../models/User');

const inventoryController = require('../controllers/inventory.controller');
const hrController = require('../controllers/hr.controller');

let mongod;
let adminUser, staffUser, studentUser;
let testDept, testDesig, testLocation;

function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    set(key, val) {
      this.headers[key] = val;
      return this;
    }
  };
}

before(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri, { dbName: 'test_redos_security' });

  // 1. Synthetic Users
  adminUser = await User.create({
    name: 'Inventory Admin',
    email: 'inv_admin@test.local',
    loginId: 'INV_ADMIN',
    role: 'admin',
    passwordHash: 'mock-hash'
  });

  staffUser = await User.create({
    name: 'Inventory Manager',
    email: 'inv_mgr@test.local',
    loginId: 'INV_MGR',
    role: 'inventory_manager',
    passwordHash: 'mock-hash'
  });

  studentUser = await User.create({
    name: 'Student User',
    email: 'student@test.local',
    loginId: 'STU001',
    role: 'student',
    passwordHash: 'mock-hash'
  });

  // 2. Synthetic Department & Designation
  testDept = await Department.create({
    name: 'Computer Science & Engineering',
    code: 'CSE-SEC',
    type: 'academic',
    isActive: true
  });

  testDesig = await Designation.create({
    name: 'Senior Lecturer',
    title: 'Senior Lecturer',
    code: 'SR_LECT',
    category: 'teaching_faculty',
    department: testDept._id
  });

  // 3. Synthetic Inventory Location
  testLocation = await InventoryLocation.create({
    name: 'Advanced Computing Lab [Lab-B]',
    code: 'LOC-SEC-01',
    type: 'laboratory',
    building: 'Science & Tech Complex (Block-C)',
    roomNumber: 'B-204',
    department: testDept._id,
    isActive: true
  });

  // 4. Synthetic Assets
  await Asset.create({
    assetId: 'AST-LTP-001',
    name: 'Lenovo ThinkPad [P15s Gen 2]',
    serialNumber: 'SN+LNV-9876',
    model: 'ThinkPad-P15s',
    category: new mongoose.Types.ObjectId(),
    currentLocation: testLocation._id,
    assignedTo: staffUser._id,
    status: 'assigned',
    condition: 'good',
    purchaseCost: 125000,
    purchasedAt: new Date()
  });

  await Asset.create({
    assetId: 'AST-SRV-002',
    name: 'Dell PowerEdge Rack Server',
    serialNumber: 'SN-DLL.7788',
    model: 'PowerEdge-R750',
    category: new mongoose.Types.ObjectId(),
    currentLocation: testLocation._id,
    assignedTo: staffUser._id,
    status: 'assigned',
    condition: 'good',
    purchaseCost: 450000,
    purchasedAt: new Date()
  });

  // 5. Synthetic Stock Items
  await StockItem.create({
    sku: 'SKU.PAP.A4',
    name: 'Executive Bond Paper (A4 / 85 GSM)',
    category: new mongoose.Types.ObjectId(),
    location: testLocation._id,
    currentQuantity: 50,
    reorderThreshold: 10,
    unit: 'packs',
    unitPrice: 35000,
    isActive: true
  });

  // 6. Synthetic Vendor
  await Vendor.create({
    vendorCode: 'VND*ELC*001',
    name: 'Apex Hardware & Electro-Supplies (Pvt) Ltd',
    contactPerson: 'Mr. R. K. Sharma (Director)',
    email: 'contact@apex-supplies.local',
    phone: '9876543210',
    isActive: true
  });

  // 7. Synthetic Employee Profile
  await EmployeeProfile.create({
    employeeId: 'EMP.SEC.101',
    user: staffUser._id,
    firstName: 'Arvind',
    lastName: 'Sharma (Research Fellow)',
    displayName: 'Dr. Arvind Sharma',
    officialEmail: 'arvind.sharma@test.local',
    phone: '9876500001',
    employeeCategory: 'teaching_faculty',
    department: testDept._id,
    designation: testDesig._id,
    employmentType: 'permanent',
    employmentStatus: 'active',
    joiningDate: new Date('2021-01-15')
  });
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('1. Safe Search Utility Unit Tests', () => {
  test('1.1 escapeRegex escapes all regex metacharacters properly', () => {
    const metacharacters = '.*+?^${}()|[\\]';
    const escaped = escapeRegex(metacharacters);
    assert.strictEqual(escaped, '\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\\\\\]');

    // Verify it compiles and only matches the literal string
    const literalRe = new RegExp(escaped);
    assert.strictEqual(literalRe.test(metacharacters), true);
    assert.strictEqual(literalRe.test('any random string'), false);
  });

  test('1.2 escapeRegex handles non-string inputs safely without crashing', () => {
    assert.strictEqual(escapeRegex(null), '');
    assert.strictEqual(escapeRegex(undefined), '');
    assert.strictEqual(escapeRegex(12345), '');
    assert.strictEqual(escapeRegex({ $gt: '' }), '');
    assert.strictEqual(escapeRegex(['abc']), '');
  });

  test('1.3 createSafeRegex returns null for empty or whitespace-only inputs', () => {
    assert.strictEqual(createSafeRegex(null), null);
    assert.strictEqual(createSafeRegex(undefined), null);
    assert.strictEqual(createSafeRegex(''), null);
    assert.strictEqual(createSafeRegex('     '), null);
    assert.strictEqual(createSafeRegex('\t\n'), null);
  });

  test('1.4 createSafeRegex returns bounded case-insensitive RegExp for valid strings', () => {
    const regex = createSafeRegex(' ThinkPad ');
    assert.ok(regex instanceof RegExp);
    assert.strictEqual(regex.source, 'ThinkPad');
    assert.strictEqual(regex.flags, 'i');
    assert.strictEqual(regex.test('lenovo thinkpad laptop'), true);
    assert.strictEqual(regex.test('LENOVO THINKPAD'), true);
    assert.strictEqual(regex.test('dell laptop'), false);
  });

  test('1.5 createSafeRegex throws 400 Bad Request on non-string inputs (operator injection prevention)', () => {
    assert.throws(
      () => createSafeRegex({ $gt: '' }, { paramName: 'Search' }),
      (err) => err.statusCode === 400 && err.message.includes('Search must be a valid text string')
    );
    assert.throws(
      () => createSafeRegex(['nested'], { paramName: 'Building' }),
      (err) => err.statusCode === 400 && err.message.includes('Building must be a valid text string')
    );
  });

  test('1.6 createSafeRegex throws 400 Bad Request when input exceeds maxSearchLength', () => {
    const longString = 'a'.repeat(DEFAULT_MAX_SEARCH_LENGTH + 1);
    assert.throws(
      () => createSafeRegex(longString, { paramName: 'Search query' }),
      (err) => err.statusCode === 400 && err.message.includes('cannot exceed 100 characters')
    );

    // Exact limit should succeed
    const exactString = 'a'.repeat(DEFAULT_MAX_SEARCH_LENGTH);
    const validRegex = createSafeRegex(exactString);
    assert.ok(validRegex instanceof RegExp);
  });

  test('1.7 createSafeRegex neutralizes pathological ReDoS patterns', () => {
    const redosPayloads = [
      '((((a+)+)+)+)+$',
      '([a-zA-Z0-9]+)*$',
      '(a*)*b',
      'a{1,100}{1,100}'
    ];

    for (const payload of redosPayloads) {
      const safe = createSafeRegex(payload);
      assert.ok(safe instanceof RegExp);
      // Ensure metacharacters are escaped in regex source
      assert.ok(safe.source.includes('\\(') || safe.source.includes('\\{') || safe.source.includes('\\*'));
    }
  });

  test('1.8 sanitizePagination clamps and bounds page and limit parameters', () => {
    // Normal bounds
    const normal = sanitizePagination('2', '25', 20, 100);
    assert.strictEqual(normal.page, 2);
    assert.strictEqual(normal.limit, 25);
    assert.strictEqual(normal.skip, 25);

    // Excessive limit clamped to maxLimit (100)
    const excessive = sanitizePagination('1', '999999', 20, 100);
    assert.strictEqual(excessive.limit, 100);

    // Negative and invalid values fall back safely
    const negative = sanitizePagination('-5', '0', 20, 100);
    assert.strictEqual(negative.page, 1);
    assert.strictEqual(negative.limit, 20);
    assert.strictEqual(negative.skip, 0);

    const malformed = sanitizePagination('abc', 'xyz', 50, 100);
    assert.strictEqual(malformed.page, 1);
    assert.strictEqual(malformed.limit, 50);
  });
});

describe('2. Inventory Controller ReDoS & Safe Search Integration Tests', () => {
  test('2.1 getLocations: literal search with metacharacters in building parameter', async () => {
    // Exact literal match with parentheses: 'Science & Tech Complex (Block-C)'
    const req = {
      user: staffUser,
      query: { building: '(Block-C)' }
    };
    const res = createMockRes();

    await inventoryController.getLocations(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.count, 1);
    assert.strictEqual(res.body.data[0].code, 'LOC-SEC-01');
  });

  test('2.2 getLocations: rejects non-string building parameter with 400 Bad Request', async () => {
    const req = {
      user: staffUser,
      query: { building: { $ne: null } }
    };
    const res = createMockRes();

    await inventoryController.getLocations(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
    assert.ok(res.body.message.includes('must be a valid text string'));
  });

  test('2.3 getLocations: rejects overlong building parameter (> 100 chars) with 400', async () => {
    const req = {
      user: staffUser,
      query: { building: 'B'.repeat(101) }
    };
    const res = createMockRes();

    await inventoryController.getLocations(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
    assert.ok(res.body.message.includes('cannot exceed 100 characters'));
  });

  test('2.4 getAssets: literal search matching brackets and plus signs', async () => {
    // Search with brackets '[P15s Gen 2]'
    const req1 = {
      user: staffUser,
      query: { search: '[P15s Gen 2]' }
    };
    const res1 = createMockRes();

    await inventoryController.getAssets(req1, res1);
    assert.strictEqual(res1.statusCode, 200);
    assert.strictEqual(res1.body.success, true);
    assert.strictEqual(res1.body.data.length, 1);
    assert.strictEqual(res1.body.data[0].assetId, 'AST-LTP-001');

    // Search with plus sign 'SN+LNV'
    const req2 = {
      user: staffUser,
      query: { search: 'SN+LNV' }
    };
    const res2 = createMockRes();

    await inventoryController.getAssets(req2, res2);
    assert.strictEqual(res2.statusCode, 200);
    assert.strictEqual(res2.body.success, true);
    assert.strictEqual(res2.body.data.length, 1);
    assert.strictEqual(res2.body.data[0].assetId, 'AST-LTP-001');
  });

  test('2.5 getAssets: pathological ReDoS pattern executes safely in linear time', async () => {
    const startTime = Date.now();
    const req = {
      user: staffUser,
      query: { search: '((((((((((a+)+)+)+)+)+)+)+)+)+)+' }
    };
    const res = createMockRes();

    await inventoryController.getAssets(req, res);
    const elapsed = Date.now() - startTime;

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.length, 0); // No literal match
    assert.ok(elapsed < 200, `Execution took too long: ${elapsed}ms`);
  });

  test('2.6 getAssets: pagination limit clamped to max 100', async () => {
    const req = {
      user: staffUser,
      query: { page: '1', limit: '500' }
    };
    const res = createMockRes();

    await inventoryController.getAssets(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.pagination.limit, 100);
  });

  test('2.7 getStockItems: literal search matching dots and parentheses', async () => {
    const req = {
      user: staffUser,
      query: { search: 'SKU.PAP' }
    };
    const res = createMockRes();

    await inventoryController.getStockItems(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.count, 1);
    assert.strictEqual(res.body.data[0].sku, 'SKU.PAP.A4');
  });

  test('2.8 getStockItems: rejects operator injection { $gt: "" } with 400', async () => {
    const req = {
      user: staffUser,
      query: { search: { $gt: '' } }
    };
    const res = createMockRes();

    await inventoryController.getStockItems(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
    assert.ok(res.body.message.includes('must be a valid text string'));
  });

  test('2.9 getVendors: literal search matching asterisk and ampersand', async () => {
    const req = {
      user: adminUser,
      query: { search: 'VND*ELC' }
    };
    const res = createMockRes();

    await inventoryController.getVendors(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.count, 1);
    assert.strictEqual(res.body.data[0].vendorCode, 'VND*ELC*001');
  });
});

describe('3. HR Controller ReDoS & Safe Search Integration Tests', () => {
  test('3.1 getEmployees: literal search matching employeeId with dot and parenthetical name', async () => {
    const req1 = {
      user: adminUser,
      query: { search: 'EMP.SEC' }
    };
    const res1 = createMockRes();

    await hrController.getEmployees(req1, res1);
    assert.strictEqual(res1.statusCode, 200);
    assert.strictEqual(res1.body.success, true);
    assert.strictEqual(res1.body.count, 1);
    assert.strictEqual(res1.body.data[0].employeeId, 'EMP.SEC.101');

    const req2 = {
      user: adminUser,
      query: { search: '(Research Fellow)' }
    };
    const res2 = createMockRes();

    await hrController.getEmployees(req2, res2);
    assert.strictEqual(res2.statusCode, 200);
    assert.strictEqual(res2.body.success, true);
    assert.strictEqual(res2.body.count, 1);
  });

  test('3.2 getEmployees: rejects ReDoS search pattern > 100 chars with 400', async () => {
    const req = {
      user: adminUser,
      query: { search: 'E'.repeat(101) }
    };
    const res = createMockRes();

    await hrController.getEmployees(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
    assert.ok(res.body.message.includes('cannot exceed 100 characters'));
  });

  test('3.3 getEmployees: rejects operator injection { $where: "..." } with 400', async () => {
    const req = {
      user: adminUser,
      query: { search: { $where: 'sleep(1000)' } }
    };
    const res = createMockRes();

    await hrController.getEmployees(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
    assert.ok(res.body.message.includes('must be a valid text string'));
  });

  test('3.4 getEmployees: case-insensitive matching works as intended', async () => {
    const reqUpper = {
      user: adminUser,
      query: { search: 'ARVIND' }
    };
    const resUpper = createMockRes();
    await hrController.getEmployees(reqUpper, resUpper);
    assert.strictEqual(resUpper.statusCode, 200);
    assert.strictEqual(resUpper.body.count, 1);

    const reqLower = {
      user: adminUser,
      query: { search: 'arvind' }
    };
    const resLower = createMockRes();
    await hrController.getEmployees(reqLower, resLower);
    assert.strictEqual(resLower.statusCode, 200);
    assert.strictEqual(resLower.body.count, 1);
  });

  test('3.5 getEmployees: literal ".*" does NOT act as a wildcard', async () => {
    const req = {
      user: adminUser,
      query: { search: '.*' }
    };
    const res = createMockRes();

    await hrController.getEmployees(req, res);
    assert.strictEqual(res.statusCode, 200);
    // Because no employee literally has ".*" in their name, email, or ID, count must be 0!
    assert.strictEqual(res.body.count, 0);
  });
});

describe('4. RBAC and Anti-Tampering Security Tests', () => {
  const { allowRoles } = require('../middleware/role.middleware');

  test('4.1 Inventory search endpoints reject unauthorized student role with 403 Forbidden', () => {
    const middleware = allowRoles('admin', 'inventory_manager', 'procurement_officer', 'storekeeper');
    const req = { user: { role: 'student' } };
    const res = createMockRes();
    let nextCalled = false;

    middleware(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.message, 'Access denied for your role');
  });

  test('4.2 Inventory search endpoints permit authorized inventory_manager role', () => {
    const middleware = allowRoles('admin', 'inventory_manager', 'procurement_officer', 'storekeeper');
    const req = { user: { role: 'inventory_manager' } };
    const res = createMockRes();
    let nextCalled = false;

    middleware(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, true);
  });

  test('4.3 HR Employee directory search rejects unauthorized student role with 403 Forbidden', () => {
    const middleware = allowRoles('admin', 'hr_admin', 'hr_officer', 'department_head');
    const req = { user: { role: 'student' } };
    const res = createMockRes();
    let nextCalled = false;

    middleware(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 403);
  });

  test('4.4 Unauthenticated request returns 401 Not authenticated', () => {
    const middleware = allowRoles('admin', 'inventory_manager');
    const req = {}; // No req.user
    const res = createMockRes();
    let nextCalled = false;

    middleware(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 401);
  });
});
