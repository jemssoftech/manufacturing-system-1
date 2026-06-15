"""
Inventory API Routes
Materials, Stock Management, Movements
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.auth import User
from app.models.inventory import Material, InventoryItem, StockMovement, ReorderAlert, MovementType, MaterialCategory

router = APIRouter()

# Schemas
class MaterialCreate(BaseModel):
    material_code: str
    name: str
    category: str
    unit: str
    reorder_level: Optional[float] = None
    reorder_quantity: Optional[float] = None
    unit_cost: Optional[float] = None

class MaterialResponse(BaseModel):
    material_id: int
    material_code: str
    name: str
    category: str
    unit: str
    reorder_level: Optional[float]
    
    class Config:
        from_attributes = True

class StockReceive(BaseModel):
    material_id: int
    quantity: float
    batch_number: Optional[str] = None
    location: Optional[str] = None
    po_id: Optional[int] = None
    unit_cost: Optional[float] = None

class StockIssue(BaseModel):
    material_id: int
    quantity: float
    batch_number: Optional[str] = None
    wo_id: Optional[int] = None
    notes: Optional[str] = None

# Material Routes
@router.get("/materials", response_model=List[MaterialResponse])
async def list_materials(
    skip: int = 0,
    limit: int = 100,
    category: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all materials"""
    query = db.query(Material).filter(Material.is_active == True)
    
    if category:
        query = query.filter(Material.category == category)
    
    if search:
        query = query.filter(
            or_(
                Material.name.ilike(f"%{search}%"),
                Material.material_code.ilike(f"%{search}%")
            )
        )
    
    materials = query.offset(skip).limit(limit).all()
    return materials

@router.post("/materials", response_model=MaterialResponse, status_code=201)
async def create_material(
    material_data: MaterialCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add new material"""
    if db.query(Material).filter(Material.material_code == material_data.material_code).first():
        raise HTTPException(status_code=400, detail="Material code already exists")
    
    new_material = Material(**material_data.dict())
    db.add(new_material)
    db.commit()
    db.refresh(new_material)
    
    return new_material

@router.get("/materials/{material_id}")
async def get_material(
    material_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get material details with current stock"""
    material = db.query(Material).filter(Material.material_id == material_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
    
    # Get current stock
    current_stock = db.query(func.sum(InventoryItem.quantity)).filter(
        InventoryItem.material_id == material_id
    ).scalar() or 0
    
    return {
        "material": material,
        "current_stock": float(current_stock)
    }

# Stock Routes
@router.get("/stock")
async def get_stock_levels(
    material_id: Optional[int] = None,
    location: Optional[str] = None,
    low_stock: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get current stock levels"""
    # Query to get stock by material
    query = db.query(
        Material.material_id,
        Material.material_code,
        Material.name,
        Material.unit,
        Material.reorder_level,
        func.sum(InventoryItem.quantity).label('current_stock'),
        func.sum(InventoryItem.total_value).label('stock_value')
    ).join(InventoryItem).group_by(Material.material_id)
    
    if material_id:
        query = query.filter(Material.material_id == material_id)
    
    if location:
        query = query.filter(InventoryItem.location == location)
    
    results = query.all()
    
    stock_data = []
    for row in results:
        stock_info = {
            "material_id": row.material_id,
            "material_code": row.material_code,
            "name": row.name,
            "unit": row.unit,
            "current_stock": float(row.current_stock or 0),
            "reorder_level": float(row.reorder_level or 0),
            "stock_value": float(row.stock_value or 0),
            "is_low_stock": (row.current_stock or 0) < (row.reorder_level or 0)
        }
        
        if not low_stock or stock_info["is_low_stock"]:
            stock_data.append(stock_info)
    
    return {
        "total_items": len(stock_data),
        "stock": stock_data
    }

@router.post("/stock/receive")
async def receive_stock(
    receive_data: StockReceive,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Receive stock into inventory"""
    material = db.query(Material).filter(Material.material_id == receive_data.material_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
    
    # Create inventory item
    inventory_item = InventoryItem(
        material_id=receive_data.material_id,
        batch_number=receive_data.batch_number or f"BATCH-{datetime.now().strftime('%Y%m%d%H%M%S')}",
        quantity=receive_data.quantity,
        location=receive_data.location or "MAIN-WAREHOUSE",
        unit_cost=receive_data.unit_cost or material.unit_cost,
        total_value=receive_data.quantity * (receive_data.unit_cost or material.unit_cost or 0),
        po_id=receive_data.po_id,
        quality_status="approved"
    )
    
    db.add(inventory_item)
    
    # Create stock movement record
    movement = StockMovement(
        material_id=receive_data.material_id,
        movement_type=MovementType.RECEIPT,
        quantity=receive_data.quantity,
        batch_number=inventory_item.batch_number,
        to_location=inventory_item.location,
        reference_type="purchase_order" if receive_data.po_id else "manual",
        reference_id=receive_data.po_id,
        unit_cost=inventory_item.unit_cost,
        total_value=inventory_item.total_value,
        created_by=current_user.user_id
    )
    
    db.add(movement)
    db.commit()
    
    return {
        "message": "Stock received successfully",
        "batch_number": inventory_item.batch_number,
        "quantity": float(receive_data.quantity)
    }

@router.post("/stock/issue")
async def issue_stock(
    issue_data: StockIssue,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Issue stock from inventory"""
    # Find inventory item
    if issue_data.batch_number:
        inventory_item = db.query(InventoryItem).filter(
            InventoryItem.material_id == issue_data.material_id,
            InventoryItem.batch_number == issue_data.batch_number
        ).first()
    else:
        inventory_item = db.query(InventoryItem).filter(
            InventoryItem.material_id == issue_data.material_id,
            InventoryItem.quantity > 0
        ).first()
    
    if not inventory_item:
        raise HTTPException(status_code=404, detail="Insufficient stock")
    
    if inventory_item.quantity < issue_data.quantity:
        raise HTTPException(status_code=400, detail=f"Insufficient quantity. Available: {inventory_item.quantity}")
    
    # Deduct quantity
    inventory_item.quantity -= issue_data.quantity
    inventory_item.total_value = inventory_item.quantity * inventory_item.unit_cost
    
    # Create stock movement
    movement = StockMovement(
        material_id=issue_data.material_id,
        movement_type=MovementType.ISSUE,
        quantity=issue_data.quantity,
        batch_number=inventory_item.batch_number,
        from_location=inventory_item.location,
        reference_type="work_order" if issue_data.wo_id else "manual",
        reference_id=issue_data.wo_id,
        unit_cost=inventory_item.unit_cost,
        total_value=issue_data.quantity * inventory_item.unit_cost,
        notes=issue_data.notes,
        created_by=current_user.user_id
    )
    
    db.add(movement)
    db.commit()
    
    return {
        "message": "Stock issued successfully",
        "batch_number": inventory_item.batch_number,
        "quantity": float(issue_data.quantity)
    }

@router.get("/stock/movements")
async def get_stock_movements(
    material_id: Optional[int] = None,
    movement_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get stock movement history"""
    query = db.query(StockMovement)
    
    if material_id:
        query = query.filter(StockMovement.material_id == material_id)
    if movement_type:
        query = query.filter(StockMovement.movement_type == movement_type)
    
    movements = query.order_by(StockMovement.created_at.desc()).offset(skip).limit(limit).all()
    
    return {
        "total": query.count(),
        "movements": movements
    }

@router.get("/stock/ledger")
async def get_stock_ledger(
    material_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get detailed stock ledger for a material"""
    material = db.query(Material).filter(Material.material_id == material_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
    
    movements = db.query(StockMovement).filter(
        StockMovement.material_id == material_id
    ).order_by(StockMovement.created_at).all()
    
    current_stock = db.query(func.sum(InventoryItem.quantity)).filter(
        InventoryItem.material_id == material_id
    ).scalar() or 0
    
    return {
        "material": material,
        "current_stock": float(current_stock),
        "movements": movements
    }

@router.get("/reorder-alerts")
async def get_reorder_alerts(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get reorder alerts for low stock items"""
    # Check for materials below reorder level
    low_stock_materials = db.query(
        Material.material_id,
        Material.material_code,
        Material.name,
        Material.reorder_level,
        Material.reorder_quantity,
        func.sum(InventoryItem.quantity).label('current_stock')
    ).join(
        InventoryItem, Material.material_id == InventoryItem.material_id, isouter=True
    ).group_by(
        Material.material_id
    ).having(
        func.coalesce(func.sum(InventoryItem.quantity), 0) < Material.reorder_level
    ).all()
    
    alerts = []
    for row in low_stock_materials:
        current = float(row.current_stock or 0)
        reorder = float(row.reorder_level or 0)
        
        # Determine priority
        if current == 0:
            priority_level = "critical"
        elif current < reorder * 0.3:
            priority_level = "high"
        elif current < reorder * 0.6:
            priority_level = "medium"
        else:
            priority_level = "low"
        
        alerts.append({
            "material_id": row.material_id,
            "material_code": row.material_code,
            "name": row.name,
            "current_stock": current,
            "reorder_level": reorder,
            "recommended_quantity": float(row.reorder_quantity or reorder),
            "priority": priority_level
        })
    
    if priority:
        alerts = [a for a in alerts if a["priority"] == priority]
    
    return {
        "total_alerts": len(alerts),
        "alerts": alerts
    }

@router.post("/reorder-alerts/auto")
async def auto_reorder(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Trigger automatic reorder for low stock items (Phase 2)"""
    # This will be implemented in Phase 2 with automation scripts
    return {
        "message": "Auto-reorder feature will be available in Phase 2",
        "status": "pending"
    }
