"""
Inventory Module Models
Materials, Stock, Movements, and Reorder Alerts
"""

from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, Text, Enum as SQLEnum, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.core.database import Base

class MaterialCategory(str, enum.Enum):
    RAW_MATERIAL = "raw_material"
    FINISHED_GOODS = "finished_goods"
    WORK_IN_PROGRESS = "work_in_progress"
    CONSUMABLE = "consumable"
    SPARE_PARTS = "spare_parts"

class MovementType(str, enum.Enum):
    RECEIPT = "receipt"
    ISSUE = "issue"
    TRANSFER = "transfer"
    ADJUSTMENT = "adjustment"
    RETURN = "return"

class Material(Base):
    """Material master data"""
    __tablename__ = "materials"
    
    material_id = Column(Integer, primary_key=True, index=True)
    material_code = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    category = Column(SQLEnum(MaterialCategory), nullable=False, index=True)
    unit = Column(String(20), nullable=False)  # kg, meter, piece, etc.
    reorder_level = Column(Numeric(15, 3))
    reorder_quantity = Column(Numeric(15, 3))
    unit_cost = Column(Numeric(15, 2))
    hsn_code = Column(String(20))  # Tax code
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    inventory_items = relationship("InventoryItem", back_populates="material")
    stock_movements = relationship("StockMovement", back_populates="material")

class InventoryItem(Base):
    """Current inventory stock"""
    __tablename__ = "inventory_items"
    
    item_id = Column(Integer, primary_key=True, index=True)
    material_id = Column(Integer, ForeignKey("materials.material_id"), nullable=False, index=True)
    batch_number = Column(String(50), index=True)
    quantity = Column(Numeric(15, 3), nullable=False)
    location = Column(String(100))
    warehouse = Column(String(100))
    bin_location = Column(String(50))
    unit_cost = Column(Numeric(15, 2))
    total_value = Column(Numeric(15, 2))
    manufactured_date = Column(DateTime(timezone=True))
    expiry_date = Column(DateTime(timezone=True))
    supplier_id = Column(Integer, ForeignKey("suppliers.supplier_id"))
    po_id = Column(Integer, ForeignKey("purchase_orders.po_id"))
    quality_status = Column(String(50))  # "approved", "quarantine", "rejected"
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    material = relationship("Material", back_populates="inventory_items")

class StockMovement(Base):
    """Stock movement history"""
    __tablename__ = "stock_movements"
    
    movement_id = Column(Integer, primary_key=True, index=True)
    material_id = Column(Integer, ForeignKey("materials.material_id"), nullable=False, index=True)
    movement_type = Column(SQLEnum(MovementType), nullable=False, index=True)
    quantity = Column(Numeric(15, 3), nullable=False)
    batch_number = Column(String(50))
    from_location = Column(String(100))
    to_location = Column(String(100))
    reference_type = Column(String(50))  # "purchase_order", "work_order", "sales_order"
    reference_id = Column(Integer)
    unit_cost = Column(Numeric(15, 2))
    total_value = Column(Numeric(15, 2))
    notes = Column(Text)
    created_by = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    
    # Relationships
    material = relationship("Material", back_populates="stock_movements")

class ReorderAlert(Base):
    """Automatic reorder alerts"""
    __tablename__ = "reorder_alerts"
    
    alert_id = Column(Integer, primary_key=True, index=True)
    material_id = Column(Integer, ForeignKey("materials.material_id"), nullable=False, index=True)
    current_stock = Column(Numeric(15, 3))
    reorder_level = Column(Numeric(15, 3))
    recommended_quantity = Column(Numeric(15, 3))
    priority = Column(String(20))  # "low", "medium", "high", "critical"
    status = Column(String(20), default="pending")  # "pending", "ordered", "ignored"
    po_id = Column(Integer, ForeignKey("purchase_orders.po_id"))
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    resolved_at = Column(DateTime(timezone=True))
    resolved_by = Column(Integer, ForeignKey("users.user_id"))
