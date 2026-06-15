const { getSequelize } = require('../config/db');

const sequelize = getSequelize();

// Import model factories
const createAuthModels = require('./auth');
const createProcurementModels = require('./procurement');
const createInventoryModels = require('./inventory');
const createProductionModels = require('./production');
const createQualityModels = require('./quality');
const createSalesModels = require('./sales');

// Initialize models
const { Role, User, AuditLog } = createAuthModels(sequelize);
const { Supplier, PurchaseOrder, POItem, SupplierRating } = createProcurementModels(sequelize);
const { Material, InventoryItem, StockMovement, ReorderAlert } = createInventoryModels(sequelize);
const { Product, BillOfMaterials, Machine, WorkOrder, MachineAllocation, ProductionLog } = createProductionModels(sequelize);
const { DefectType, QCInspection, DefectLog, BatchApproval } = createQualityModels(sequelize);
const { Customer, SalesOrder, SOItem, DispatchNote } = createSalesModels(sequelize);

// Establish Associations

// --- Auth ---
User.belongsTo(Role, { foreignKey: 'role_id', as: 'role' });
Role.hasMany(User, { foreignKey: 'role_id', as: 'users' });

AuditLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(AuditLog, { foreignKey: 'user_id', as: 'audit_logs' });

// --- Procurement ---
PurchaseOrder.belongsTo(Supplier, { foreignKey: 'supplier_id', as: 'supplier' });
Supplier.hasMany(PurchaseOrder, { foreignKey: 'supplier_id', as: 'purchase_orders' });

PurchaseOrder.hasMany(POItem, { foreignKey: 'po_id', as: 'items', onDelete: 'CASCADE' });
POItem.belongsTo(PurchaseOrder, { foreignKey: 'po_id', as: 'purchase_order' });

POItem.belongsTo(Material, { foreignKey: 'material_id', as: 'material' });

SupplierRating.belongsTo(Supplier, { foreignKey: 'supplier_id', as: 'supplier' });
Supplier.hasMany(SupplierRating, { foreignKey: 'supplier_id', as: 'supplier_ratings' });

SupplierRating.belongsTo(PurchaseOrder, { foreignKey: 'po_id', as: 'purchase_order' });
SupplierRating.belongsTo(User, { foreignKey: 'rated_by', as: 'rater' });

// --- Inventory ---
InventoryItem.belongsTo(Material, { foreignKey: 'material_id', as: 'material' });
Material.hasMany(InventoryItem, { foreignKey: 'material_id', as: 'inventory_items' });

InventoryItem.belongsTo(Supplier, { foreignKey: 'supplier_id', as: 'supplier' });
InventoryItem.belongsTo(PurchaseOrder, { foreignKey: 'po_id', as: 'purchase_order' });

StockMovement.belongsTo(Material, { foreignKey: 'material_id', as: 'material' });
Material.hasMany(StockMovement, { foreignKey: 'material_id', as: 'stock_movements' });

StockMovement.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

ReorderAlert.belongsTo(Material, { foreignKey: 'material_id', as: 'material' });
ReorderAlert.belongsTo(PurchaseOrder, { foreignKey: 'po_id', as: 'purchase_order' });
ReorderAlert.belongsTo(User, { foreignKey: 'resolved_by', as: 'resolver' });

// --- Production ---
BillOfMaterials.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });
Product.hasMany(BillOfMaterials, { foreignKey: 'product_id', as: 'bom_items' });

BillOfMaterials.belongsTo(Material, { foreignKey: 'material_id', as: 'material' });

WorkOrder.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });
Product.hasMany(WorkOrder, { foreignKey: 'product_id', as: 'work_orders' });

WorkOrder.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
WorkOrder.belongsTo(SalesOrder, { foreignKey: 'sales_order_id', as: 'sales_order' });

MachineAllocation.belongsTo(Machine, { foreignKey: 'machine_id', as: 'machine' });
Machine.hasMany(MachineAllocation, { foreignKey: 'machine_id', as: 'allocations' });

MachineAllocation.belongsTo(WorkOrder, { foreignKey: 'wo_id', as: 'work_order' });
WorkOrder.hasMany(MachineAllocation, { foreignKey: 'wo_id', as: 'machine_allocations' });

ProductionLog.belongsTo(WorkOrder, { foreignKey: 'wo_id', as: 'work_order' });
WorkOrder.hasMany(ProductionLog, { foreignKey: 'wo_id', as: 'production_logs' });

ProductionLog.belongsTo(User, { foreignKey: 'operator_id', as: 'operator' });
ProductionLog.belongsTo(User, { foreignKey: 'supervisor_id', as: 'supervisor' });
ProductionLog.belongsTo(Machine, { foreignKey: 'machine_id', as: 'machine' });

// --- Quality ---
QCInspection.belongsTo(WorkOrder, { foreignKey: 'wo_id', as: 'work_order' });
WorkOrder.hasMany(QCInspection, { foreignKey: 'wo_id', as: 'qc_inspections' });

QCInspection.belongsTo(PurchaseOrder, { foreignKey: 'po_id', as: 'purchase_order' });
QCInspection.belongsTo(User, { foreignKey: 'inspector_id', as: 'inspector' });
QCInspection.belongsTo(User, { foreignKey: 'approved_by', as: 'approver' });

QCInspection.hasMany(DefectLog, { foreignKey: 'inspection_id', as: 'defect_logs' });
DefectLog.belongsTo(QCInspection, { foreignKey: 'inspection_id', as: 'inspection' });

DefectLog.belongsTo(DefectType, { foreignKey: 'defect_type_id', as: 'defect_type' });
DefectType.hasMany(DefectLog, { foreignKey: 'defect_type_id', as: 'defect_logs' });

BatchApproval.belongsTo(QCInspection, { foreignKey: 'inspection_id', as: 'inspection' });
BatchApproval.belongsTo(User, { foreignKey: 'approved_by', as: 'approver' });

// --- Sales ---
SalesOrder.belongsTo(Customer, { foreignKey: 'customer_id', as: 'customer' });
Customer.hasMany(SalesOrder, { foreignKey: 'customer_id', as: 'sales_orders' });

SalesOrder.hasMany(SOItem, { foreignKey: 'so_id', as: 'items', onDelete: 'CASCADE' });
SOItem.belongsTo(SalesOrder, { foreignKey: 'so_id', as: 'sales_order' });

SOItem.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

DispatchNote.belongsTo(SalesOrder, { foreignKey: 'so_id', as: 'sales_order' });
SalesOrder.hasMany(DispatchNote, { foreignKey: 'so_id', as: 'dispatch_notes' });

DispatchNote.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

module.exports = {
  sequelize,
  Role,
  User,
  AuditLog,
  Supplier,
  PurchaseOrder,
  POItem,
  SupplierRating,
  Material,
  InventoryItem,
  StockMovement,
  ReorderAlert,
  Product,
  BillOfMaterials,
  Machine,
  WorkOrder,
  MachineAllocation,
  ProductionLog,
  DefectType,
  QCInspection,
  DefectLog,
  BatchApproval,
  Customer,
  SalesOrder,
  SOItem,
  DispatchNote
};
