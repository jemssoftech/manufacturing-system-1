const bcrypt = require('bcryptjs');
const { initDatabase } = require('../config/db');
const {
  Role,
  User,
  Supplier,
  Material,
  Product,
  Machine,
  DefectType,
  Customer
} = require('../models');

async function seed() {
  console.log('🌱 Starting database seeding...');
  
  // Initialize DB and ensure database exists
  await initDatabase();

  // Sync database models (drops tables if force is true)
  // Warning: force: true is fine for seed script
  await Role.sequelize.sync({ force: true });
  console.log('✅ Database tables synchronized.');

  // 1. Seed Roles
  const rolesData = [
    { role_name: 'admin', permissions: '{"all": true}', description: 'System Administrator with full access' },
    { role_name: 'manager', permissions: '{"read": true, "write": true, "approve": true}', description: 'Department Manager' },
    { role_name: 'supervisor', permissions: '{"read": true, "write": true}', description: 'Floor Supervisor' },
    { role_name: 'operator', permissions: '{"read": true}', description: 'Production Operator' },
    { role_name: 'viewer', permissions: '{"read": true}', description: 'View Only Access' }
  ];
  
  const createdRoles = {};
  for (const role of rolesData) {
    const created = await Role.create(role);
    createdRoles[role.role_name] = created;
  }
  console.log('✅ Roles created');

  // 2. Seed Users
  const passwordHashAdmin = await bcrypt.hash('admin123', 12);
  const passwordHashManager = await bcrypt.hash('manager123', 12);
  const passwordHashOperator = await bcrypt.hash('operator123', 12);

  const usersData = [
    {
      username: 'admin',
      email: 'admin@textile-erp.com',
      password_hash: passwordHashAdmin,
      full_name: 'System Administrator',
      role_id: createdRoles['admin'].role_id,
      is_active: true
    },
    {
      username: 'manager1',
      email: 'manager@textile-erp.com',
      password_hash: passwordHashManager,
      full_name: 'Production Manager',
      role_id: createdRoles['manager'].role_id,
      is_active: true
    },
    {
      username: 'operator1',
      email: 'operator@textile-erp.com',
      password_hash: passwordHashOperator,
      full_name: 'Floor Operator',
      role_id: createdRoles['operator'].role_id,
      is_active: true
    }
  ];

  for (const user of usersData) {
    await User.create(user);
  }
  console.log('✅ Users created (admin/admin123, manager1/manager123, operator1/operator123)');

  // 3. Seed Suppliers
  const suppliersData = [
    { supplier_code: 'SUP-001', name: 'ABC Cotton Suppliers', contact_person: 'John Doe', email: 'john@abccotton.com', phone: '+1-555-0101', city: 'Mumbai', rating: 4.5, status: 'active' },
    { supplier_code: 'SUP-002', name: 'XYZ Yarn Industries', contact_person: 'Jane Smith', email: 'jane@xyzyarn.com', phone: '+1-555-0102', city: 'Surat', rating: 4.2, status: 'active' },
    { supplier_code: 'SUP-003', name: 'Quality Dyes Ltd', contact_person: 'Mike Johnson', email: 'mike@qualitydyes.com', phone: '+1-555-0103', city: 'Ahmedabad', rating: 4.8, status: 'active' }
  ];

  for (const supplier of suppliersData) {
    await Supplier.create(supplier);
  }
  console.log('✅ Suppliers created');

  // 4. Seed Materials
  const materialsData = [
    { material_code: 'MAT-001', name: 'Raw Cotton', category: 'raw_material', unit: 'kg', reorder_level: 1000.000, reorder_quantity: 5000.000, unit_cost: 150.00, is_active: true },
    { material_code: 'MAT-002', name: 'Polyester Yarn', category: 'raw_material', unit: 'kg', reorder_level: 500.000, reorder_quantity: 2000.000, unit_cost: 200.00, is_active: true },
    { material_code: 'MAT-003', name: 'Blue Dye', category: 'consumable', unit: 'liter', reorder_level: 100.000, reorder_quantity: 500.000, unit_cost: 50.00, is_active: true },
    { material_code: 'MAT-004', name: 'Red Dye', category: 'consumable', unit: 'liter', reorder_level: 100.000, reorder_quantity: 500.000, unit_cost: 55.00, is_active: true },
    { material_code: 'MAT-005', name: 'Packaging Box', category: 'consumable', unit: 'piece', reorder_level: 200.000, reorder_quantity: 1000.000, unit_cost: 10.00, is_active: true }
  ];

  for (const mat of materialsData) {
    await Material.create(mat);
  }
  console.log('✅ Materials created');

  // 5. Seed Products
  const productsData = [
    { product_code: 'PROD-001', name: 'Cotton T-Shirt (White)', category: 'Apparel', unit: 'piece', standard_cost: 250.00, selling_price: 500.00, lead_time_days: 7, is_active: true },
    { product_code: 'PROD-002', name: 'Polyester Shirt (Blue)', category: 'Apparel', unit: 'piece', standard_cost: 300.00, selling_price: 650.00, lead_time_days: 7, is_active: true },
    { product_code: 'PROD-003', name: 'Cotton Fabric Roll', category: 'Fabric', unit: 'meter', standard_cost: 100.00, selling_price: 200.00, lead_time_days: 5, is_active: true }
  ];

  for (const prod of productsData) {
    await Product.create(prod);
  }
  console.log('✅ Products created');

  // 6. Seed Machines
  const machinesData = [
    { machine_code: 'MACH-001', name: 'Weaving Machine #1', machine_type: 'Weaving', capacity: 1000.000, capacity_unit: 'meter/day', location: 'Floor A', status: 'available', is_active: true },
    { machine_code: 'MACH-002', name: 'Dyeing Machine #1', machine_type: 'Dyeing', capacity: 500.000, capacity_unit: 'kg/day', location: 'Floor B', status: 'available', is_active: true },
    { machine_code: 'MACH-003', name: 'Cutting Machine #1', machine_type: 'Cutting', capacity: 200.000, capacity_unit: 'piece/day', location: 'Floor C', status: 'available', is_active: true }
  ];

  for (const mach of machinesData) {
    await Machine.create(mach);
  }
  console.log('✅ Machines created');

  // 7. Seed Defect Types
  const defectTypesData = [
    { code: 'DEF-001', name: 'Color Mismatch', category: 'Dyeing', severity: 'major', threshold_percentage: 2.00, is_active: true },
    { code: 'DEF-002', name: 'Thread Break', category: 'Weaving', severity: 'minor', threshold_percentage: 5.00, is_active: true },
    { code: 'DEF-003', name: 'Stain', category: 'Finishing', severity: 'major', threshold_percentage: 1.00, is_active: true },
    { code: 'DEF-004', name: 'Size Deviation', category: 'Cutting', severity: 'critical', threshold_percentage: 0.50, is_active: true }
  ];

  for (const dt of defectTypesData) {
    await DefectType.create(dt);
  }
  console.log('✅ Defect types created');

  // 8. Seed Customers
  const customersData = [
    { customer_code: 'CUST-001', name: 'Fashion Hub Retail', contact_person: 'Sarah Williams', email: 'sarah@fashionhub.com', phone: '+1-555-0201', city: 'New York', region: 'North America', credit_limit: 100000.00, rating: 4.7, is_active: true },
    { customer_code: 'CUST-002', name: 'Global Apparel Co', contact_person: 'Robert Brown', email: 'robert@globalapparel.com', phone: '+1-555-0202', city: 'Los Angeles', region: 'North America', credit_limit: 150000.00, rating: 4.5, is_active: true },
    { customer_code: 'CUST-003', name: 'Euro Fashion Ltd', contact_person: 'Emma Davis', email: 'emma@eurofashion.com', phone: '+44-20-5550203', city: 'London', region: 'Europe', credit_limit: 80000.00, rating: 4.3, is_active: true }
  ];

  for (const cust of customersData) {
    await Customer.create(cust);
  }
  console.log('✅ Customers created');

  console.log('\n🎉 Database seeding completed successfully!');
}

seed().catch(err => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
