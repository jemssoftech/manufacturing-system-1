"""
Procurement Module Models
Suppliers, Purchase Orders, and related entities
"""

from sqlalchemy import Column, Integer, String, Numeric, Date, DateTime, ForeignKey, Text, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.core.database import Base

class SupplierStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    BLACKLISTED = "blacklisted"

class POStatus(str, enum.Enum):
    DRAFT = "draft"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    ORDERED = "ordered"
    PARTIALLY_RECEIVED = "partially_received"
    RECEIVED = "received"
    CANCELLED = "cancelled"

class Supplier(Base):
    """Supplier master data"""
    __tablename__ = "suppliers"
    
    supplier_id = Column(Integer, primary_key=True, index=True)
    supplier_code = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(200), nullable=False)
    contact_person = Column(String(100))
    email = Column(String(100))
    phone = Column(String(20))
    address = Column(Text)
    city = Column(String(100))
    state = Column(String(100))
    country = Column(String(100))
    postal_code = Column(String(20))
    tax_id = Column(String(50))
    payment_terms = Column(String(100))
    credit_limit = Column(Numeric(15, 2))
    rating = Column(Numeric(3, 2))  # 0.00 to 5.00
    status = Column(SQLEnum(SupplierStatus), default=SupplierStatus.ACTIVE)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    purchase_orders = relationship("PurchaseOrder", back_populates="supplier")
    supplier_ratings = relationship("SupplierRating", back_populates="supplier")

class PurchaseOrder(Base):
    """Purchase orders"""
    __tablename__ = "purchase_orders"
    
    po_id = Column(Integer, primary_key=True, index=True)
    po_number = Column(String(50), unique=True, nullable=False, index=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.supplier_id"), nullable=False)
    order_date = Column(Date, nullable=False, index=True)
    expected_delivery_date = Column(Date)
    actual_delivery_date = Column(Date)
    status = Column(SQLEnum(POStatus), default=POStatus.DRAFT, index=True)
    total_amount = Column(Numeric(15, 2))
    tax_amount = Column(Numeric(15, 2))
    discount_amount = Column(Numeric(15, 2))
    net_amount = Column(Numeric(15, 2))
    payment_terms = Column(String(100))
    notes = Column(Text)
    approved_by = Column(Integer, ForeignKey("users.user_id"))
    approved_at = Column(DateTime(timezone=True))
    created_by = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    supplier = relationship("Supplier", back_populates="purchase_orders")
    items = relationship("POItem", back_populates="purchase_order", cascade="all, delete-orphan")

class POItem(Base):
    """Purchase order line items"""
    __tablename__ = "po_items"
    
    item_id = Column(Integer, primary_key=True, index=True)
    po_id = Column(Integer, ForeignKey("purchase_orders.po_id"), nullable=False)
    material_id = Column(Integer, ForeignKey("materials.material_id"), nullable=False)
    quantity = Column(Numeric(15, 3), nullable=False)
    unit_price = Column(Numeric(15, 2), nullable=False)
    total_price = Column(Numeric(15, 2))
    tax_rate = Column(Numeric(5, 2))
    tax_amount = Column(Numeric(15, 2))
    discount_rate = Column(Numeric(5, 2))
    discount_amount = Column(Numeric(15, 2))
    received_quantity = Column(Numeric(15, 3), default=0)
    notes = Column(Text)
    
    # Relationships
    purchase_order = relationship("PurchaseOrder", back_populates="items")
    material = relationship("Material")

class SupplierRating(Base):
    """Supplier performance ratings"""
    __tablename__ = "supplier_ratings"
    
    rating_id = Column(Integer, primary_key=True, index=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.supplier_id"), nullable=False)
    po_id = Column(Integer, ForeignKey("purchase_orders.po_id"))
    quality_score = Column(Numeric(3, 2))  # 0-5
    delivery_score = Column(Numeric(3, 2))  # 0-5
    price_score = Column(Numeric(3, 2))  # 0-5
    communication_score = Column(Numeric(3, 2))  # 0-5
    overall_score = Column(Numeric(3, 2))  # 0-5
    delivery_time_days = Column(Integer)
    defect_rate = Column(Numeric(5, 2))  # Percentage
    comments = Column(Text)
    rated_by = Column(Integer, ForeignKey("users.user_id"))
    rated_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    supplier = relationship("Supplier", back_populates="supplier_ratings")
