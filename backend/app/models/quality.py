"""
Quality Module Models
QC Inspections, Defects, Batch Approvals
"""

from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, Text, Enum as SQLEnum, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.core.database import Base

class InspectionResult(str, enum.Enum):
    PENDING = "pending"
    PASSED = "passed"
    FAILED = "failed"
    CONDITIONAL = "conditional"

class DefectSeverity(str, enum.Enum):
    MINOR = "minor"
    MAJOR = "major"
    CRITICAL = "critical"

class DefectType(Base):
    """Types of defects"""
    __tablename__ = "defect_types"
    
    type_id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False)
    name = Column(String(200), nullable=False)
    category = Column(String(100))
    description = Column(Text)
    threshold_percentage = Column(Numeric(5, 2))  # Acceptable limit
    severity = Column(SQLEnum(DefectSeverity), default=DefectSeverity.MINOR)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    defect_logs = relationship("DefectLog", back_populates="defect_type")

class QCInspection(Base):
    """Quality control inspections"""
    __tablename__ = "qc_inspections"
    
    inspection_id = Column(Integer, primary_key=True, index=True)
    inspection_number = Column(String(50), unique=True, nullable=False, index=True)
    wo_id = Column(Integer, ForeignKey("work_orders.wo_id"), index=True)
    po_id = Column(Integer, ForeignKey("purchase_orders.po_id"), index=True)
    batch_number = Column(String(50), nullable=False, index=True)
    inspection_date = Column(DateTime(timezone=True), server_default=func.now())
    inspector_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    quantity_inspected = Column(Numeric(15, 3), nullable=False)
    quantity_accepted = Column(Numeric(15, 3))
    quantity_rejected = Column(Numeric(15, 3))
    result = Column(SQLEnum(InspectionResult), default=InspectionResult.PENDING, index=True)
    remarks = Column(Text)
    approved_by = Column(Integer, ForeignKey("users.user_id"))
    approved_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    work_order = relationship("WorkOrder", back_populates="qc_inspections")
    defect_logs = relationship("DefectLog", back_populates="inspection")

class DefectLog(Base):
    """Defect details logged during inspection"""
    __tablename__ = "defect_logs"
    
    defect_id = Column(Integer, primary_key=True, index=True)
    inspection_id = Column(Integer, ForeignKey("qc_inspections.inspection_id"), nullable=False, index=True)
    defect_type_id = Column(Integer, ForeignKey("defect_types.type_id"), nullable=False)
    quantity = Column(Numeric(15, 3), nullable=False)
    severity = Column(SQLEnum(DefectSeverity), nullable=False)
    location = Column(String(200))  # Where defect was found
    description = Column(Text)
    root_cause = Column(Text)
    corrective_action = Column(Text)
    image_url = Column(String(500))
    logged_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    inspection = relationship("QCInspection", back_populates="defect_logs")
    defect_type = relationship("DefectType", back_populates="defect_logs")

class BatchApproval(Base):
    """Batch approval workflow"""
    __tablename__ = "batch_approvals"
    
    approval_id = Column(Integer, primary_key=True, index=True)
    batch_number = Column(String(50), nullable=False, index=True)
    inspection_id = Column(Integer, ForeignKey("qc_inspections.inspection_id"), nullable=False)
    status = Column(String(20), default="pending")  # "pending", "approved", "rejected", "rework"
    approved_by = Column(Integer, ForeignKey("users.user_id"))
    approved_at = Column(DateTime(timezone=True))
    rejection_reason = Column(Text)
    rework_instructions = Column(Text)
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
