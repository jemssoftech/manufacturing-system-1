const express = require('express');
const router = express.Router();
const { Op, fn, col, literal } = require('sequelize');
const {
  PurchaseOrder,
  Material,
  InventoryItem,
  WorkOrder,
  ProductionLog,
  QCInspection,
  DefectLog,
  SalesOrder,
  Customer,
  SOItem,
  sequelize
} = require('../models');
const { authenticateToken } = require('../middleware/auth');

// 1. Dashboard KPI summary
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    // 1.1 Procurement KPIs
    const total_pos = await PurchaseOrder.count();
    const pending_pos = await PurchaseOrder.count({
      where: {
        status: { [Op.in]: ['draft', 'pending_approval'] }
      }
    });

    // 1.2 Inventory KPIs
    const total_materials = await Material.count();
    const total_stock_value = await InventoryItem.sum('total_value') || 0;

    const low_stock_materials = await Material.findAll({
      attributes: [
        'material_id',
        [fn('COALESCE', fn('SUM', col('inventory_items.quantity')), 0), 'current_stock']
      ],
      include: [{
        model: InventoryItem,
        as: 'inventory_items',
        attributes: [],
        required: false
      }],
      group: ['Material.material_id'],
      having: literal('current_stock < Material.reorder_level'),
      raw: true
    });
    const low_stock_count = low_stock_materials.length;

    // 1.3 Production KPIs
    const total_wos = await WorkOrder.count();
    const active_wos = await WorkOrder.count({
      where: {
        status: { [Op.in]: ['in_progress', 'planned', 'released'] }
      }
    });
    const completed_wos_this_month = await WorkOrder.count({
      where: {
        status: 'completed',
        actual_end_date: { [Op.gte]: monthStart }
      }
    });

    // 1.4 Quality KPIs
    const total_inspections = await QCInspection.count();
    const passed_inspections = await QCInspection.count({
      where: { result: 'passed' }
    });
    const total_defects = await DefectLog.sum('quantity') || 0;
    const total_inspected = await QCInspection.sum('quantity_inspected') || 1;
    const defect_rate = total_inspected > 0 ? (total_defects / total_inspected) * 100 : 0;

    // 1.5 Sales KPIs
    const total_sos = await SalesOrder.count();
    const pending_sos = await SalesOrder.count({
      where: {
        status: { [Op.in]: ['draft', 'confirmed'] }
      }
    });
    const total_sales_value = await SalesOrder.sum('net_amount', {
      where: {
        order_date: { [Op.gte]: monthStart },
        status: { [Op.ne]: 'cancelled' }
      }
    }) || 0;

    return res.json({
      procurement: {
        total_purchase_orders: total_pos,
        pending_approvals: pending_pos,
        approval_rate: total_pos > 0 ? ((total_pos - pending_pos) / total_pos) * 100 : 0
      },
      inventory: {
        total_materials,
        total_stock_value: parseFloat(total_stock_value),
        low_stock_alerts: low_stock_count,
        stock_health: low_stock_count < 5 ? 'good' : low_stock_count < 15 ? 'warning' : 'critical'
      },
      production: {
        total_work_orders: total_wos,
        active_work_orders: active_wos,
        completed_this_month: completed_wos_this_month,
        completion_rate: total_wos > 0 ? (completed_wos_this_month / total_wos) * 100 : 0
      },
      quality: {
        total_inspections,
        passed_inspections,
        defect_rate: parseFloat(defect_rate.toFixed(2)),
        pass_rate: total_inspections > 0 ? (passed_inspections / total_inspections) * 100 : 0
      },
      sales: {
        total_sales_orders: total_sos,
        pending_orders: pending_sos,
        sales_value_this_month: parseFloat(total_sales_value),
        order_fulfillment_rate: total_sos > 0 ? ((total_sos - pending_sos) / total_sos) * 100 : 0
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Get Dashboard KPIs Error:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

// 2. Procurement Report
router.get('/procurement-report', authenticateToken, async (req, res) => {
  try {
    let { date_from, date_to } = req.query;

    const today = new Date();
    if (!date_from) {
      const past30 = new Date();
      past30.setDate(today.getDate() - 30);
      date_from = past30.toISOString().split('T')[0];
    }
    if (!date_to) {
      date_to = today.toISOString().split('T')[0];
    }

    const whereClause = {
      order_date: {
        [Op.between]: [date_from, date_to]
      }
    };

    const po_by_status = await PurchaseOrder.findAll({
      where: whereClause,
      attributes: [
        'status',
        [fn('COUNT', col('po_id')), 'count'],
        [fn('SUM', col('net_amount')), 'total_amount']
      ],
      group: ['status']
    });

    const top_suppliers = await PurchaseOrder.findAll({
      where: whereClause,
      attributes: [
        'supplier_id',
        [fn('COUNT', col('po_id')), 'po_count'],
        [fn('SUM', col('net_amount')), 'total_spend']
      ],
      group: ['supplier_id'],
      order: [[fn('SUM', col('net_amount')), 'DESC']],
      limit: 10
    });

    return res.json({
      period: { from: date_from, to: date_to },
      po_by_status: po_by_status.map(row => ({
        status: row.status,
        count: parseInt(row.get('count')),
        total_amount: parseFloat(row.get('total_amount') || 0)
      })),
      top_suppliers: top_suppliers.map(row => ({
        supplier_id: row.supplier_id,
        po_count: parseInt(row.get('po_count')),
        total_spend: parseFloat(row.get('total_spend') || 0)
      }))
    });

  } catch (error) {
    console.error('Procurement Report Error:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

// 3. Inventory Report
router.get('/inventory-report', authenticateToken, async (req, res) => {
  try {
    const stock_by_category = await Material.findAll({
      attributes: [
        'category',
        [fn('COUNT', col('materials.material_id')), 'material_count'],
        [fn('SUM', col('inventory_items.quantity')), 'total_quantity'],
        [fn('SUM', col('inventory_items.total_value')), 'total_value']
      ],
      include: [{
        model: InventoryItem,
        as: 'inventory_items',
        attributes: []
      }],
      group: ['category'],
      raw: true
    });

    const thirty_days_ago = new Date();
    thirty_days_ago.setDate(thirty_days_ago.getDate() - 30);

    const receipts = await StockMovement.sum('quantity', {
      where: {
        movement_type: 'receipt',
        created_at: { [Op.gte]: thirty_days_ago }
      }
    }) || 0;

    const issues = await StockMovement.sum('quantity', {
      where: {
        movement_type: 'issue',
        created_at: { [Op.gte]: thirty_days_ago }
      }
    }) || 0;

    return res.json({
      stock_by_category: stock_by_category.map(row => ({
        category: row.category,
        material_count: parseInt(row.material_count),
        total_quantity: parseFloat(row.total_quantity || 0),
        total_value: parseFloat(row.total_value || 0)
      })),
      stock_movement_last_30_days: {
        receipts: parseFloat(receipts),
        issues: parseFloat(issues),
        turnover_rate: receipts > 0 ? (issues / receipts) * 100 : 0
      }
    });

  } catch (error) {
    console.error('Inventory Report Error:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

// 4. Production Report
router.get('/production-report', authenticateToken, async (req, res) => {
  try {
    let { date_from, date_to } = req.query;

    const today = new Date();
    if (!date_from) {
      const past30 = new Date();
      past30.setDate(today.getDate() - 30);
      date_from = past30.toISOString().split('T')[0];
    }
    if (!date_to) {
      date_to = today.toISOString().split('T')[0];
    }

    const whereClause = {
      planned_start_date: {
        [Op.between]: [date_from, date_to]
      }
    };

    const wo_stats = await WorkOrder.findOne({
      where: whereClause,
      attributes: [
        [fn('COUNT', col('wo_id')), 'total'],
        [fn('SUM', literal("CASE WHEN status = 'completed' THEN 1 ELSE 0 END")), 'completed'],
        [fn('SUM', col('quantity')), 'planned_quantity'],
        [fn('SUM', col('produced_quantity')), 'produced_quantity'],
        [fn('SUM', col('rejected_quantity')), 'rejected_quantity']
      ],
      raw: true
    });

    const startDateTime = new Date(date_from);
    startDateTime.setHours(0, 0, 0, 0);

    const production_by_shift = await ProductionLog.findAll({
      where: {
        logged_at: { [Op.gte]: startDateTime }
      },
      attributes: [
        'shift',
        [fn('SUM', col('quantity_produced')), 'total_produced'],
        [fn('SUM', col('quantity_rejected')), 'total_rejected']
      ],
      group: ['shift']
    });

    const total = parseInt(wo_stats.total || 0);
    const completed = parseInt(wo_stats.completed || 0);
    const planned_quantity = parseFloat(wo_stats.planned_quantity || 0);
    const produced_quantity = parseFloat(wo_stats.produced_quantity || 0);

    return res.json({
      period: { from: date_from, to: date_to },
      work_order_stats: {
        total_work_orders: total,
        completed,
        completion_rate: total > 0 ? (completed / total) * 100 : 0,
        planned_quantity,
        produced_quantity,
        rejected_quantity: parseFloat(wo_stats.rejected_quantity || 0),
        efficiency: planned_quantity > 0 ? (produced_quantity / planned_quantity) * 100 : 0
      },
      production_by_shift: production_by_shift.map(row => {
        const prod = parseFloat(row.get('total_produced') || 0);
        const rej = parseFloat(row.get('total_rejected') || 0);
        return {
          shift: row.shift,
          total_produced: prod,
          total_rejected: rej,
          rejection_rate: prod > 0 ? (rej / prod) * 100 : 0
        };
      })
    });

  } catch (error) {
    console.error('Production Report Error:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

// 5. Quality Report
router.get('/quality-report', authenticateToken, async (req, res) => {
  try {
    let { date_from, date_to } = req.query;

    const today = new Date();
    if (!date_from) {
      const past30 = new Date();
      past30.setDate(today.getDate() - 30);
      date_from = past30.toISOString().split('T')[0];
    }
    if (!date_to) {
      date_to = today.toISOString().split('T')[0];
    }

    const startDateTime = new Date(date_from);
    startDateTime.setHours(0, 0, 0, 0);

    const endDateTime = new Date(date_to);
    endDateTime.setHours(23, 59, 59, 999);

    const whereClause = {
      inspection_date: {
        [Op.between]: [startDateTime, endDateTime]
      }
    };

    const inspection_stats = await QCInspection.findAll({
      where: whereClause,
      attributes: [
        'result',
        [fn('COUNT', col('inspection_id')), 'count'],
        [fn('SUM', col('quantity_inspected')), 'total_inspected'],
        [fn('SUM', col('quantity_rejected')), 'total_rejected']
      ],
      group: ['result']
    });

    const defects_by_type = await DefectLog.findAll({
      attributes: [
        'defect_type_id',
        [fn('SUM', col('quantity')), 'total_quantity']
      ],
      include: [{
        model: QCInspection,
        as: 'inspection',
        attributes: [],
        where: whereClause
      }],
      group: ['defect_type_id'],
      order: [[fn('SUM', col('quantity')), 'DESC']],
      limit: 10
    });

    return res.json({
      period: { from: date_from, to: date_to },
      inspection_statistics: inspection_stats.map(row => ({
        result: row.result,
        count: parseInt(row.get('count')),
        total_inspected: parseFloat(row.get('total_inspected') || 0),
        total_rejected: parseFloat(row.get('total_rejected') || 0)
      })),
      top_defects: defects_by_type.map(row => ({
        defect_type_id: row.defect_type_id,
        total_quantity: parseFloat(row.get('total_quantity') || 0)
      }))
    });

  } catch (error) {
    console.error('Quality Report Error:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

// 6. Sales Report
router.get('/sales-report', authenticateToken, async (req, res) => {
  try {
    let { date_from, date_to } = req.query;

    const today = new Date();
    if (!date_from) {
      const past30 = new Date();
      past30.setDate(today.getDate() - 30);
      date_from = past30.toISOString().split('T')[0];
    }
    if (!date_to) {
      date_to = today.toISOString().split('T')[0];
    }

    const whereClause = {
      order_date: {
        [Op.between]: [date_from, date_to]
      }
    };

    const sales_by_status = await SalesOrder.findAll({
      where: whereClause,
      attributes: [
        'status',
        [fn('COUNT', col('so_id')), 'count'],
        [fn('SUM', col('net_amount')), 'total_amount']
      ],
      group: ['status']
    });

    const sales_by_region = await Customer.findAll({
      attributes: [
        'region',
        [fn('COUNT', col('sales_orders.so_id')), 'order_count'],
        [fn('SUM', col('sales_orders.net_amount')), 'total_sales']
      ],
      include: [{
        model: SalesOrder,
        as: 'sales_orders',
        attributes: [],
        where: whereClause
      }],
      group: ['region'],
      raw: true
    });

    return res.json({
      period: { from: date_from, to: date_to },
      sales_by_status: sales_by_status.map(row => ({
        status: row.status,
        count: parseInt(row.get('count')),
        total_amount: parseFloat(row.get('total_amount') || 0)
      })),
      sales_by_region: sales_by_region.map(row => ({
        region: row.region,
        order_count: parseInt(row.order_count),
        total_sales: parseFloat(row.total_sales || 0)
      }))
    });

  } catch (error) {
    console.error('Sales Report Error:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

// 7. Placeholders for exports
router.get('/export/excel', authenticateToken, async (req, res) => {
  return res.json({
    message: 'Excel export will be fully implemented in Phase 2',
    report_type: req.query.report_type,
    format: 'xlsx'
  });
});

router.get('/export/pdf', authenticateToken, async (req, res) => {
  return res.json({
    message: 'PDF export will be fully implemented in Phase 2',
    report_type: req.query.report_type,
    format: 'pdf'
  });
});

// 8. Trends
router.get('/trends', authenticateToken, async (req, res) => {
  try {
    const { metric } = req.query;
    const period = parseInt(req.query.period) || 30;

    const end_date = new Date();
    const start_date = new Date();
    start_date.setDate(end_date.getDate() - period);

    if (metric === 'sales') {
      const daily_sales = await SalesOrder.findAll({
        where: {
          order_date: { [Op.between]: [start_date, end_date] }
        },
        attributes: [
          'order_date',
          [fn('COUNT', col('so_id')), 'count'],
          [fn('SUM', col('net_amount')), 'amount']
        ],
        group: ['order_date'],
        order: [['order_date', 'ASC']]
      });

      return res.json({
        metric: 'sales',
        period,
        data: daily_sales.map(row => ({
          date: row.order_date,
          count: parseInt(row.get('count')),
          amount: parseFloat(row.get('amount') || 0)
        }))
      });
    }

    return res.json({ message: `Trend data for ${metric} will be implemented` });

  } catch (error) {
    console.error('Get Trends Error:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

module.exports = router;
