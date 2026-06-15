"""
Procurement API Routes
Suppliers and Purchase Orders Management
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import List, Optional
from datetime import date, datetime
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.auth import User
from app.models.procurement import Supplier, PurchaseOrder, POItem, POStatus, SupplierStatus
from app.models.inventory import Material

router = APIRouter()

# Schemas
class SupplierCreate(BaseModel):
    supplier_code: str
    name: str
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    payment_terms: Optional[str] = None

class SupplierResponse(BaseModel):
    supplier_id: int
    supplier_code: str
    name: str
    rating: Optional[float] = None
    status: str
    
    class Config:
        from_attributes = True

class POItemCreate(BaseModel):
    material_id: int
    quantity: float
    unit_price: float

class POCreate(BaseModel):
    supplier_id: int
    order_date: date
    expected_delivery_date: Optional[date] = None
    items: List[POItemCreate]
    notes: Optional[str] = None

class POResponse(BaseModel):
    po_id: int
    po_number: str
    supplier_id: int
    order_date: date
    status: str
    total_amount: Optional[float] = None
    
    class Config:
        from_attributes = True

# Supplier Routes
@router.get("/suppliers", response_model=List[SupplierResponse])
async def list_suppliers(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all suppliers with filters"""
    query = db.query(Supplier)
    
    if status:
        query = query.filter(Supplier.status == status)
    
    if search:
        query = query.filter(
            or_(
                Supplier.name.ilike(f"%{search}%"),
                Supplier.supplier_code.ilike(f"%{search}%")
            )
        )
    
    suppliers = query.offset(skip).limit(limit).all()
    return suppliers

@router.post("/suppliers", response_model=SupplierResponse, status_code=201)
async def create_supplier(
    supplier_data: SupplierCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create new supplier"""
    # Check if code exists
    if db.query(Supplier).filter(Supplier.supplier_code == supplier_data.supplier_code).first():
        raise HTTPException(status_code=400, detail="Supplier code already exists")
    
    new_supplier = Supplier(**supplier_data.dict())
    db.add(new_supplier)
    db.commit()
    db.refresh(new_supplier)
    
    return new_supplier

@router.get("/suppliers/{supplier_id}", response_model=SupplierResponse)
async def get_supplier(
    supplier_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get supplier details"""
    supplier = db.query(Supplier).filter(Supplier.supplier_id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return supplier

# Purchase Order Routes
@router.get("/purchase-orders", response_model=List[POResponse])
async def list_purchase_orders(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    supplier_id: Optional[int] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List purchase orders with filters"""
    query = db.query(PurchaseOrder)
    
    if status:
        query = query.filter(PurchaseOrder.status == status)
    if supplier_id:
        query = query.filter(PurchaseOrder.supplier_id == supplier_id)
    if date_from:
        query = query.filter(PurchaseOrder.order_date >= date_from)
    if date_to:
        query = query.filter(PurchaseOrder.order_date <= date_to)
    
    orders = query.order_by(PurchaseOrder.order_date.desc()).offset(skip).limit(limit).all()
    return orders

@router.post("/purchase-orders", response_model=POResponse, status_code=201)
async def create_purchase_order(
    po_data: POCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create new purchase order"""
    # Generate PO number
    po_number = f"PO-{datetime.now().strftime('%Y%m%d')}-{db.query(func.count(PurchaseOrder.po_id)).scalar() + 1:04d}"
    
    # Create PO
    new_po = PurchaseOrder(
        po_number=po_number,
        supplier_id=po_data.supplier_id,
        order_date=po_data.order_date,
        expected_delivery_date=po_data.expected_delivery_date,
        status=POStatus.DRAFT,
        notes=po_data.notes,
        created_by=current_user.user_id
    )
    
    db.add(new_po)
    db.flush()
    
    # Add PO items
    total_amount = 0
    for item_data in po_data.items:
        item_total = item_data.quantity * item_data.unit_price
        total_amount += item_total
        
        po_item = POItem(
            po_id=new_po.po_id,
            material_id=item_data.material_id,
            quantity=item_data.quantity,
            unit_price=item_data.unit_price,
            total_price=item_total
        )
        db.add(po_item)
    
    new_po.total_amount = total_amount
    new_po.net_amount = total_amount
    
    db.commit()
    db.refresh(new_po)
    
    return new_po

@router.get("/purchase-orders/{po_id}")
async def get_purchase_order(
    po_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get PO details with items"""
    po = db.query(PurchaseOrder).filter(PurchaseOrder.po_id == po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
    return {
        "po": po,
        "items": po.items,
        "supplier": po.supplier
    }

@router.put("/purchase-orders/{po_id}/approve")
async def approve_purchase_order(
    po_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Approve purchase order"""
    po = db.query(PurchaseOrder).filter(PurchaseOrder.po_id == po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
    if po.status != POStatus.DRAFT and po.status != POStatus.PENDING_APPROVAL:
        raise HTTPException(status_code=400, detail="PO cannot be approved in current status")
    
    po.status = POStatus.APPROVED
    po.approved_by = current_user.user_id
    po.approved_at = datetime.utcnow()
    
    db.commit()
    
    return {"message": "Purchase order approved successfully", "po_number": po.po_number}

@router.put("/purchase-orders/{po_id}/receive")
async def receive_purchase_order(
    po_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mark PO as received"""
    po = db.query(PurchaseOrder).filter(PurchaseOrder.po_id == po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
    po.status = POStatus.RECEIVED
    po.actual_delivery_date = date.today()
    
    db.commit()
    
    return {"message": "Purchase order marked as received", "po_number": po.po_number}

@router.get("/pending-approvals")
async def get_pending_approvals(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get POs pending approval"""
    pending_pos = db.query(PurchaseOrder).filter(
        or_(
            PurchaseOrder.status == POStatus.PENDING_APPROVAL,
            PurchaseOrder.status == POStatus.DRAFT
        )
    ).order_by(PurchaseOrder.order_date.desc()).all()
    
    return {"count": len(pending_pos), "purchase_orders": pending_pos}

@router.post("/delivery-update")
async def update_delivery_status(
    po_id: int,
    actual_delivery_date: date,
    notes: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update delivery status"""
    po = db.query(PurchaseOrder).filter(PurchaseOrder.po_id == po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
    po.actual_delivery_date = actual_delivery_date
    if notes:
        po.notes = (po.notes or "") + f"\nDelivery update: {notes}"
    
    db.commit()
    
    return {"message": "Delivery status updated", "po_number": po.po_number}
