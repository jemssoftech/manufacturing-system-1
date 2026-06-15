"""
Seed script to populate initial data for Textile ERP
Creates roles, users, and sample data for testing
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import date, timedelta
from app.core.database import SessionLocal
from app.models.auth import User, Role
from app.models.procurement import Supplier, SupplierStatus
from app.models.inventory import Material, MaterialCategory
from app.models.production import Product, Machine, MachineStatus
from app.models.quality import DefectType, DefectSeverity
from app.models.sales import Customer
from app.core.security import get_password_hash

def seed_roles(db):
    """Create default roles"""
    roles_data = [
        {"role_name": "admin", "permissions": '{"all": true}', "description": "System Administrator with full access"},
        {"role_name": "manager", "permissions": '{"read": true, "write": true, "approve": true}', "description": "Department Manager"},
        {"role_name": "supervisor", "permissions": '{"read": true, "write": true}', "description": "Floor Supervisor"},
        {"role_name": "operator", "permissions": '{"read": true}', "description": "Production Operator"},
        {"role_name": "viewer", "permissions": '{"read": true}', "description": "View Only Access"}
    ]
    
    for role_data in roles_data:
        if not db.query(Role).filter(Role.role_name == role_data["role_name"]).first():
            role = Role(**role_data)
            db.add(role)
    
    db.commit()
    print("✅ Roles created")

def seed_users(db):
    """Create default users"""
    admin_role = db.query(Role).filter(Role.role_name == "admin").first()
    manager_role = db.query(Role).filter(Role.role_name == "manager").first()
    operator_role = db.query(Role).filter(Role.role_name == "operator").first()
    
    users_data = [
        {"username": "admin", "email": "admin@textile-erp.com", "password": "admin123", 
         "full_name": "System Administrator", "role_id": admin_role.role_id},
        {"username": "manager1", "email": "manager@textile-erp.com", "password": "manager123", 
         "full_name": "Production Manager", "role_id": manager_role.role_id},
        {"username": "operator1", "email": "operator@textile-erp.com", "password": "operator123", 
         "full_name": "Floor Operator", "role_id": operator_role.role_id},
    ]
    
    for user_data in users_data:
        if not db.query(User).filter(User.username == user_data["username"]).first():
            password = user_data.pop("password")
            user = User(**user_data, password_hash=get_password_hash(password), is_active=True)
            db.add(user)
    
    db.commit()
    print("✅ Users created (admin/admin123, manager1/manager123, operator1/operator123)")

def seed_suppliers(db):
    """Create sample suppliers"""
    suppliers_data = [
        {"supplier_code": "SUP-001", "name": "ABC Cotton Suppliers", "contact_person": "John Doe",
         "email": "john@abccotton.com", "phone": "+1-555-0101", "city": "Mumbai", "rating": 4.5},
        {"supplier_code": "SUP-002", "name": "XYZ Yarn Industries", "contact_person": "Jane Smith",
         "email": "jane@xyzyarn.com", "phone": "+1-555-0102", "city": "Surat", "rating": 4.2},
        {"supplier_code": "SUP-003", "name": "Quality Dyes Ltd", "contact_person": "Mike Johnson",
         "email": "mike@qualitydyes.com", "phone": "+1-555-0103", "city": "Ahmedabad", "rating": 4.8},
    ]
    
    for supplier_data in suppliers_data:
        if not db.query(Supplier).filter(Supplier.supplier_code == supplier_data["supplier_code"]).first():
            supplier = Supplier(**supplier_data, status=SupplierStatus.ACTIVE)
            db.add(supplier)
    
    db.commit()
    print("✅ Suppliers created")

def seed_materials(db):
    """Create sample materials"""
    materials_data = [
        {"material_code": "MAT-001", "name": "Raw Cotton", "category": MaterialCategory.RAW_MATERIAL,
         "unit": "kg", "reorder_level": 1000, "reorder_quantity": 5000, "unit_cost": 150},
        {"material_code": "MAT-002", "name": "Polyester Yarn", "category": MaterialCategory.RAW_MATERIAL,
         "unit": "kg", "reorder_level": 500, "reorder_quantity": 2000, "unit_cost": 200},
        {"material_code": "MAT-003", "name": "Blue Dye", "category": MaterialCategory.CONSUMABLE,
         "unit": "liter", "reorder_level": 100, "reorder_quantity": 500, "unit_cost": 50},
        {"material_code": "MAT-004", "name": "Red Dye", "category": MaterialCategory.CONSUMABLE,
         "unit": "liter", "reorder_level": 100, "reorder_quantity": 500, "unit_cost": 55},
        {"material_code": "MAT-005", "name": "Packaging Box", "category": MaterialCategory.CONSUMABLE,
         "unit": "piece", "reorder_level": 200, "reorder_quantity": 1000, "unit_cost": 10},
    ]
    
    for material_data in materials_data:
        if not db.query(Material).filter(Material.material_code == material_data["material_code"]).first():
            material = Material(**material_data, is_active=True)
            db.add(material)
    
    db.commit()
    print("✅ Materials created")

def seed_products(db):
    """Create sample products"""
    products_data = [
        {"product_code": "PROD-001", "name": "Cotton T-Shirt (White)", "category": "Apparel",
         "unit": "piece", "standard_cost": 250, "selling_price": 500, "lead_time_days": 7},
        {"product_code": "PROD-002", "name": "Polyester Shirt (Blue)", "category": "Apparel",
         "unit": "piece", "standard_cost": 300, "selling_price": 650, "lead_time_days": 7},
        {"product_code": "PROD-003", "name": "Cotton Fabric Roll", "category": "Fabric",
         "unit": "meter", "standard_cost": 100, "selling_price": 200, "lead_time_days": 5},
    ]
    
    for product_data in products_data:
        if not db.query(Product).filter(Product.product_code == product_data["product_code"]).first():
            product = Product(**product_data, is_active=True)
            db.add(product)
    
    db.commit()
    print("✅ Products created")

def seed_machines(db):
    """Create sample machines"""
    machines_data = [
        {"machine_code": "MACH-001", "name": "Weaving Machine #1", "machine_type": "Weaving",
         "capacity": 1000, "capacity_unit": "meter/day", "location": "Floor A"},
        {"machine_code": "MACH-002", "name": "Dyeing Machine #1", "machine_type": "Dyeing",
         "capacity": 500, "capacity_unit": "kg/day", "location": "Floor B"},
        {"machine_code": "MACH-003", "name": "Cutting Machine #1", "machine_type": "Cutting",
         "capacity": 200, "capacity_unit": "piece/day", "location": "Floor C"},
    ]
    
    for machine_data in machines_data:
        if not db.query(Machine).filter(Machine.machine_code == machine_data["machine_code"]).first():
            machine = Machine(**machine_data, status=MachineStatus.AVAILABLE, is_active=True)
            db.add(machine)
    
    db.commit()
    print("✅ Machines created")

def seed_defect_types(db):
    """Create sample defect types"""
    defect_types_data = [
        {"code": "DEF-001", "name": "Color Mismatch", "category": "Dyeing", 
         "severity": DefectSeverity.MAJOR, "threshold_percentage": 2.0},
        {"code": "DEF-002", "name": "Thread Break", "category": "Weaving", 
         "severity": DefectSeverity.MINOR, "threshold_percentage": 5.0},
        {"code": "DEF-003", "name": "Stain", "category": "Finishing", 
         "severity": DefectSeverity.MAJOR, "threshold_percentage": 1.0},
        {"code": "DEF-004", "name": "Size Deviation", "category": "Cutting", 
         "severity": DefectSeverity.CRITICAL, "threshold_percentage": 0.5},
    ]
    
    for defect_data in defect_types_data:
        if not db.query(DefectType).filter(DefectType.code == defect_data["code"]).first():
            defect = DefectType(**defect_data, is_active=True)
            db.add(defect)
    
    db.commit()
    print("✅ Defect types created")

def seed_customers(db):
    """Create sample customers"""
    customers_data = [
        {"customer_code": "CUST-001", "name": "Fashion Hub Retail", "contact_person": "Sarah Williams",
         "email": "sarah@fashionhub.com", "phone": "+1-555-0201", "city": "New York", 
         "region": "North America", "credit_limit": 100000, "rating": 4.7},
        {"customer_code": "CUST-002", "name": "Global Apparel Co", "contact_person": "Robert Brown",
         "email": "robert@globalapparel.com", "phone": "+1-555-0202", "city": "Los Angeles", 
         "region": "North America", "credit_limit": 150000, "rating": 4.5},
        {"customer_code": "CUST-003", "name": "Euro Fashion Ltd", "contact_person": "Emma Davis",
         "email": "emma@eurofashion.com", "phone": "+44-20-5550203", "city": "London", 
         "region": "Europe", "credit_limit": 80000, "rating": 4.3},
    ]
    
    for customer_data in customers_data:
        if not db.query(Customer).filter(Customer.customer_code == customer_data["customer_code"]).first():
            customer = Customer(**customer_data, is_active=True)
            db.add(customer)
    
    db.commit()
    print("✅ Customers created")

def main():
    """Run all seed functions"""
    print("🌱 Starting database seeding...")
    
    db = SessionLocal()
    
    try:
        seed_roles(db)
        seed_users(db)
        seed_suppliers(db)
        seed_materials(db)
        seed_products(db)
        seed_machines(db)
        seed_defect_types(db)
        seed_customers(db)
        
        print("\n✅ Database seeding completed successfully!")
        print("\n📝 Default Login Credentials:")
        print("   Admin: admin / admin123")
        print("   Manager: manager1 / manager123")
        print("   Operator: operator1 / operator123")
        
    except Exception as e:
        print(f"\n❌ Error during seeding: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    main()
