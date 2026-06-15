"""
Quality API Routes
QC Inspections, Defects, Batch Approvals
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.auth import User
from app.models.quality import QCInspection, DefectLog, DefectType, BatchApproval, InspectionResult, DefectSeverity

router = APIRouter()

# Schemas
class DefectLogCreate(BaseModel):
    defect_type_id: int
    quantity: float
    severity: str
    location: Optional[str] = None
    description: Optional[str] = None

class InspectionCreate(BaseModel):
    wo_id: Optional[int] = None
    po_id: Optional[int] = None
    batch_number: str
    quantity_inspected: float
    defects: Optional[List[DefectLogCreate]] = []

class InspectionResponse(BaseModel):
    inspection_id: int
    inspection_number: str
    batch_number: str
    result: str
    quantity_inspected: float
    
    class Config:
        from_attributes = True

# Inspection Routes
@router.get("/inspections", response_model=List[InspectionResponse])
async def list_inspections(
    skip: int = 0,
    limit: int = 100,
    result: Optional[str] = None,
    wo_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all QC inspections"""
    query = db.query(QCInspection)
    
    if result:
        query = query.filter(QCInspection.result == result)
    if wo_id:
        query = query.filter(QCInspection.wo_id == wo_id)
    
    inspections = query.order_by(QCInspection.inspection_date.desc()).offset(skip).limit(limit).all()
    return inspections

@router.post("/inspections", response_model=InspectionResponse, status_code=201)
async def create_inspection(
    inspection_data: InspectionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create new QC inspection"""
    # Generate inspection number
    inspection_number = f"QC-{datetime.now().strftime('%Y%m%d')}-{db.query(func.count(QCInspection.inspection_id)).scalar() + 1:04d}"
    
    # Create inspection
    new_inspection = QCInspection(
        inspection_number=inspection_number,
        wo_id=inspection_data.wo_id,
        po_id=inspection_data.po_id,
        batch_number=inspection_data.batch_number,
        quantity_inspected=inspection_data.quantity_inspected,
        inspector_id=current_user.user_id,
        result=InspectionResult.PENDING
    )
    
    db.add(new_inspection)
    db.flush()
    
    # Add defects if any
    total_defects = 0
    critical_defects = 0
    
    for defect_data in inspection_data.defects:
        defect = DefectLog(
            inspection_id=new_inspection.inspection_id,
            defect_type_id=defect_data.defect_type_id,
            quantity=defect_data.quantity,
            severity=defect_data.severity,
            location=defect_data.location,
            description=defect_data.description
        )
        db.add(defect)
        
        total_defects += defect_data.quantity
        if defect_data.severity == DefectSeverity.CRITICAL:
            critical_defects += defect_data.quantity
    
    # Determine inspection result
    defect_rate = (total_defects / inspection_data.quantity_inspected) * 100 if inspection_data.quantity_inspected > 0 else 0
    
    if critical_defects > 0:
        new_inspection.result = InspectionResult.FAILED
        new_inspection.quantity_rejected = total_defects
        new_inspection.quantity_accepted = inspection_data.quantity_inspected - total_defects
    elif defect_rate > 5:  # 5% threshold
        new_inspection.result = InspectionResult.FAILED
        new_inspection.quantity_rejected = total_defects
        new_inspection.quantity_accepted = inspection_data.quantity_inspected - total_defects
    elif defect_rate > 2:  # 2-5% conditional
        new_inspection.result = InspectionResult.CONDITIONAL
        new_inspection.quantity_accepted = inspection_data.quantity_inspected - critical_defects
        new_inspection.quantity_rejected = critical_defects
    else:
        new_inspection.result = InspectionResult.PASSED
        new_inspection.quantity_accepted = inspection_data.quantity_inspected
        new_inspection.quantity_rejected = 0
    
    db.commit()
    db.refresh(new_inspection)
    
    return new_inspection

@router.get("/inspections/{inspection_id}")
async def get_inspection(
    inspection_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get inspection details"""
    inspection = db.query(QCInspection).filter(QCInspection.inspection_id == inspection_id).first()
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")
    
    # Get defects
    defects = db.query(DefectLog).filter(DefectLog.inspection_id == inspection_id).all()
    
    return {
        "inspection": inspection,
        "defects": defects,
        "defect_count": len(defects),
        "defect_rate": (float(inspection.quantity_rejected or 0) / float(inspection.quantity_inspected)) * 100 if inspection.quantity_inspected > 0 else 0
    }

@router.put("/inspections/{inspection_id}/approve")
async def approve_inspection(
    inspection_id: int,
    notes: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Approve inspection result"""
    inspection = db.query(QCInspection).filter(QCInspection.inspection_id == inspection_id).first()
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")
    
    inspection.approved_by = current_user.user_id
    inspection.approved_at = datetime.utcnow()
    if notes:
        inspection.remarks = (inspection.remarks or "") + f"\nApproval notes: {notes}"
    
    db.commit()
    
    return {
        "message": "Inspection approved successfully",
        "inspection_number": inspection.inspection_number,
        "result": inspection.result
    }

# Defect Routes
@router.post("/defects")
async def log_defect(
    inspection_id: int,
    defect_type_id: int,
    quantity: float,
    severity: str,
    location: Optional[str] = None,
    description: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Log a defect"""
    defect = DefectLog(
        inspection_id=inspection_id,
        defect_type_id=defect_type_id,
        quantity=quantity,
        severity=severity,
        location=location,
        description=description
    )
    
    db.add(defect)
    db.commit()
    db.refresh(defect)
    
    return {
        "message": "Defect logged successfully",
        "defect_id": defect.defect_id
    }

@router.get("/defects")
async def list_defects(
    inspection_id: Optional[int] = None,
    defect_type_id: Optional[int] = None,
    severity: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List defects with filters"""
    query = db.query(DefectLog)
    
    if inspection_id:
        query = query.filter(DefectLog.inspection_id == inspection_id)
    if defect_type_id:
        query = query.filter(DefectLog.defect_type_id == defect_type_id)
    if severity:
        query = query.filter(DefectLog.severity == severity)
    
    defects = query.order_by(DefectLog.logged_at.desc()).offset(skip).limit(limit).all()
    
    return {
        "total": query.count(),
        "defects": defects
    }

@router.get("/defects/types")
async def list_defect_types(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all defect types"""
    defect_types = db.query(DefectType).filter(DefectType.is_active == True).all()
    return {"total": len(defect_types), "defect_types": defect_types}

# Batch Approval Routes
@router.get("/batch-approval/{batch_number}")
async def get_batch_approval_status(
    batch_number: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get batch approval status"""
    approval = db.query(BatchApproval).filter(BatchApproval.batch_number == batch_number).first()
    
    if not approval:
        # Check if inspection exists
        inspection = db.query(QCInspection).filter(QCInspection.batch_number == batch_number).first()
        if not inspection:
            raise HTTPException(status_code=404, detail="Batch not found")
        
        return {
            "batch_number": batch_number,
            "status": "not_approved",
            "inspection": inspection
        }
    
    return {
        "batch_number": batch_number,
        "status": approval.status,
        "approval": approval
    }

@router.post("/batch-approval/{batch_number}")
async def approve_batch(
    batch_number: str,
    action: str,  # "approved", "rejected", "rework"
    notes: Optional[str] = None,
    rejection_reason: Optional[str] = None,
    rework_instructions: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Approve or reject batch"""
    # Get inspection for this batch
    inspection = db.query(QCInspection).filter(QCInspection.batch_number == batch_number).first()
    if not inspection:
        raise HTTPException(status_code=404, detail="No inspection found for this batch")
    
    # Check if already approved
    existing_approval = db.query(BatchApproval).filter(BatchApproval.batch_number == batch_number).first()
    
    if existing_approval:
        existing_approval.status = action
        existing_approval.approved_by = current_user.user_id
        existing_approval.approved_at = datetime.utcnow()
        existing_approval.notes = notes
        existing_approval.rejection_reason = rejection_reason
        existing_approval.rework_instructions = rework_instructions
    else:
        approval = BatchApproval(
            batch_number=batch_number,
            inspection_id=inspection.inspection_id,
            status=action,
            approved_by=current_user.user_id,
            approved_at=datetime.utcnow(),
            notes=notes,
            rejection_reason=rejection_reason,
            rework_instructions=rework_instructions
        )
        db.add(approval)
    
    db.commit()
    
    return {
        "message": f"Batch {action} successfully",
        "batch_number": batch_number,
        "status": action
    }
