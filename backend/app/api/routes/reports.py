"""
Reports API Routes
KPI Dashboard, Analytics, Exports
"""

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, case
from typing import Optional
from datetime import date, datetime, timedelta
from io import BytesIO
import pandas as pd

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.auth import User
from app.models.procurement import PurchaseOrder, POStatus
from app.models.inventory import Material, InventoryItem, StockMovement
from app.models.production import WorkOrder, WOStatus, ProductionLog
from app.models.quality import QCInspection, InspectionResult, DefectLog
from app.models.sales import SalesOrder, SOStatus

router = APIRouter()

@router.get("/dashboard")
async def get_dashboard_kpis(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get KPI summary for dashboard"""
    today = date.today()
    month_start = today.replace(day=1)
    
    # Procurement KPIs
    total_pos = db.query(func.count(PurchaseOrder.po_id)).scalar()
    pending_pos = db.query(func.count(PurchaseOrder.po_id)).filter(
        PurchaseOrder.status.in_([POStatus.DRAFT, POStatus.PENDING_APPROVAL])
    ).scalar()
    
    # Inventory KPIs
    total_materials = db.query(func.count(Material.material_id)).scalar()
    total_stock_value = db.query(func.sum(InventoryItem.total_value)).scalar() or 0
    
    low_stock_count = db.query(func.count(Material.material_id)).select_from(Material).outerjoin(
        InventoryItem
    ).group_by(Material.material_id).having(
        func.coalesce(func.sum(InventoryItem.quantity), 0) < Material.reorder_level
    ).scalar() or 0
    
    # Production KPIs
    total_wos = db.query(func.count(WorkOrder.wo_id)).scalar()
    active_wos = db.query(func.count(WorkOrder.wo_id)).filter(
        WorkOrder.status.in_([WOStatus.IN_PROGRESS, WOStatus.PLANNED, WOStatus.RELEASED])
    ).scalar()
    
    completed_wos_this_month = db.query(func.count(WorkOrder.wo_id)).filter(
        and_(
            WorkOrder.status == WOStatus.COMPLETED,
            WorkOrder.actual_end_date >= month_start
        )
    ).scalar()
    
    # Quality KPIs
    total_inspections = db.query(func.count(QCInspection.inspection_id)).scalar()
    passed_inspections = db.query(func.count(QCInspection.inspection_id)).filter(
        QCInspection.result == InspectionResult.PASSED
    ).scalar()
    
    total_defects = db.query(func.sum(DefectLog.quantity)).scalar() or 0
    
    # Calculate defect rate
    total_inspected = db.query(func.sum(QCInspection.quantity_inspected)).scalar() or 1
    defect_rate = (float(total_defects) / float(total_inspected)) * 100 if total_inspected > 0 else 0
    
    # Sales KPIs
    total_sos = db.query(func.count(SalesOrder.so_id)).scalar()
    pending_sos = db.query(func.count(SalesOrder.so_id)).filter(
        SalesOrder.status.in_([SOStatus.DRAFT, SOStatus.CONFIRMED])
    ).scalar()
    
    total_sales_value = db.query(func.sum(SalesOrder.net_amount)).filter(
        and_(
            SalesOrder.order_date >= month_start,
            SalesOrder.status != SOStatus.CANCELLED
        )
    ).scalar() or 0
    
    return {
        "procurement": {
            "total_purchase_orders": total_pos,
            "pending_approvals": pending_pos,
            "approval_rate": ((total_pos - pending_pos) / total_pos * 100) if total_pos > 0 else 0
        },
        "inventory": {
            "total_materials": total_materials,
            "total_stock_value": float(total_stock_value),
            "low_stock_alerts": low_stock_count,
            "stock_health": "good" if low_stock_count < 5 else "warning" if low_stock_count < 15 else "critical"
        },
        "production": {
            "total_work_orders": total_wos,
            "active_work_orders": active_wos,
            "completed_this_month": completed_wos_this_month,
            "completion_rate": (completed_wos_this_month / total_wos * 100) if total_wos > 0 else 0
        },
        "quality": {
            "total_inspections": total_inspections,
            "passed_inspections": passed_inspections,
            "defect_rate": round(defect_rate, 2),
            "pass_rate": (passed_inspections / total_inspections * 100) if total_inspections > 0 else 0
        },
        "sales": {
            "total_sales_orders": total_sos,
            "pending_orders": pending_sos,
            "sales_value_this_month": float(total_sales_value),
            "order_fulfillment_rate": ((total_sos - pending_sos) / total_sos * 100) if total_sos > 0 else 0
        },
        "timestamp": datetime.now().isoformat()
    }

@router.get("/procurement-report")
async def get_procurement_report(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Procurement analytics report"""
    if not date_from:
        date_from = date.today() - timedelta(days=30)
    if not date_to:
        date_to = date.today()
    
    # PO statistics by status
    po_by_status = db.query(
        PurchaseOrder.status,
        func.count(PurchaseOrder.po_id).label('count'),
        func.sum(PurchaseOrder.net_amount).label('total_amount')
    ).filter(
        and_(
            PurchaseOrder.order_date >= date_from,
            PurchaseOrder.order_date <= date_to
        )
    ).group_by(PurchaseOrder.status).all()
    
    # Top suppliers
    top_suppliers = db.query(
        PurchaseOrder.supplier_id,
        func.count(PurchaseOrder.po_id).label('po_count'),
        func.sum(PurchaseOrder.net_amount).label('total_spend')
    ).filter(
        and_(
            PurchaseOrder.order_date >= date_from,
            PurchaseOrder.order_date <= date_to
        )
    ).group_by(PurchaseOrder.supplier_id).order_by(
        func.sum(PurchaseOrder.net_amount).desc()
    ).limit(10).all()
    
    return {
        "period": {"from": str(date_from), "to": str(date_to)},
        "po_by_status": [
            {"status": row.status.value, "count": row.count, "total_amount": float(row.total_amount or 0)}
            for row in po_by_status
        ],
        "top_suppliers": [
            {"supplier_id": row.supplier_id, "po_count": row.po_count, "total_spend": float(row.total_spend or 0)}
            for row in top_suppliers
        ]
    }

@router.get("/inventory-report")
async def get_inventory_report(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Inventory analytics report"""
    # Stock by category
    stock_by_category = db.query(
        Material.category,
        func.count(Material.material_id).label('material_count'),
        func.sum(InventoryItem.quantity).label('total_quantity'),
        func.sum(InventoryItem.total_value).label('total_value')
    ).join(InventoryItem).group_by(Material.category).all()
    
    # Stock turnover (last 30 days)
    thirty_days_ago = date.today() - timedelta(days=30)
    movements = db.query(
        func.sum(case((StockMovement.movement_type == 'receipt', StockMovement.quantity), else_=0)).label('receipts'),
        func.sum(case((StockMovement.movement_type == 'issue', StockMovement.quantity), else_=0)).label('issues')
    ).filter(StockMovement.created_at >= thirty_days_ago).first()
    
    return {
        "stock_by_category": [
            {
                "category": row.category.value,
                "material_count": row.material_count,
                "total_quantity": float(row.total_quantity or 0),
                "total_value": float(row.total_value or 0)
            }
            for row in stock_by_category
        ],
        "stock_movement_last_30_days": {
            "receipts": float(movements.receipts or 0),
            "issues": float(movements.issues or 0),
            "turnover_rate": (float(movements.issues or 0) / float(movements.receipts or 1)) * 100
        }
    }

@router.get("/production-report")
async def get_production_report(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Production metrics report"""
    if not date_from:
        date_from = date.today() - timedelta(days=30)
    if not date_to:
        date_to = date.today()
    
    # WO completion statistics
    wo_stats = db.query(
        func.count(WorkOrder.wo_id).label('total'),
        func.sum(case((WorkOrder.status == WOStatus.COMPLETED, 1), else_=0)).label('completed'),
        func.sum(WorkOrder.quantity).label('planned_quantity'),
        func.sum(WorkOrder.produced_quantity).label('produced_quantity'),
        func.sum(WorkOrder.rejected_quantity).label('rejected_quantity')
    ).filter(
        and_(
            WorkOrder.planned_start_date >= date_from,
            WorkOrder.planned_start_date <= date_to
        )
    ).first()
    
    # Production by shift
    production_by_shift = db.query(
        ProductionLog.shift,
        func.sum(ProductionLog.quantity_produced).label('total_produced'),
        func.sum(ProductionLog.quantity_rejected).label('total_rejected')
    ).filter(
        ProductionLog.logged_at >= datetime.combine(date_from, datetime.min.time())
    ).group_by(ProductionLog.shift).all()
    
    return {
        "period": {"from": str(date_from), "to": str(date_to)},
        "work_order_stats": {
            "total_work_orders": wo_stats.total,
            "completed": wo_stats.completed,
            "completion_rate": (wo_stats.completed / wo_stats.total * 100) if wo_stats.total > 0 else 0,
            "planned_quantity": float(wo_stats.planned_quantity or 0),
            "produced_quantity": float(wo_stats.produced_quantity or 0),
            "rejected_quantity": float(wo_stats.rejected_quantity or 0),
            "efficiency": (float(wo_stats.produced_quantity or 0) / float(wo_stats.planned_quantity or 1)) * 100
        },
        "production_by_shift": [
            {
                "shift": row.shift,
                "total_produced": float(row.total_produced or 0),
                "total_rejected": float(row.total_rejected or 0),
                "rejection_rate": (float(row.total_rejected or 0) / float(row.total_produced or 1)) * 100
            }
            for row in production_by_shift
        ]
    }

@router.get("/quality-report")
async def get_quality_report(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Quality metrics report"""
    if not date_from:
        date_from = date.today() - timedelta(days=30)
    if not date_to:
        date_to = date.today()
    
    # Inspection statistics
    inspection_stats = db.query(
        QCInspection.result,
        func.count(QCInspection.inspection_id).label('count'),
        func.sum(QCInspection.quantity_inspected).label('total_inspected'),
        func.sum(QCInspection.quantity_rejected).label('total_rejected')
    ).filter(
        and_(
            QCInspection.inspection_date >= datetime.combine(date_from, datetime.min.time()),
            QCInspection.inspection_date <= datetime.combine(date_to, datetime.max.time())
        )
    ).group_by(QCInspection.result).all()
    
    # Defects by type
    defects_by_type = db.query(
        DefectLog.defect_type_id,
        func.sum(DefectLog.quantity).label('total_quantity')
    ).join(QCInspection).filter(
        and_(
            QCInspection.inspection_date >= datetime.combine(date_from, datetime.min.time()),
            QCInspection.inspection_date <= datetime.combine(date_to, datetime.max.time())
        )
    ).group_by(DefectLog.defect_type_id).order_by(
        func.sum(DefectLog.quantity).desc()
    ).limit(10).all()
    
    return {
        "period": {"from": str(date_from), "to": str(date_to)},
        "inspection_statistics": [
            {
                "result": row.result.value,
                "count": row.count,
                "total_inspected": float(row.total_inspected or 0),
                "total_rejected": float(row.total_rejected or 0)
            }
            for row in inspection_stats
        ],
        "top_defects": [
            {"defect_type_id": row.defect_type_id, "total_quantity": float(row.total_quantity or 0)}
            for row in defects_by_type
        ]
    }

@router.get("/sales-report")
async def get_sales_report(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Sales analytics report"""
    if not date_from:
        date_from = date.today() - timedelta(days=30)
    if not date_to:
        date_to = date.today()
    
    # Sales by status
    sales_by_status = db.query(
        SalesOrder.status,
        func.count(SalesOrder.so_id).label('count'),
        func.sum(SalesOrder.net_amount).label('total_amount')
    ).filter(
        and_(
            SalesOrder.order_date >= date_from,
            SalesOrder.order_date <= date_to
        )
    ).group_by(SalesOrder.status).all()
    
    # Sales by region
    sales_by_region = db.query(
        Customer.region,
        func.count(SalesOrder.so_id).label('order_count'),
        func.sum(SalesOrder.net_amount).label('total_sales')
    ).join(SalesOrder).filter(
        and_(
            SalesOrder.order_date >= date_from,
            SalesOrder.order_date <= date_to
        )
    ).group_by(Customer.region).all()
    
    return {
        "period": {"from": str(date_from), "to": str(date_to)},
        "sales_by_status": [
            {"status": row.status.value, "count": row.count, "total_amount": float(row.total_amount or 0)}
            for row in sales_by_status
        ],
        "sales_by_region": [
            {"region": row.region, "order_count": row.order_count, "total_sales": float(row.total_sales or 0)}
            for row in sales_by_region
        ]
    }

@router.get("/export/excel")
async def export_to_excel(
    report_type: str,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Export report to Excel"""
    # Placeholder for Phase 2 - Full implementation with openpyxl
    return {
        "message": "Excel export will be fully implemented in Phase 2",
        "report_type": report_type,
        "format": "xlsx"
    }

@router.get("/export/pdf")
async def export_to_pdf(
    report_type: str,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Export report to PDF"""
    # Placeholder for Phase 2 - Full implementation with reportlab
    return {
        "message": "PDF export will be fully implemented in Phase 2",
        "report_type": report_type,
        "format": "pdf"
    }

@router.get("/trends")
async def get_trends(
    metric: str,  # "sales", "production", "quality"
    period: int = 30,  # days
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get trend data for charts"""
    end_date = date.today()
    start_date = end_date - timedelta(days=period)
    
    if metric == "sales":
        # Daily sales trend
        daily_sales = db.query(
            SalesOrder.order_date,
            func.count(SalesOrder.so_id).label('count'),
            func.sum(SalesOrder.net_amount).label('amount')
        ).filter(
            and_(
                SalesOrder.order_date >= start_date,
                SalesOrder.order_date <= end_date
            )
        ).group_by(SalesOrder.order_date).order_by(SalesOrder.order_date).all()
        
        return {
            "metric": "sales",
            "period": period,
            "data": [
                {"date": str(row.order_date), "count": row.count, "amount": float(row.amount or 0)}
                for row in daily_sales
            ]
        }
    
    return {"message": f"Trend data for {metric} will be implemented"}
