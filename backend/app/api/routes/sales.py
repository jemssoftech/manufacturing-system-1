"""
Sales API Routes
Customers, Sales Orders, Dispatch Management
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import List, Optional
from datetime import date, datetime
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.auth import User
from app.models.sales import Customer, SalesOrder, SOItem, DispatchNote, SOStatus

router = APIRouter()

# Schemas
class CustomerCreate(BaseModel):
    customer_code: str
    name: str
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    credit_limit: Optional[float] = None
    region: Optional[str] = None

class CustomerResponse(BaseModel):
    customer_id: int
    customer_code: str
    name: str
    region: Optional[str]
    rating: Optional[float]
    
    class Config:
        from_attributes = True

class SOItemCreate(BaseModel):
    product_id: int
    quantity: float
    unit_price: float

class SOCreate(BaseModel):
    customer_id: int
    order_date: date
    delivery_date: Optional[date] = None
    items: List[SOItemCreate]
    customer_po_number: Optional[str] = None
    notes: Optional[str] = None

class SOResponse(BaseModel):
    so_id: int
    so_number: str
    customer_id: int
    order_date: date
    status: str
    total_amount: Optional[float]
    
    class Config:
        from_attributes = True

class DispatchCreate(BaseModel):
    so_id: int
    vehicle_number: Optional[str] = None
    driver_name: Optional[str] = None
    driver_phone: Optional[str] = None
    transporter: Optional[str] = None
    expected_delivery_date: Optional[date] = None

# Customer Routes
@router.get("/customers", response_model=List[CustomerResponse])
async def list_customers(
    skip: int = 0,
    limit: int = 100,
    region: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all customers"""
    query = db.query(Customer).filter(Customer.is_active == True)
    
    if region:
        query = query.filter(Customer.region == region)
    
    if search:
        query = query.filter(
            or_(
                Customer.name.ilike(f"%{search}%"),
                Customer.customer_code.ilike(f"%{search}%")
            )
        )
    
    customers = query.offset(skip).limit(limit).all()
    return customers

@router.post("/customers", response_model=CustomerResponse, status_code=201)
async def create_customer(
    customer_data: CustomerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create new customer"""
    if db.query(Customer).filter(Customer.customer_code == customer_data.customer_code).first():
        raise HTTPException(status_code=400, detail="Customer code already exists")
    
    new_customer = Customer(**customer_data.dict())
    db.add(new_customer)
    db.commit()
    db.refresh(new_customer)
    
    return new_customer

@router.get("/customers/{customer_id}", response_model=CustomerResponse)
async def get_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get customer details"""
    customer = db.query(Customer).filter(Customer.customer_id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer

@router.put("/customers/{customer_id}")
async def update_customer(
    customer_id: int,
    customer_data: CustomerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update customer"""
    customer = db.query(Customer).filter(Customer.customer_id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    for field, value in customer_data.dict(exclude_unset=True).items():
        setattr(customer, field, value)
    
    db.commit()
    db.refresh(customer)
    
    return customer

# Sales Order Routes
@router.get("/sales-orders", response_model=List[SOResponse])
async def list_sales_orders(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    customer_id: Optional[int] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List sales orders with filters"""
    query = db.query(SalesOrder)
    
    if status:
        query = query.filter(SalesOrder.status == status)
    if customer_id:
        query = query.filter(SalesOrder.customer_id == customer_id)
    if date_from:
        query = query.filter(SalesOrder.order_date >= date_from)
    if date_to:
        query = query.filter(SalesOrder.order_date <= date_to)
    
    orders = query.order_by(SalesOrder.order_date.desc()).offset(skip).limit(limit).all()
    return orders

@router.post("/sales-orders", response_model=SOResponse, status_code=201)
async def create_sales_order(
    so_data: SOCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create new sales order"""
    # Check customer exists
    customer = db.query(Customer).filter(Customer.customer_id == so_data.customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # Generate SO number
    so_number = f"SO-{datetime.now().strftime('%Y%m%d')}-{db.query(func.count(SalesOrder.so_id)).scalar() + 1:04d}"
    
    # Create SO
    new_so = SalesOrder(
        so_number=so_number,
        customer_id=so_data.customer_id,
        order_date=so_data.order_date,
        delivery_date=so_data.delivery_date,
        customer_po_number=so_data.customer_po_number,
        notes=so_data.notes,
        status=SOStatus.DRAFT,
        created_by=current_user.user_id
    )
    
    db.add(new_so)
    db.flush()
    
    # Add SO items
    total_amount = 0
    for item_data in so_data.items:
        item_total = item_data.quantity * item_data.unit_price
        total_amount += item_total
        
        so_item = SOItem(
            so_id=new_so.so_id,
            product_id=item_data.product_id,
            quantity=item_data.quantity,
            unit_price=item_data.unit_price,
            total_price=item_total
        )
        db.add(so_item)
    
    new_so.total_amount = total_amount
    new_so.net_amount = total_amount
    
    db.commit()
    db.refresh(new_so)
    
    return new_so

@router.get("/sales-orders/{so_id}")
async def get_sales_order(
    so_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get SO details with items"""
    so = db.query(SalesOrder).filter(SalesOrder.so_id == so_id).first()
    if not so:
        raise HTTPException(status_code=404, detail="Sales order not found")
    
    return {
        "sales_order": so,
        "items": so.items,
        "customer": so.customer,
        "dispatch_notes": so.dispatch_notes
    }

@router.put("/sales-orders/{so_id}/confirm")
async def confirm_sales_order(
    so_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Confirm sales order"""
    so = db.query(SalesOrder).filter(SalesOrder.so_id == so_id).first()
    if not so:
        raise HTTPException(status_code=404, detail="Sales order not found")
    
    if so.status != SOStatus.DRAFT:
        raise HTTPException(status_code=400, detail="Only draft orders can be confirmed")
    
    so.status = SOStatus.CONFIRMED
    db.commit()
    
    return {
        "message": "Sales order confirmed successfully",
        "so_number": so.so_number,
        "status": so.status
    }

@router.post("/sales-orders/{so_id}/items")
async def add_so_items(
    so_id: int,
    items: List[SOItemCreate],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add items to sales order"""
    so = db.query(SalesOrder).filter(SalesOrder.so_id == so_id).first()
    if not so:
        raise HTTPException(status_code=404, detail="Sales order not found")
    
    added_items = []
    for item_data in items:
        item_total = item_data.quantity * item_data.unit_price
        
        so_item = SOItem(
            so_id=so_id,
            product_id=item_data.product_id,
            quantity=item_data.quantity,
            unit_price=item_data.unit_price,
            total_price=item_total
        )
        db.add(so_item)
        added_items.append(so_item)
        
        so.total_amount = (so.total_amount or 0) + item_total
        so.net_amount = so.total_amount
    
    db.commit()
    
    return {
        "message": f"{len(added_items)} items added successfully",
        "items_added": len(added_items)
    }

# Dispatch Routes
@router.post("/dispatch", status_code=201)
async def create_dispatch_note(
    dispatch_data: DispatchCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create dispatch note"""
    so = db.query(SalesOrder).filter(SalesOrder.so_id == dispatch_data.so_id).first()
    if not so:
        raise HTTPException(status_code=404, detail="Sales order not found")
    
    if so.status not in [SOStatus.CONFIRMED, SOStatus.IN_PRODUCTION, SOStatus.READY_TO_DISPATCH]:
        raise HTTPException(status_code=400, detail="Sales order not ready for dispatch")
    
    # Generate dispatch number
    dispatch_number = f"DN-{datetime.now().strftime('%Y%m%d')}-{db.query(func.count(DispatchNote.dispatch_id)).scalar() + 1:04d}"
    
    dispatch_note = DispatchNote(
        dispatch_number=dispatch_number,
        so_id=dispatch_data.so_id,
        vehicle_number=dispatch_data.vehicle_number,
        driver_name=dispatch_data.driver_name,
        driver_phone=dispatch_data.driver_phone,
        transporter=dispatch_data.transporter,
        expected_delivery_date=dispatch_data.expected_delivery_date,
        delivery_status="dispatched",
        created_by=current_user.user_id
    )
    
    db.add(dispatch_note)
    
    # Update SO status
    so.status = SOStatus.DISPATCHED
    
    db.commit()
    db.refresh(dispatch_note)
    
    return {
        "message": "Dispatch note created successfully",
        "dispatch_number": dispatch_number,
        "so_number": so.so_number
    }

@router.get("/dispatch/{so_id}")
async def get_dispatch_details(
    so_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get dispatch details for sales order"""
    dispatch_notes = db.query(DispatchNote).filter(DispatchNote.so_id == so_id).all()
    
    if not dispatch_notes:
        raise HTTPException(status_code=404, detail="No dispatch notes found for this order")
    
    return {
        "so_id": so_id,
        "total_dispatches": len(dispatch_notes),
        "dispatch_notes": dispatch_notes
    }
