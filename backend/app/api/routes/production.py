"""
Production API Routes
Work Orders, BOM, Machines, Production Tracking
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import date, datetime
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.auth import User
from app.models.production import WorkOrder, Product, BillOfMaterials, Machine, ProductionLog, MachineAllocation, WOStatus

router = APIRouter()

# Schemas
class WorkOrderCreate(BaseModel):
    product_id: int
    quantity: float
    planned_start_date: date
    planned_end_date: Optional[date] = None
    sales_order_id: Optional[int] = None
    priority: Optional[str] = "medium"

class WorkOrderResponse(BaseModel):
    wo_id: int
    wo_number: str
    product_id: int
    quantity: float
    status: str
    planned_start_date: date
    
    class Config:
        from_attributes = True

class ProductionLogCreate(BaseModel):
    wo_id: int
    quantity_produced: float
    quantity_rejected: Optional[float] = 0
    shift: Optional[str] = None
    operator_id: Optional[int] = None
    machine_id: Optional[int] = None
    notes: Optional[str] = None

class MachineAllocationCreate(BaseModel):
    wo_id: int
    machine_id: int
    planned_start_time: datetime
    planned_end_time: datetime

# Work Order Routes
@router.get("/work-orders", response_model=List[WorkOrderResponse])
async def list_work_orders(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    product_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all work orders"""
    query = db.query(WorkOrder)
    
    if status:
        query = query.filter(WorkOrder.status == status)
    if product_id:
        query = query.filter(WorkOrder.product_id == product_id)
    
    work_orders = query.order_by(WorkOrder.planned_start_date.desc()).offset(skip).limit(limit).all()
    return work_orders

@router.post("/work-orders", response_model=WorkOrderResponse, status_code=201)
async def create_work_order(
    wo_data: WorkOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create new work order"""
    # Check if product exists
    product = db.query(Product).filter(Product.product_id == wo_data.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Generate WO number
    wo_number = f"WO-{datetime.now().strftime('%Y%m%d')}-{db.query(func.count(WorkOrder.wo_id)).scalar() + 1:04d}"
    
    new_wo = WorkOrder(
        wo_number=wo_number,
        product_id=wo_data.product_id,
        quantity=wo_data.quantity,
        unit=product.unit,
        planned_start_date=wo_data.planned_start_date,
        planned_end_date=wo_data.planned_end_date,
        sales_order_id=wo_data.sales_order_id,
        priority=wo_data.priority,
        status=WOStatus.DRAFT,
        created_by=current_user.user_id
    )
    
    db.add(new_wo)
    db.commit()
    db.refresh(new_wo)
    
    return new_wo

@router.get("/work-orders/{wo_id}")
async def get_work_order(
    wo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get work order details"""
    wo = db.query(WorkOrder).filter(WorkOrder.wo_id == wo_id).first()
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")
    
    # Get BOM requirements
    bom_items = db.query(BillOfMaterials).filter(
        BillOfMaterials.product_id == wo.product_id
    ).all()
    
    # Get production logs
    logs = db.query(ProductionLog).filter(ProductionLog.wo_id == wo_id).all()
    
    return {
        "work_order": wo,
        "product": wo.product,
        "bom_requirements": bom_items,
        "production_logs": logs,
        "produced_quantity": float(wo.produced_quantity or 0),
        "progress_percentage": (float(wo.produced_quantity or 0) / float(wo.quantity)) * 100 if wo.quantity > 0 else 0
    }

@router.put("/work-orders/{wo_id}/start")
async def start_work_order(
    wo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Start work order production"""
    wo = db.query(WorkOrder).filter(WorkOrder.wo_id == wo_id).first()
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")
    
    if wo.status not in [WOStatus.DRAFT, WOStatus.PLANNED, WOStatus.RELEASED]:
        raise HTTPException(status_code=400, detail="Work order cannot be started in current status")
    
    wo.status = WOStatus.IN_PROGRESS
    wo.actual_start_date = datetime.utcnow()
    
    db.commit()
    
    return {
        "message": "Work order started successfully",
        "wo_number": wo.wo_number,
        "status": wo.status
    }

@router.put("/work-orders/{wo_id}/complete")
async def complete_work_order(
    wo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Complete work order"""
    wo = db.query(WorkOrder).filter(WorkOrder.wo_id == wo_id).first()
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")
    
    if wo.status != WOStatus.IN_PROGRESS:
        raise HTTPException(status_code=400, detail="Only in-progress work orders can be completed")
    
    wo.status = WOStatus.COMPLETED
    wo.actual_end_date = datetime.utcnow()
    
    db.commit()
    
    return {
        "message": "Work order completed successfully",
        "wo_number": wo.wo_number,
        "produced_quantity": float(wo.produced_quantity or 0)
    }

@router.post("/work-orders/{wo_id}/log")
async def log_production(
    log_data: ProductionLogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Log production progress"""
    wo = db.query(WorkOrder).filter(WorkOrder.wo_id == log_data.wo_id).first()
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")
    
    # Create production log
    production_log = ProductionLog(
        wo_id=log_data.wo_id,
        quantity_produced=log_data.quantity_produced,
        quantity_rejected=log_data.quantity_rejected,
        shift=log_data.shift,
        operator_id=log_data.operator_id or current_user.user_id,
        supervisor_id=current_user.user_id,
        machine_id=log_data.machine_id,
        notes=log_data.notes
    )
    
    db.add(production_log)
    
    # Update work order quantities
    wo.produced_quantity = (wo.produced_quantity or 0) + log_data.quantity_produced
    wo.rejected_quantity = (wo.rejected_quantity or 0) + log_data.quantity_rejected
    
    db.commit()
    
    return {
        "message": "Production logged successfully",
        "wo_number": wo.wo_number,
        "total_produced": float(wo.produced_quantity),
        "progress_percentage": (float(wo.produced_quantity) / float(wo.quantity)) * 100
    }

# Machine Routes
@router.get("/machines")
async def list_machines(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all machines"""
    query = db.query(Machine).filter(Machine.is_active == True)
    
    if status:
        query = query.filter(Machine.status == status)
    
    machines = query.all()
    return {"total": len(machines), "machines": machines}

@router.get("/machines/{machine_id}/status")
async def get_machine_status(
    machine_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get machine status and current allocation"""
    machine = db.query(Machine).filter(Machine.machine_id == machine_id).first()
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")
    
    # Get current allocation
    current_allocation = db.query(MachineAllocation).filter(
        MachineAllocation.machine_id == machine_id,
        MachineAllocation.status == "active"
    ).first()
    
    return {
        "machine": machine,
        "current_status": machine.status,
        "current_allocation": current_allocation,
        "next_maintenance_date": machine.next_maintenance_date
    }

@router.post("/machines/allocate")
async def allocate_machine(
    allocation_data: MachineAllocationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Allocate machine to work order"""
    # Check if machine is available
    machine = db.query(Machine).filter(Machine.machine_id == allocation_data.machine_id).first()
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")
    
    # Check for conflicts
    conflict = db.query(MachineAllocation).filter(
        MachineAllocation.machine_id == allocation_data.machine_id,
        MachineAllocation.status == "active",
        MachineAllocation.planned_end_time > allocation_data.planned_start_time
    ).first()
    
    if conflict:
        raise HTTPException(status_code=400, detail="Machine already allocated during this time")
    
    # Create allocation
    allocation = MachineAllocation(
        wo_id=allocation_data.wo_id,
        machine_id=allocation_data.machine_id,
        planned_start_time=allocation_data.planned_start_time,
        planned_end_time=allocation_data.planned_end_time,
        status="planned"
    )
    
    db.add(allocation)
    db.commit()
    
    return {
        "message": "Machine allocated successfully",
        "allocation_id": allocation.allocation_id
    }

# BOM Routes
@router.get("/bom")
async def list_bom(
    product_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List bill of materials"""
    query = db.query(BillOfMaterials).filter(BillOfMaterials.is_active == True)
    
    if product_id:
        query = query.filter(BillOfMaterials.product_id == product_id)
    
    bom_items = query.all()
    return {"total": len(bom_items), "bom": bom_items}

@router.post("/bom")
async def create_bom_entry(
    product_id: int,
    material_id: int,
    quantity_required: float,
    wastage_percentage: Optional[float] = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create BOM entry"""
    bom_entry = BillOfMaterials(
        product_id=product_id,
        material_id=material_id,
        quantity_required=quantity_required,
        wastage_percentage=wastage_percentage
    )
    
    db.add(bom_entry)
    db.commit()
    db.refresh(bom_entry)
    
    return {
        "message": "BOM entry created successfully",
        "bom_id": bom_entry.bom_id
    }
