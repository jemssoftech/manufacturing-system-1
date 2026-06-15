"""
Sales Module Models
Customers, Sales Orders, Dispatch Notes
"""

from sqlalchemy import Column, Integer, String, Numeric, Date, DateTime, ForeignKey, Text, Enum as SQLEnum, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.core.database import Base

class SOStatus(str, enum.Enum):
    DRAFT = "draft"
    CONFIRMED = "confirmed"
    IN_PRODUCTION = "in_production"
    READY_TO_DISPATCH = "ready_to_dispatch"
    PARTIALLY_DISPATCHED = "partially_dispatched"
    DISPATCHED = "dispatched"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"

class Customer(Base):
    """Customer master data"""
    __tablename__ = "customers"
    
    customer_id = Column(Integer, primary_key=True, index=True)
    customer_code = Column(String(50), unique=True, nullable=False, index=True)
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
    credit_limit = Column(Numeric(15, 2))
    credit_days = Column(Integer)
    region = Column(String(100), index=True)
    customer_type = Column(String(50))  # "retail", "wholesale", "distributor"
    rating = Column(Numeric(3, 2))  # Customer rating 0-5
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    sales_orders = relationship("SalesOrder", back_populates="customer")

class SalesOrder(Base):
    """Sales orders"""
    __tablename__ = "sales_orders"
    
    so_id = Column(Integer, primary_key=True, index=True)
    so_number = Column(String(50), unique=True, nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("customers.customer_id"), nullable=False, index=True)
    order_date = Column(Date, nullable=False, index=True)
    delivery_date = Column(Date)
    status = Column(SQLEnum(SOStatus), default=SOStatus.DRAFT, index=True)
    total_amount = Column(Numeric(15, 2))
    tax_amount = Column(Numeric(15, 2))
    discount_amount = Column(Numeric(15, 2))
    net_amount = Column(Numeric(15, 2))
    payment_terms = Column(String(100))
    shipping_address = Column(Text)
    billing_address = Column(Text)
    notes = Column(Text)
    customer_po_number = Column(String(100))  # Customer's PO reference
    created_by = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    customer = relationship("Customer", back_populates="sales_orders")
    items = relationship("SOItem", back_populates="sales_order", cascade="all, delete-orphan")
    dispatch_notes = relationship("DispatchNote", back_populates="sales_order")

class SOItem(Base):
    """Sales order line items"""
    __tablename__ = "so_items"
    
    item_id = Column(Integer, primary_key=True, index=True)
    so_id = Column(Integer, ForeignKey("sales_orders.so_id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.product_id"), nullable=False)
    quantity = Column(Numeric(15, 3), nullable=False)
    unit_price = Column(Numeric(15, 2), nullable=False)
    total_price = Column(Numeric(15, 2))
    tax_rate = Column(Numeric(5, 2))
    tax_amount = Column(Numeric(15, 2))
    discount_rate = Column(Numeric(5, 2))
    discount_amount = Column(Numeric(15, 2))
    dispatched_quantity = Column(Numeric(15, 3), default=0)
    notes = Column(Text)
    
    # Relationships
    sales_order = relationship("SalesOrder", back_populates="items")
    product = relationship("Product")

class DispatchNote(Base):
    """Dispatch/Delivery notes"""
    __tablename__ = "dispatch_notes"
    
    dispatch_id = Column(Integer, primary_key=True, index=True)
    dispatch_number = Column(String(50), unique=True, nullable=False, index=True)
    so_id = Column(Integer, ForeignKey("sales_orders.so_id"), nullable=False, index=True)
    dispatch_date = Column(DateTime(timezone=True), server_default=func.now())
    vehicle_number = Column(String(50))
    driver_name = Column(String(100))
    driver_phone = Column(String(20))
    transporter = Column(String(200))
    tracking_number = Column(String(100))
    expected_delivery_date = Column(Date)
    actual_delivery_date = Column(DateTime(timezone=True))
    delivery_status = Column(String(50))  # "dispatched", "in_transit", "delivered"
    notes = Column(Text)
    created_by = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    sales_order = relationship("SalesOrder", back_populates="dispatch_notes")
