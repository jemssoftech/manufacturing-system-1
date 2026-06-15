const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { WorkOrder, Product, BillOfMaterials, Machine, ProductionLog, MachineAllocation, sequelize } = require('../models');
const { authenticateToken } = require('../middleware/auth');

// 1. List all work orders
router.get('/work-orders', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.skip) || 0;
    const { status, product_id } = req.query;

    const whereClause = {};
    if (status) {
      whereClause.status = status;
    }
    if (product_id) {
      whereClause.product_id = parseInt(product_id);
    }

    const work_orders = await WorkOrder.findAll({
      where: whereClause,
      order: [['planned_start_date', 'DESC']],
      limit,
      offset
    });

    return res.json(work_orders);
  } catch (error) {
    console.error('List Work Orders Error:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

// 2. Create new work order
router.post('/work-orders', authenticateToken, async (req, res) => {
  try {
    const { product_id, quantity, planned_start_date, planned_end_date, sales_order_id, priority } = req.body;

    const product = await Product.findByPk(product_id);
    if (!product) {
      return res.status(404).json({ detail: 'Product not found' });
    }

    // Generate WO number (WO-YYYYMMDD-XXXX)
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = await WorkOrder.count();
    const wo_number = `WO-${todayStr}-${(count + 1).toString().padStart(4, '0')}`;

    const new_wo = await WorkOrder.create({
      wo_number,
      product_id,
      quantity,
      unit: product.unit,
      planned_start_date,
      planned_end_date,
      sales_order_id,
      priority: priority || 'medium',
      status: 'draft',
      created_by: req.user.user_id
    });

    return res.status(201).json(new_wo);
  } catch (error) {
    console.error('Create Work Order Error:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

// 3. Get work order details
router.get('/work-orders/:wo_id', authenticateToken, async (req, res) => {
  try {
    const wo_id = parseInt(req.params.wo_id);
    const wo = await WorkOrder.findByPk(wo_id, {
      include: [{ model: Product, as: 'product' }]
    });

    if (!wo) {
      return res.status(404).json({ detail: 'Work order not found' });
    }

    // Get BOM requirements
    const bom_requirements = await BillOfMaterials.findAll({
      where: { product_id: wo.product_id, is_active: true }
    });

    // Get production logs
    const production_logs = await ProductionLog.findAll({
      where: { wo_id }
    });

    const produced = parseFloat(wo.produced_quantity || 0);
    const target = parseFloat(wo.quantity || 0);

    return res.json({
      work_order: wo,
      product: wo.product,
      bom_requirements,
      production_logs,
      produced_quantity: produced,
      progress_percentage: target > 0 ? (produced / target) * 100 : 0
    });

  } catch (error) {
    console.error('Get Work Order Error:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

// 4. Start work order
router.put('/work-orders/:wo_id/start', authenticateToken, async (req, res) => {
  try {
    const wo_id = parseInt(req.params.wo_id);
    const wo = await WorkOrder.findByPk(wo_id);
    if (!wo) {
      return res.status(404).json({ detail: 'Work order not found' });
    }

    if (!['draft', 'planned', 'released'].includes(wo.status)) {
      return res.status(400).json({ detail: 'Work order cannot be started in current status' });
    }

    wo.status = 'in_progress';
    wo.actual_start_date = new Date();
    await wo.save();

    return res.json({
      message: 'Work order started successfully',
      wo_number: wo.wo_number,
      status: wo.status
    });
  } catch (error) {
    console.error('Start Work Order Error:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

// 5. Complete work order
router.put('/work-orders/:wo_id/complete', authenticateToken, async (req, res) => {
  try {
    const wo_id = parseInt(req.params.wo_id);
    const wo = await WorkOrder.findByPk(wo_id);
    if (!wo) {
      return res.status(404).json({ detail: 'Work order not found' });
    }

    if (wo.status !== 'in_progress') {
      return res.status(400).json({ detail: 'Only in-progress work orders can be completed' });
    }

    wo.status = 'completed';
    wo.actual_end_date = new Date();
    await wo.save();

    return res.json({
      message: 'Work order completed successfully',
      wo_number: wo.wo_number,
      produced_quantity: parseFloat(wo.produced_quantity || 0)
    });
  } catch (error) {
    console.error('Complete Work Order Error:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

// 6. Log production progress
router.post('/work-orders/:wo_id/log', authenticateToken, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { wo_id, quantity_produced, quantity_rejected, shift, operator_id, machine_id, notes } = req.body;

    const wo = await WorkOrder.findByPk(wo_id, { transaction: t });
    if (!wo) {
      await t.rollback();
      return res.status(404).json({ detail: 'Work order not found' });
    }

    await ProductionLog.create({
      wo_id,
      quantity_produced,
      quantity_rejected: quantity_rejected || 0,
      shift,
      operator_id: operator_id || req.user.user_id,
      supervisor_id: req.user.user_id,
      machine_id,
      notes
    }, { transaction: t });

    // Update quantities on WorkOrder
    wo.produced_quantity = parseFloat(wo.produced_quantity || 0) + parseFloat(quantity_produced);
    wo.rejected_quantity = parseFloat(wo.rejected_quantity || 0) + parseFloat(quantity_rejected || 0);
    await wo.save({ transaction: t });

    await t.commit();

    return res.json({
      message: 'Production logged successfully',
      wo_number: wo.wo_number,
      total_produced: parseFloat(wo.produced_quantity),
      progress_percentage: (parseFloat(wo.produced_quantity) / parseFloat(wo.quantity)) * 100
    });

  } catch (error) {
    await t.rollback();
    console.error('Log Production Error:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

// 7. List machines
router.get('/machines', authenticateToken, async (req, res) => {
  try {
    const { status } = req.query;
    const whereClause = { is_active: true };

    if (status) {
      whereClause.status = status;
    }

    const machines = await Machine.findAll({ where: whereClause });
    return res.json({ total: machines.length, machines });
  } catch (error) {
    console.error('List Machines Error:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

// 8. Get machine status and current allocation
router.get('/machines/:machine_id/status', authenticateToken, async (req, res) => {
  try {
    const machine_id = parseInt(req.params.machine_id);
    const machine = await Machine.findByPk(machine_id);
    if (!machine) {
      return res.status(404).json({ detail: 'Machine not found' });
    }

    const current_allocation = await MachineAllocation.findOne({
      where: { machine_id, status: 'active' }
    });

    return res.json({
      machine,
      current_status: machine.status,
      current_allocation,
      next_maintenance_date: machine.next_maintenance_date
    });
  } catch (error) {
    console.error('Get Machine Status Error:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

// 9. Allocate machine to work order
router.post('/machines/allocate', authenticateToken, async (req, res) => {
  try {
    const { wo_id, machine_id, planned_start_time, planned_end_time } = req.body;

    const machine = await Machine.findByPk(machine_id);
    if (!machine) {
      return res.status(404).json({ detail: 'Machine not found' });
    }

    // Check conflict
    const conflict = await MachineAllocation.findOne({
      where: {
        machine_id,
        status: 'active',
        planned_end_time: { [Op.gt]: planned_start_time }
      }
    });

    if (conflict) {
      return res.status(400).json({ detail: 'Machine already allocated during this time' });
    }

    const allocation = await MachineAllocation.create({
      wo_id,
      machine_id,
      planned_start_time,
      planned_end_time,
      status: 'planned'
    });

    return res.json({
      message: 'Machine allocated successfully',
      allocation_id: allocation.allocation_id
    });
  } catch (error) {
    console.error('Allocate Machine Error:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

// 10. List BOM entries
router.get('/bom', authenticateToken, async (req, res) => {
  try {
    const { product_id } = req.query;
    const whereClause = { is_active: true };

    if (product_id) {
      whereClause.product_id = parseInt(product_id);
    }

    const bom_items = await BillOfMaterials.findAll({ where: whereClause });
    return res.json({ total: bom_items.length, bom: bom_items });
  } catch (error) {
    console.error('List BOM Error:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

// 11. Create BOM entry
router.post('/bom', authenticateToken, async (req, res) => {
  try {
    const { product_id, material_id, quantity_required, wastage_percentage } = req.body;

    const bom_entry = await BillOfMaterials.create({
      product_id,
      material_id,
      quantity_required,
      wastage_percentage: wastage_percentage || 0
    });

    return res.json({
      message: 'BOM entry created successfully',
      bom_id: bom_entry.bom_id
    });
  } catch (error) {
    console.error('Create BOM Entry Error:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

module.exports = router;
