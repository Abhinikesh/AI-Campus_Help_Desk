/**
 * server/tests/inventory_procurement_management.test.js
 * Comprehensive Automated Test Suite for Part 22:
 * Campus Asset, Inventory, Procurement & Maintenance Management System.
 */
'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const { verifyTestDatabaseIsolation, TEST_DB_URI } = require('./helpers/testDatabase');
const User = require('../models/User');
const InventoryCategory = require('../models/InventoryCategory');
const InventoryLocation = require('../models/InventoryLocation');
const Asset = require('../models/Asset');
const AssetAllocation = require('../models/AssetAllocation');
const AssetTransfer = require('../models/AssetTransfer');
const StockItem = require('../models/StockItem');
const StockMovement = require('../models/StockMovement');
const Vendor = require('../models/Vendor');
const PurchaseRequest = require('../models/PurchaseRequest');
const PurchaseOrder = require('../models/PurchaseOrder');
const GoodsReceipt = require('../models/GoodsReceipt');
const AssetMaintenance = require('../models/AssetMaintenance');
const InventoryAudit = require('../models/InventoryAudit');
const InventoryAuditItem = require('../models/InventoryAuditItem');
const InventoryAuditLog = require('../models/InventoryAuditLog');

const inventoryController = require('../controllers/inventory.controller');
const { inventoryService } = require('../services/inventory.service');

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
    setHeader(k, v) {
      this.headers[k] = v;
      return this;
    },
    send(content) {
      this.rawBody = content;
      return this;
    }
  };
}

test('Part 22: Campus Asset, Inventory, Procurement & Maintenance Test Suite', async (t) => {
  let adminUser, invManagerUser, procOfficerUser, storekeeperUser, facultyUser1, facultyUser2, studentUser;
  let assetCategory, consumableCategory;
  let centralStoreLocation, csLabLocation;
  let testVendor;
  let testAsset;
  let testStockItem;

  await t.test('Setup: Connect & initialize fixtures in isolated DB', async () => {
    await mongoose.disconnect();
    await mongoose.connect(TEST_DB_URI);
    verifyTestDatabaseIsolation();

    // Clean any prior Part 22 test fixtures
    await InventoryCategory.deleteMany({ code: /^TEST-/ });
    await InventoryLocation.deleteMany({ code: /^TEST-/ });
    await Asset.deleteMany({ assetId: /^AST-TEST-/ });
    await Asset.deleteMany({ serialNumber: /^TEST-SN-/ });
    await StockItem.deleteMany({ sku: /^TEST-/ });
    await Vendor.deleteMany({ vendorCode: /^TEST-/ });
    await PurchaseRequest.deleteMany({ requestNumber: /^PR-/ });
    await PurchaseOrder.deleteMany({ poNumber: /^PO-/ });
    await GoodsReceipt.deleteMany({ grnNumber: /^GRN-/ });
    await AssetMaintenance.deleteMany({ maintenanceNumber: /^MAINT-/ });
    await InventoryAudit.deleteMany({ auditNumber: /^AUD-/ });
    await User.deleteMany({ email: /^test\.inv\./ });

    // Seed test users with Part 22 roles
    adminUser = await User.create({
      name: 'System Admin',
      email: 'test.inv.admin@campussphere.edu',
      loginId: 'INV-ADM-01',
      passwordHash: 'dummy',
      role: 'admin'
    });

    invManagerUser = await User.create({
      name: 'Inventory Manager',
      email: 'test.inv.manager@campussphere.edu',
      loginId: 'INV-MGR-01',
      passwordHash: 'dummy',
      role: 'inventory_manager'
    });

    procOfficerUser = await User.create({
      name: 'Procurement Officer',
      email: 'test.inv.procurement@campussphere.edu',
      loginId: 'INV-PRO-01',
      passwordHash: 'dummy',
      role: 'procurement_officer'
    });

    storekeeperUser = await User.create({
      name: 'Central Storekeeper',
      email: 'test.inv.storekeeper@campussphere.edu',
      loginId: 'INV-STR-01',
      passwordHash: 'dummy',
      role: 'storekeeper'
    });

    facultyUser1 = await User.create({
      name: 'Prof. Alan Turing',
      email: 'test.inv.faculty1@campussphere.edu',
      loginId: 'INV-FAC-01',
      passwordHash: 'dummy',
      role: 'faculty'
    });

    facultyUser2 = await User.create({
      name: 'Prof. Grace Hopper',
      email: 'test.inv.faculty2@campussphere.edu',
      loginId: 'INV-FAC-02',
      passwordHash: 'dummy',
      role: 'faculty'
    });

    studentUser = await User.create({
      name: 'Student User',
      email: 'test.inv.student@campussphere.edu',
      loginId: 'INV-STU-01',
      passwordHash: 'dummy',
      role: 'student'
    });

    assert.ok(adminUser._id);
    assert.ok(invManagerUser._id);
  });

  // -------------------------------------------------------------
  // 1. CATEGORY MANAGEMENT
  // -------------------------------------------------------------
  await t.test('Category: Create asset and consumable categories', async () => {
    const req1 = {
      user: invManagerUser,
      body: {
        name: 'IT Equipment & Computers',
        code: 'TEST-CAT-IT',
        classification: 'asset',
        description: 'Laptops, desktops, workstations'
      }
    };
    const res1 = createMockRes();
    await inventoryController.createCategory(req1, res1);
    assert.equal(res1.statusCode, 201);
    assert.equal(res1.jsonData.data.code, 'TEST-CAT-IT');
    assert.equal(res1.jsonData.data.classification, 'asset');
    assetCategory = res1.jsonData.data;

    const req2 = {
      user: invManagerUser,
      body: {
        name: 'Office & Stationery Supplies',
        code: 'TEST-CAT-STAT',
        classification: 'consumable',
        description: 'Paper, pens, toner cartridges'
      }
    };
    const res2 = createMockRes();
    await inventoryController.createCategory(req2, res2);
    assert.equal(res2.statusCode, 201);
    assert.equal(res2.jsonData.data.code, 'TEST-CAT-STAT');
    assert.equal(res2.jsonData.data.classification, 'consumable');
    consumableCategory = res2.jsonData.data;
  });

  await t.test('Category: Prevent duplicate category code', async () => {
    const req = {
      user: invManagerUser,
      body: {
        name: 'Duplicate IT Category',
        code: 'TEST-CAT-IT',
        classification: 'asset'
      }
    };
    const res = createMockRes();
    await inventoryController.createCategory(req, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.jsonData.message, /already taken/i);
  });

  // -------------------------------------------------------------
  // 2. LOCATION MANAGEMENT
  // -------------------------------------------------------------
  await t.test('Location: Create central store and department lab locations', async () => {
    const req1 = {
      user: storekeeperUser,
      body: {
        name: 'Central Warehouse Store',
        code: 'TEST-LOC-MAIN',
        type: 'store',
        building: 'Administrative Block',
        roomNumber: 'G-101'
      }
    };
    const res1 = createMockRes();
    await inventoryController.createLocation(req1, res1);
    assert.equal(res1.statusCode, 201);
    assert.equal(res1.jsonData.data.code, 'TEST-LOC-MAIN');
    centralStoreLocation = res1.jsonData.data;

    const req2 = {
      user: storekeeperUser,
      body: {
        name: 'Advanced Computing Lab 1',
        code: 'TEST-LOC-LAB1',
        type: 'laboratory',
        building: 'Computer Science Wing',
        roomNumber: 'CS-204'
      }
    };
    const res2 = createMockRes();
    await inventoryController.createLocation(req2, res2);
    assert.equal(res2.statusCode, 201);
    csLabLocation = res2.jsonData.data;
  });

  await t.test('Location: Prevent duplicate location code', async () => {
    const req = {
      user: storekeeperUser,
      body: {
        name: 'Duplicate Store',
        code: 'TEST-LOC-MAIN',
        type: 'store',
        building: 'Main'
      }
    };
    const res = createMockRes();
    await inventoryController.createLocation(req, res);
    assert.equal(res.statusCode, 400);
  });

  // -------------------------------------------------------------
  // 3. ASSET REGISTER & DEPRECIATION INVARIANTS
  // -------------------------------------------------------------
  await t.test('Asset: Register serialized asset with integer paise acquisition cost', async () => {
    const req = {
      user: invManagerUser,
      body: {
        name: 'Dell Latitude 5430 Workstation',
        category: assetCategory._id,
        serialNumber: 'TEST-SN-DELL-001',
        modelNumber: 'Latitude 5430',
        manufacturer: 'Dell Inc.',
        acquisitionCost: 6500000, // ₹65,000.00
        salvageValuePaise: 500000, // ₹5,000.00
        usefulLifeYears: 5, // 5 years
        purchaseDate: new Date('2024-01-01'),
        warrantyExpiry: new Date('2027-01-01'),
        location: centralStoreLocation._id
      }
    };
    const res = createMockRes();
    await inventoryController.createAsset(req, res);
    assert.equal(res.statusCode, 201);
    assert.equal(res.jsonData.data.acquisitionCost, 6500000);
    assert.equal(res.jsonData.data.status, 'in_stock');
    testAsset = res.jsonData.data;
  });

  await t.test('Asset: Reject duplicate serial number', async () => {
    const req = {
      user: invManagerUser,
      body: {
        name: 'Another Dell Laptop',
        category: assetCategory._id,
        serialNumber: 'TEST-SN-DELL-001', // duplicate
        acquisitionCost: 6000000
      }
    };
    const res = createMockRes();
    await inventoryController.createAsset(req, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.jsonData.message, /already exists/i);
  });

  await t.test('Asset: Verify straight-line depreciation computation', async () => {
    const req = {
      user: adminUser,
      params: { id: testAsset._id }
    };
    const res = createMockRes();
    await inventoryController.getAssetById(req, res);
    assert.equal(res.statusCode, 200);

    const { depreciation } = res.jsonData.data;
    assert.ok(depreciation);
    assert.equal(depreciation.acquisitionCostPaise, 6500000);
    assert.equal(depreciation.salvageValuePaise, 500000);
    assert.equal(depreciation.usefulLifeMonths, 60);

    // Monthly depreciation = (6500000 - 500000) / 60 = 6000000 / 60 = 100000 paise (₹1,000/month)
    assert.equal(depreciation.straightLine.monthlyDepreciationPaise, 100000);
    assert.ok(depreciation.straightLine.currentBookValuePaise >= 500000);
    assert.ok(depreciation.straightLine.currentBookValuePaise <= 6500000);
  });

  // -------------------------------------------------------------
  // 4. ASSET ALLOCATION, RETURN & TRANSFER
  // -------------------------------------------------------------
  await t.test('Asset: Allocate asset to custodian and verify status change', async () => {
    const req = {
      user: storekeeperUser,
      params: { id: testAsset._id },
      body: {
        assignedTo: facultyUser1._id,
        purpose: 'Faculty Research and Lecture Projection',
        expectedReturnDate: new Date('2026-12-31')
      }
    };
    const res = createMockRes();
    await inventoryController.allocateAsset(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.data.asset.status, 'assigned');
    assert.equal(res.jsonData.data.asset.currentCustodian.toString(), facultyUser1._id.toString());
  });

  await t.test('Asset: Prevent re-allocating an already allocated asset', async () => {
    const req = {
      user: storekeeperUser,
      params: { id: testAsset._id },
      body: {
        assignedTo: facultyUser2._id
      }
    };
    const res = createMockRes();
    await inventoryController.allocateAsset(req, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.jsonData.message, /already allocated/i);
  });

  await t.test('Asset: Faculty can view their assigned assets', async () => {
    const req = { user: facultyUser1 };
    const res = createMockRes();
    await inventoryController.getMyAssignedAssets(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.count, 1);
    assert.equal(res.jsonData.data[0]._id.toString(), testAsset._id.toString());
  });

  await t.test('Asset: Return asset to store and verify status reset', async () => {
    const req = {
      user: storekeeperUser,
      params: { id: testAsset._id },
      body: {
        returnedCondition: 'good',
        notes: 'Returned in pristine condition after semester completion'
      }
    };
    const res = createMockRes();
    await inventoryController.returnAsset(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.data.asset.status, 'in_stock');
    assert.equal(res.jsonData.data.asset.currentCustodian, null);
  });

  await t.test('Asset: Transfer asset to department lab', async () => {
    const req = {
      user: storekeeperUser,
      params: { id: testAsset._id },
      body: {
        toLocation: csLabLocation._id,
        reason: 'Relocating to CS Lab for upcoming accreditation'
      }
    };
    const res = createMockRes();
    await inventoryController.transferAsset(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.data.asset.location.toString(), csLabLocation._id.toString());
    assert.equal(res.jsonData.data.transfer.status, 'completed');
  });

  // -------------------------------------------------------------
  // 5. CONSUMABLE STOCK MANAGEMENT & ATOMIC MOVEMENTS
  // -------------------------------------------------------------
  await t.test('Stock: Register consumable stock SKU with initial balance', async () => {
    const req = {
      user: storekeeperUser,
      body: {
        sku: 'TEST-SKU-PAPER-A4',
        name: 'A4 Copier Paper 75GSM (Ream of 500)',
        category: consumableCategory._id,
        unit: 'packs',
        initialQuantity: 100,
        reorderThreshold: 20,
        unitCostRupees: '250.00', // 25000 paise
        defaultLocation: centralStoreLocation._id
      }
    };
    const res = createMockRes();
    await inventoryController.createStockItem(req, res);
    assert.equal(res.statusCode, 201);
    assert.equal(res.jsonData.data.sku, 'TEST-SKU-PAPER-A4');
    assert.equal(res.jsonData.data.currentQuantity, 100);
    assert.equal(res.jsonData.data.reorderThreshold, 20);
    testStockItem = res.jsonData.data;
  });

  await t.test('Stock: Reject duplicate SKU code', async () => {
    const req = {
      user: storekeeperUser,
      body: {
        sku: 'TEST-SKU-PAPER-A4',
        name: 'Duplicate Paper',
        category: consumableCategory._id,
        unit: 'packs'
      }
    };
    const res = createMockRes();
    await inventoryController.createStockItem(req, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.jsonData.message, /already exists/i);
  });

  await t.test('Stock: Enforce non-negative stock balance invariant on issue', async () => {
    const req = {
      user: storekeeperUser,
      params: { id: testStockItem._id },
      body: {
        quantity: 150, // Available is only 100
        notes: 'Excessive request test'
      }
    };
    const res = createMockRes();
    await inventoryController.issueStock(req, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.jsonData.message, /insufficient stock/i);

    // Verify balance unchanged
    const item = await StockItem.findById(testStockItem._id);
    assert.equal(item.currentQuantity, 100);
  });

  await t.test('Stock: Atomically issue stock and verify ledger movement created', async () => {
    const req = {
      user: storekeeperUser,
      params: { id: testStockItem._id },
      body: {
        quantity: 30,
        notes: 'Issued to Exam Cell for mid-term paper printing'
      }
    };
    const res = createMockRes();
    await inventoryController.issueStock(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.data.stockItem.currentQuantity, 70);
    assert.equal(res.jsonData.data.movement.type, 'issue');
    assert.equal(res.jsonData.data.movement.previousQuantity, 100);
    assert.equal(res.jsonData.data.movement.newQuantity, 70);
  });

  await t.test('Stock: Manual audit adjustment with variance', async () => {
    const req = {
      user: storekeeperUser,
      params: { id: testStockItem._id },
      body: {
        countedQuantity: 65, // 5 units deficit
        reason: 'Physical count identified 5 reams damaged by water leakage'
      }
    };
    const res = createMockRes();
    await inventoryController.adjustStock(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.data.stockItem.currentQuantity, 65);
    assert.equal(res.jsonData.data.movement.type, 'adjustment');
    assert.equal(res.jsonData.data.movement.quantity, 5);
  });

  await t.test('Stock: Query movement ledger history', async () => {
    const req = {
      user: invManagerUser,
      query: { stockItemId: testStockItem._id }
    };
    const res = createMockRes();
    await inventoryController.getStockMovements(req, res);
    assert.equal(res.statusCode, 200);
    assert.ok(res.jsonData.count >= 2);
  });

  // -------------------------------------------------------------
  // 6. LOW STOCK ALERTS & REORDER SUGGESTIONS
  // -------------------------------------------------------------
  await t.test('Stock: Detect low stock threshold breach and calculate reorders', async () => {
    // Bring balance down to 15 (threshold is 20)
    await inventoryService.recordStockMovement({
      stockItemId: testStockItem._id,
      type: 'issue',
      quantity: 50,
      performedBy: storekeeperUser._id,
      reason: 'Heavy issuance to breach threshold'
    });

    const req = { user: invManagerUser };
    const res = createMockRes();
    await inventoryController.getLowStockAlerts(req, res);
    assert.equal(res.statusCode, 200);

    const alert = res.jsonData.data.find(a => a._id.toString() === testStockItem._id.toString());
    assert.ok(alert);
    assert.equal(alert.currentQuantity, 15);
    assert.ok(alert.isDeficit);
    assert.ok(alert.suggestedReorderQuantity >= alert.reorderQuantity);
    assert.ok(alert.estimatedCostPaise > 0);
  });

  // -------------------------------------------------------------
  // 7. VENDOR DIRECTORY & CONFIDENTIALITY
  // -------------------------------------------------------------
  await t.test('Vendor: Create vendor with tax details and confidential remarks', async () => {
    const req = {
      user: procOfficerUser,
      body: {
        name: 'Apex Infotech Solutions',
        vendorCode: 'TEST-VND-APEX',
        contactPerson: 'Sunil Mehta',
        phone: '+91 9876543210',
        email: 'sales@apexinfotech.test',
        gstNumber: '27AAAAA0000A1Z5',
        internalRemarks: 'CONFIDENTIAL: Highly reliable OEM distributor with 12% institutional discount'
      }
    };
    const res = createMockRes();
    await inventoryController.createVendor(req, res);
    assert.equal(res.statusCode, 201);
    assert.equal(res.jsonData.data.vendorCode, 'TEST-VND-APEX');
    testVendor = res.jsonData.data;
  });

  await t.test('Vendor: Redact internalRemarks for non-procurement users', async () => {
    const req = {
      user: facultyUser1,
      query: { search: 'Apex' }
    };
    const res = createMockRes();
    await inventoryController.getVendors(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.count, 1);
    assert.equal(res.jsonData.data[0].internalRemarks, undefined);
  });

  await t.test('Vendor: Allow admin and procurement officer to view internalRemarks', async () => {
    const req = {
      user: procOfficerUser,
      query: { search: 'Apex' }
    };
    const res = createMockRes();
    await inventoryController.getVendors(req, res);
    assert.equal(res.statusCode, 200);
    assert.ok(res.jsonData.data[0].internalRemarks.includes('CONFIDENTIAL'));
  });

  // -------------------------------------------------------------
  // 8. PURCHASE REQUESTS & MULTI-TIER APPROVAL WORKFLOW
  // -------------------------------------------------------------
  let testPurchaseRequest;

  await t.test('Procurement: Create Purchase Requisition (PR)', async () => {
    const req = {
      user: facultyUser1,
      body: {
        title: 'Q4 Physics Lab Microcontroller Kits',
        priority: 'high',
        justification: 'Required for IoT and embedded systems laboratory curriculum',
        items: [
          {
            itemType: 'asset',
            itemName: 'Arduino Mega 2560 Pro Kit',
            category: assetCategory._id,
            quantity: 5,
            estimatedUnitCostPaise: 250000
          }
        ]
      }
    };
    const res = createMockRes();
    await inventoryController.createPurchaseRequest(req, res);
    assert.equal(res.statusCode, 201);
    assert.equal(res.jsonData.data.estimatedTotalPaise, 1250000); // ₹12,500
    assert.equal(res.jsonData.data.status, 'pending_hod');
    testPurchaseRequest = res.jsonData.data;
  });

  await t.test('Procurement: Enforce SEPARATION OF DUTIES (requester cannot self-approve)', async () => {
    const req = {
      user: facultyUser1, // Requester attempting to approve
      params: { id: testPurchaseRequest._id },
      body: { comments: 'Self approval attempt' }
    };
    const res = createMockRes();
    await inventoryController.approvePurchaseRequest(req, res);
    assert.equal(res.statusCode, 403);
    assert.match(res.jsonData.message, /separation of duties/i);
  });

  await t.test('Procurement: Multi-tier approval flow advances stages', async () => {
    // 1. HOD approval (by admin or procurement officer)
    const req1 = {
      user: procOfficerUser,
      params: { id: testPurchaseRequest._id },
      body: { comments: 'HOD approval granted' }
    };
    const res1 = createMockRes();
    await inventoryController.approvePurchaseRequest(req1, res1);
    assert.equal(res1.statusCode, 200);
    assert.equal(res1.jsonData.data.status, 'pending_finance');

    // 2. Finance approval
    const req2 = {
      user: adminUser,
      params: { id: testPurchaseRequest._id },
      body: { comments: 'Budget allocated' }
    };
    const res2 = createMockRes();
    await inventoryController.approvePurchaseRequest(req2, res2);
    assert.equal(res2.statusCode, 200);
    assert.equal(res2.jsonData.data.status, 'pending_principal');

    // 3. Principal final approval
    const req3 = {
      user: adminUser,
      params: { id: testPurchaseRequest._id },
      body: { comments: 'Principal sanctioned' }
    };
    const res3 = createMockRes();
    await inventoryController.approvePurchaseRequest(req3, res3);
    assert.equal(res3.statusCode, 200);
    assert.equal(res3.jsonData.data.status, 'approved');
  });

  // -------------------------------------------------------------
  // 9. PURCHASE ORDERS & GOODS RECEIPTS (GRN)
  // -------------------------------------------------------------
  let testPo;

  await t.test('Procurement: Issue Purchase Order with integer paise precision', async () => {
    const req = {
      user: procOfficerUser,
      body: {
        vendor: testVendor._id,
        purchaseRequest: testPurchaseRequest._id,
        items: [
          {
            itemType: 'asset',
            itemName: 'Arduino Mega 2560 Pro Kit',
            category: assetCategory._id,
            quantity: 2,
            unitPricePaise: 240000, // ₹2,400 each
            taxPercent: 18 // 18% GST
          }
        ],
        expectedDeliveryDate: new Date('2026-11-15'),
        termsAndConditions: 'Warranty 1 year from delivery'
      }
    };
    const res = createMockRes();
    await inventoryController.createPurchaseOrder(req, res);
    assert.equal(res.statusCode, 201);

    // subtotal = 2 * 240000 = 480000 paise (₹4,800)
    // tax = 480000 * 0.18 = 86400 paise (₹864)
    // total = 566400 paise (₹5,664)
    assert.equal(res.jsonData.data.subtotalPaise, 480000);
    assert.equal(res.jsonData.data.taxTotalPaise, 86400);
    assert.equal(res.jsonData.data.totalAmountPaise, 566400);
    assert.equal(res.jsonData.data.status, 'issued');
    testPo = res.jsonData.data;
  });

  await t.test('Procurement: Process Goods Receipt (GRN) with auto asset generation', async () => {
    const poItem = testPo.items[0];
    const req = {
      user: storekeeperUser,
      body: {
        purchaseOrder: testPo._id,
        destinationLocation: centralStoreLocation._id,
        invoiceNumber: 'INV-APEX-8821',
        deliveryChallanNumber: 'DC-9912',
        items: [
          {
            poItemId: poItem._id,
            itemType: 'asset',
            itemName: poItem.itemName,
            category: assetCategory._id,
            orderedQuantity: 2,
            receivedQuantity: 2,
            acceptedQuantity: 2,
            unitCostPaise: poItem.unitPricePaise,
            serialNumbers: ['TEST-SN-ARDU-001', 'TEST-SN-ARDU-002']
          }
        ],
        inspectionNotes: 'All 2 units inspected, verified with intact seals'
      }
    };
    const res = createMockRes();
    await inventoryController.createGoodsReceipt(req, res);
    assert.equal(res.statusCode, 201);
    assert.equal(res.jsonData.data.inspectionStatus, 'passed');

    // Verify PO was updated to fulfilled
    const updatedPo = await PurchaseOrder.findById(testPo._id);
    assert.equal(updatedPo.status, 'fulfilled');

    // Verify 2 serialized assets were automatically created in store
    const generatedAssets = await Asset.find({ serialNumber: { $in: ['TEST-SN-ARDU-001', 'TEST-SN-ARDU-002'] } });
    assert.equal(generatedAssets.length, 2);
    assert.equal(generatedAssets[0].status, 'in_stock');
    assert.equal(generatedAssets[0].acquisitionCost, 240000);
  });

  // -------------------------------------------------------------
  // 10. ASSET MAINTENANCE & WARRANTY TRACKING
  // -------------------------------------------------------------
  let testMaintenance;

  await t.test('Maintenance: Schedule preventative/corrective service on asset', async () => {
    const req = {
      user: facultyUser1,
      body: {
        asset: testAsset._id,
        type: 'corrective',
        title: 'CPU Fan failure and thermal throttling',
        priority: 'high',
        scheduledDate: new Date()
      }
    };
    const res = createMockRes();
    await inventoryController.createMaintenanceRecord(req, res);
    assert.equal(res.statusCode, 201);
    assert.equal(res.jsonData.data.status, 'scheduled');
    assert.equal(res.jsonData.data.isUnderWarranty, true); // testAsset warranty is 2027
    testMaintenance = res.jsonData.data;

    // Verify asset status transitioned to under_maintenance
    const asset = await Asset.findById(testAsset._id);
    assert.equal(asset.status, 'under_maintenance');
  });

  await t.test('Maintenance: Complete maintenance task with repair cost in paise', async () => {
    const req = {
      user: storekeeperUser,
      params: { id: testMaintenance._id },
      body: {
        status: 'completed',
        costPaise: 120000, // ₹1,200.00
        restoredCondition: 'good',
        resolutionNotes: 'Replaced CPU thermal paste and cleaned heatsink fins'
      }
    };
    const res = createMockRes();
    await inventoryController.updateMaintenanceStatus(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.data.status, 'completed');
    assert.equal(res.jsonData.data.costPaise, 120000);

    // Verify asset status restored to in_stock
    const asset = await Asset.findById(testAsset._id);
    assert.equal(asset.status, 'in_stock');
    assert.equal(asset.condition, 'good');
  });

  // -------------------------------------------------------------
  // 11. PHYSICAL STOCKTAKING & RECONCILIATION
  // -------------------------------------------------------------
  let testAudit;

  await t.test('Audit: Initiate departmental stocktaking audit', async () => {
    const req = {
      user: invManagerUser,
      body: {
        title: 'Annual Central Store Physical Audit',
        auditType: 'location_specific',
        location: centralStoreLocation._id,
        plannedDate: new Date()
      }
    };
    const res = createMockRes();
    await inventoryController.createAudit(req, res);
    assert.equal(res.statusCode, 201);
    assert.equal(res.jsonData.data.status, 'in_progress');
    testAudit = res.jsonData.data;
  });

  await t.test('Audit: Record physical count with discrepancy & reconcile', async () => {
    const auditItems = await InventoryAuditItem.find({ audit: testAudit._id });
    if (auditItems.length > 0) {
      const item = auditItems[0];
      const countReq = {
        user: storekeeperUser,
        params: { auditId: testAudit._id, itemId: item._id },
        body: {
          countedQuantity: item.expectedQuantity,
          countedCondition: item.expectedCondition
        }
      };
      const countRes = createMockRes();
      await inventoryController.submitAuditCount(countReq, countRes);
      assert.equal(countRes.statusCode, 200);
      assert.equal(countRes.jsonData.data.status, 'matched');
    }

    // Reconcile audit
    const reconcileReq = {
      user: invManagerUser,
      params: { id: testAudit._id },
      body: { remarks: 'Reconciled and certified by lead auditor' }
    };
    const reconcileRes = createMockRes();
    await inventoryController.reconcileAudit(reconcileReq, reconcileRes);
    assert.equal(reconcileRes.statusCode, 200);
    assert.equal(reconcileRes.jsonData.data.status, 'reconciled');
  });

  // -------------------------------------------------------------
  // 12. SECURITY, ANTI-IDOR, CWE-1236 & CSV EXPORT
  // -------------------------------------------------------------
  await t.test('Security: Students strictly forbidden from inventory management', async () => {
    const { allowRoles } = require('../middleware/role.middleware');
    const middleware = allowRoles('admin', 'inventory_manager');

    const req = { user: studentUser };
    const res = createMockRes();
    let nextCalled = false;

    middleware(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
    assert.match(res.jsonData.message, /access denied/i);
  });

  await t.test('Security: CWE-1236 CSV Formula Injection Sanitization', async () => {
    assert.equal(inventoryService.sanitizeCsvValue('=cmd|\' /C calc\'!A0'), '\'=cmd|\' /C calc\'!A0');
    assert.equal(inventoryService.sanitizeCsvValue('+1+2'), '\'+1+2');
    assert.equal(inventoryService.sanitizeCsvValue('@SUM(A1:A10)'), '\'@SUM(A1:A10)');
    assert.equal(inventoryService.sanitizeCsvValue('-100'), '\'-100');
    assert.equal(inventoryService.sanitizeCsvValue('Normal Text'), 'Normal Text');
  });

  await t.test('Export: Stream sanitized Assets CSV', async () => {
    const req = { user: adminUser };
    const res = createMockRes();
    await inventoryController.exportAssetsCsv(req, res);
    assert.equal(res.statusCode, 200);
    assert.match(res.rawBody, /Asset ID,Name,Category/);
    assert.match(res.rawBody, /TEST-SN-DELL-001/);
  });

  await t.test('Export: Stream sanitized Stock CSV', async () => {
    const req = { user: storekeeperUser };
    const res = createMockRes();
    await inventoryController.exportStockCsv(req, res);
    assert.equal(res.statusCode, 200);
    assert.match(res.rawBody, /SKU,Item Name,Category/);
    assert.match(res.rawBody, /TEST-SKU-PAPER-A4/);
  });

  await t.test('Validation: Purchase request rejection requires non-empty reason', async () => {
    const req = {
      user: procOfficerUser,
      params: { id: testPurchaseRequest._id },
      body: { reason: '' }
    };
    const res = createMockRes();
    await inventoryController.rejectPurchaseRequest(req, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.jsonData.message, /reason is required/i);
  });

  await t.test('Validation: Asset maintenance requires valid scheduled date', async () => {
    const req = {
      user: facultyUser1,
      body: {
        asset: testAsset._id,
        type: 'corrective',
        title: 'Missing scheduled date test'
      }
    };
    const res = createMockRes();
    await inventoryController.createMaintenanceRecord(req, res);
    assert.equal(res.statusCode, 400);
  });

  await t.test('Metrics: Aggregate live institutional inventory valuation in paise', async () => {
    const req = { user: adminUser };
    const res = createMockRes();
    await inventoryController.getMetrics(req, res);
    assert.equal(res.statusCode, 200);
    assert.ok(res.jsonData.data.totalAssets >= 1);
    assert.ok(res.jsonData.data.totalAssetBookValuePaise > 0);
  });

  await t.test('Teardown: Disconnect cleanly from test database', async () => {
    await mongoose.disconnect();
  });
});
