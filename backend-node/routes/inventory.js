const express = require('express');
const router = express.Router();
const { Op, fn, col, literal } = require('sequelize');
const { Material, InventoryItem, StockMovement, ReorderAlert, sequelize } = require('../models');
const { authenticateToken } = require('../middleware/auth');

// 1. List all materials
router.get('/materials', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.skip) || 0;
    const { category, search } = req.query;

    const whereClause = { is_active: true };

    if (category) {
      whereClause.category = category;
    }

    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { material_code: { [Op.like]: `%${search}%` } }
      ];
    }

    const materials = await Material.findAll({
      where: whereClause,
      limit,
      offset
    });

    return res.json(materials);
  } catch (error) {
    console.error('List Materials Error:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

// 2. Add new material
router.post('/materials', authenticateToken, async (req, res) => {
  try {
    const { material_code, name, category, unit, reorder_level, reorder_quantity, unit_cost } = req.body;

    const existing = await Material.findOne({ where: { material_code } });
    if (existing) {
      return res.status(400).json({ detail: 'Material code already exists' });
    }

    const newMaterial = await Material.create({
      material_code,
      name,
      category,
      unit,
      reorder_level,
      reorder_quantity,
      unit_cost
    });

    return res.status(201).json(newMaterial);
  } catch (error) {
    console.error('Create Material Error:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

// 3. Get material details with current stock
router.get('/materials/:material_id', authenticateToken, async (req, res) => {
  try {
    const material_id = parseInt(req.params.material_id);
    const material = await Material.findByPk(material_id);
    if (!material) {
      return res.status(404).json({ detail: 'Material not found' });
    }

    const current_stock_val = await InventoryItem.sum('quantity', {
      where: { material_id }
    });

    return res.json({
      material,
      current_stock: parseFloat(current_stock_val || 0)
    });
  } catch (error) {
    console.error('Get Material Error:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

// 4. Get current stock levels
router.get('/stock', authenticateToken, async (req, res) => {
  try {
    const { material_id, location, low_stock } = req.query;

    const whereClause = {};
    const itemWhereClause = {};

    if (material_id) {
      whereClause.material_id = parseInt(material_id);
    }
    if (location) {
      itemWhereClause.location = location;
    }

    // Since we need grouping, we can fetch materials with inventory items
    // and sum in Javascript or use raw SQL/Sequelize attributes.
    // Let's use a query to aggregate.
    const results = await Material.findAll({
      where: whereClause,
      attributes: [
        'material_id',
        'material_code',
        'name',
        'unit',
        'reorder_level',
        [fn('COALESCE', fn('SUM', col('inventory_items.quantity')), 0), 'current_stock'],
        [fn('COALESCE', fn('SUM', col('inventory_items.total_value')), 0), 'stock_value']
      ],
      include: [{
        model: InventoryItem,
        as: 'inventory_items',
        attributes: [],
        where: Object.keys(itemWhereClause).length ? itemWhereClause : undefined,
        required: false // LEFT OUTER JOIN to include materials with 0 stock
      }],
      group: ['Material.material_id'],
      raw: true
    });

    const stock_data = [];
    for (const row of results) {
      const current_stock = parseFloat(row.current_stock || 0);
      const reorder_level = parseFloat(row.reorder_level || 0);
      const stock_value = parseFloat(row.stock_value || 0);
      const is_low_stock = current_stock < reorder_level;

      const stock_info = {
        material_id: row.material_id,
        material_code: row.material_code,
        name: row.name,
        unit: row.unit,
        current_stock,
        reorder_level,
        stock_value,
        is_low_stock
      };

      if (low_stock === 'true' || low_stock === true) {
        if (is_low_stock) stock_data.push(stock_info);
      } else {
        stock_data.push(stock_info);
      }
    }

    return res.json({
      total_items: stock_data.length,
      stock: stock_data
    });

  } catch (error) {
    console.error('Get Stock Levels Error:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

// 5. Receive stock into inventory
router.post('/stock/receive', authenticateToken, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { material_id, quantity, batch_number, location, po_id, unit_cost } = req.body;

    const material = await Material.findByPk(material_id);
    if (!material) {
      await t.rollback();
      return res.status(404).json({ detail: 'Material not found' });
    }

    const batch = batch_number || `BATCH-${Date.now()}`;
    const cost = unit_cost || material.unit_cost || 0;
    const total_value = quantity * cost;

    const inventory_item = await InventoryItem.create({
      material_id,
      batch_number: batch,
      quantity,
      location: location || 'MAIN-WAREHOUSE',
      unit_cost: cost,
      total_value,
      po_id,
      quality_status: 'approved'
    }, { transaction: t });

    await StockMovement.create({
      material_id,
      movement_type: 'receipt',
      quantity,
      batch_number: batch,
      to_location: inventory_item.location,
      reference_type: po_id ? 'purchase_order' : 'manual',
      reference_id: po_id,
      unit_cost: cost,
      total_value,
      created_by: req.user.user_id
    }, { transaction: t });

    await t.commit();

    return res.json({
      message: 'Stock received successfully',
      batch_number: batch,
      quantity: parseFloat(quantity)
    });

  } catch (error) {
    await t.rollback();
    console.error('Receive Stock Error:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

// 6. Issue stock from inventory
router.post('/stock/issue', authenticateToken, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { material_id, quantity, batch_number, wo_id, notes } = req.body;

    let inventory_item;

    if (batch_number) {
      inventory_item = await InventoryItem.findOne({
        where: { material_id, batch_number },
        transaction: t
      });
    } else {
      inventory_item = await InventoryItem.findOne({
        where: { material_id, quantity: { [Op.gt]: 0 } },
        transaction: t
      });
    }

    if (!inventory_item || parseFloat(inventory_item.quantity) < quantity) {
      await t.rollback();
      return res.status(400).json({ detail: 'Insufficient stock' });
    }

    // Deduct quantity
    const newQuantity = parseFloat(inventory_item.quantity) - parseFloat(quantity);
    inventory_item.quantity = newQuantity;
    inventory_item.total_value = newQuantity * parseFloat(inventory_item.unit_cost);
    await inventory_item.save({ transaction: t });

    // Create stock movement
    await StockMovement.create({
      material_id,
      movement_type: 'issue',
      quantity,
      batch_number: inventory_item.batch_number,
      from_location: inventory_item.location,
      reference_type: wo_id ? 'work_order' : 'manual',
      reference_id: wo_id,
      unit_cost: inventory_item.unit_cost,
      total_value: quantity * parseFloat(inventory_item.unit_cost),
      notes,
      created_by: req.user.user_id
    }, { transaction: t });

    await t.commit();

    return res.json({
      message: 'Stock issued successfully',
      batch_number: inventory_item.batch_number,
      quantity: parseFloat(quantity)
    });

  } catch (error) {
    await t.rollback();
    console.error('Issue Stock Error:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

// 7. Get stock movement history
router.get('/stock/movements', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.skip) || 0;
    const { material_id, movement_type } = req.query;

    const whereClause = {};
    if (material_id) {
      whereClause.material_id = parseInt(material_id);
    }
    if (movement_type) {
      whereClause.movement_type = movement_type;
    }

    const count = await StockMovement.count({ where: whereClause });
    const movements = await StockMovement.findAll({
      where: whereClause,
      order: [['created_at', 'DESC']],
      limit,
      offset
    });

    return res.json({
      total: count,
      movements
    });
  } catch (error) {
    console.error('Get Stock Movements Error:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

// 8. Get detailed stock ledger for a material
router.get('/stock/ledger', authenticateToken, async (req, res) => {
  try {
    const material_id = parseInt(req.query.material_id);
    const material = await Material.findByPk(material_id);
    if (!material) {
      return res.status(404).json({ detail: 'Material not found' });
    }

    const movements = await StockMovement.findAll({
      where: { material_id },
      order: [['created_at', 'ASC']]
    });

    const current_stock_val = await InventoryItem.sum('quantity', {
      where: { material_id }
    });

    return res.json({
      material,
      current_stock: parseFloat(current_stock_val || 0),
      movements
    });
  } catch (error) {
    console.error('Get Stock Ledger Error:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

// 9. Get reorder alerts for low stock items
router.get('/reorder-alerts', authenticateToken, async (req, res) => {
  try {
    const { priority } = req.query;

    // Fetch low stock materials
    // We can do this with raw SQL query or standard Sequelize. Since it requires group by and having, a literal is cleaner:
    const low_stock_materials = await Material.findAll({
      attributes: [
        'material_id',
        'material_code',
        'name',
        'reorder_level',
        'reorder_quantity',
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

    let alerts = [];
    for (const row of low_stock_materials) {
      const current = parseFloat(row.current_stock || 0);
      const reorder = parseFloat(row.reorder_level || 0);

      let priority_level = 'low';
      if (current === 0) {
        priority_level = 'critical';
      } else if (current < reorder * 0.3) {
        priority_level = 'high';
      } else if (current < reorder * 0.6) {
        priority_level = 'medium';
      }

      alerts.append = {
        material_id: row.material_id,
        material_code: row.material_code,
        name: row.name,
        current_stock: current,
        reorder_level: reorder,
        recommended_quantity: parseFloat(row.reorder_quantity || reorder),
        priority: priority_level
      };
      
      alerts.push(alerts.append);
    }

    if (priority) {
      alerts = alerts.filter(a => a.priority === priority);
    }

    return res.json({
      total_alerts: alerts.length,
      alerts
    });

  } catch (error) {
    console.error('Get Reorder Alerts Error:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

// 10. Trigger automatic reorder (Phase 2 placeholder)
router.post('/reorder-alerts/auto', authenticateToken, async (req, res) => {
  return res.json({
    message: 'Auto-reorder feature will be available in Phase 2',
    status: 'pending'
  });
});

module.exports = router;
