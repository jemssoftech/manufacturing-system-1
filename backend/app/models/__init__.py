"""
Models package initialization
Imports all models for SQLAlchemy
"""

from app.models.auth import User, Role, AuditLog
from app.models.procurement import Supplier, PurchaseOrder, POItem, SupplierRating
from app.models.inventory import Material, InventoryItem, StockMovement, ReorderAlert
from app.models.production import Product, BillOfMaterials, Machine, WorkOrder, MachineAllocation, ProductionLog
from app.models.quality import QCInspection, DefectLog, DefectType, BatchApproval
from app.models.sales import Customer, SalesOrder, SOItem, DispatchNote

__all__ = [
    # Auth
    "User",
    "Role",
    "AuditLog",
    # Procurement
    "Supplier",
    "PurchaseOrder",
    "POItem",
    "SupplierRating",
    # Inventory
    "Material",
    "InventoryItem",
    "StockMovement",
    "ReorderAlert",
    # Production
    "Product",
    "BillOfMaterials",
    "Machine",
    "WorkOrder",
    "MachineAllocation",
    "ProductionLog",
    # Quality
    "QCInspection",
    "DefectLog",
    "DefectType",
    "BatchApproval",
    # Sales
    "Customer",
    "SalesOrder",
    "SOItem",
    "DispatchNote",
]
