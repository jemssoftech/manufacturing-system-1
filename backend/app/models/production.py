"""
Production Module Models
Work Orders, BOM, Machines, Production Logs
"""

from sqlalchemy import Column, Integer, String, Numeric, Date, DateTime, ForeignKey, Text, Enum as SQLEnum, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.core.database import Base

class WOStatus(str, enum.Enum):
    DRAFT = "draft"
    PLANNED = "planned"
    RELEASED = "released"
    IN_PROGRESS = "in_progress"
    PAUSED = "paused"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class MachineStatus(str, enum.Enum):
    AVAILABLE = "available"
    IN_USE = "in_use"
    MAINTENANCE = "maintenance"
    BREAKDOWN = "breakdown"
    IDLE = "idle"

class Product(Base):
    """Finished products"""
    __tablename__ = "products"
    
    product_id = Column(Integer, primary_key=True, index=True)
    product_code = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    category = Column(String(100))
    unit = Column(String(20))
    standard_cost = Column(Numeric(15, 2))
    selling_price = Column(Numeric(15, 2))
    lead_time_days = Column(Integer)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    bom_items = relationship("BillOfMaterials", back_populates="product")
    work_orders = relationship("WorkOrder", back_populates="product")

class BillOfMaterials(Base):
    """Bill of materials (BOM)"""
    __tablename__ = "bom"
    
    bom_id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.product_id"), nullable=False, index=True)
    material_id = Column(Integer, ForeignKey("materials.material_id"), nullable=False)
    quantity_required = Column(Numeric(15, 3), nullable=False)
    wastage_percentage = Column(Numeric(5, 2), default=0)
    unit = Column(String(20))
    notes = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    product = relationship("Product", back_populates="bom_items")
    material = relationship("Material")

class Machine(Base):
    """Production machines"""
    __tablename__ = "machines"
    
    machine_id = Column(Integer, primary_key=True, index=True)
    machine_code = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(200), nullable=False)
    machine_type = Column(String(100))
    capacity = Column(Numeric(15, 3))
    capacity_unit = Column(String(20))
    status = Column(SQLEnum(MachineStatus), default=MachineStatus.AVAILABLE, index=True)
    location = Column(String(100))
    purchase_date = Column(Date)
    last_maintenance_date = Column(Date)
    next_maintenance_date = Column(Date)
    maintenance_frequency_days = Column(Integer)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    allocations = relationship("MachineAllocation", back_populates="machine")

class WorkOrder(Base):
    """Production work orders"""
    __tablename__ = "work_orders"
    
    wo_id = Column(Integer, primary_key=True, index=True)
    wo_number = Column(String(50), unique=True, nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.product_id"), nullable=False)
    quantity = Column(Numeric(15, 3), nullable=False)
    unit = Column(String(20))
    planned_start_date = Column(Date, index=True)
    planned_end_date = Column(Date)
    actual_start_date = Column(DateTime(timezone=True))
    actual_end_date = Column(DateTime(timezone=True))
    status = Column(SQLEnum(WOStatus), default=WOStatus.DRAFT, index=True)
    priority = Column(String(20))  # "low", "medium", "high", "urgent"
    sales_order_id = Column(Integer, ForeignKey("sales_orders.so_id"))
    produced_quantity = Column(Numeric(15, 3), default=0)
    rejected_quantity = Column(Numeric(15, 3), default=0)
    notes = Column(Text)
    created_by = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    product = relationship("Product", back_populates="work_orders")
    production_logs = relationship("ProductionLog", back_populates="work_order")
    machine_allocations = relationship("MachineAllocation", back_populates="work_order")
    qc_inspections = relationship("QCInspection", back_populates="work_order")

class MachineAllocation(Base):
    """Machine allocation to work orders"""
    __tablename__ = "machine_allocations"
    
    allocation_id = Column(Integer, primary_key=True, index=True)
    wo_id = Column(Integer, ForeignKey("work_orders.wo_id"), nullable=False, index=True)
    machine_id = Column(Integer, ForeignKey("machines.machine_id"), nullable=False, index=True)
    planned_start_time = Column(DateTime(timezone=True))
    planned_end_time = Column(DateTime(timezone=True))
    actual_start_time = Column(DateTime(timezone=True))
    actual_end_time = Column(DateTime(timezone=True))
    status = Column(String(20))  # "planned", "active", "completed", "cancelled"
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    work_order = relationship("WorkOrder", back_populates="machine_allocations")
    machine = relationship("Machine", back_populates="allocations")

class ProductionLog(Base):
    """Production progress logs"""
    __tablename__ = "production_logs"
    
    log_id = Column(Integer, primary_key=True, index=True)
    wo_id = Column(Integer, ForeignKey("work_orders.wo_id"), nullable=False, index=True)
    quantity_produced = Column(Numeric(15, 3), nullable=False)
    quantity_rejected = Column(Numeric(15, 3), default=0)
    shift = Column(String(20))  # "morning", "afternoon", "night"
    operator_id = Column(Integer, ForeignKey("users.user_id"))
    supervisor_id = Column(Integer, ForeignKey("users.user_id"))
    machine_id = Column(Integer, ForeignKey("machines.machine_id"))
    downtime_minutes = Column(Integer, default=0)
    downtime_reason = Column(Text)
    notes = Column(Text)
    logged_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    
    # Relationships
    work_order = relationship("WorkOrder", back_populates="production_logs")
