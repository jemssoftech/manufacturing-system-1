const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { Supplier, PurchaseOrder, POItem, Material, sequelize } = require('../models');
const { authenticateToken } = require('../middleware/auth');

// 1. List suppliers
router.get('/suppliers', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.skip) || 0;
    const { status, search } = req.query;

    const whereClause = {};
    if (status) {
      whereClause.status = status;
    }
    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { supplier_code: { [Op.like]: `%${search}%` } }
      ];
    }

    const suppliers = await Supplier.findAll({
      where: whereClause,
      limit,
      offset
    });

    return res.json(suppliers);
  } catch (error) {
    console.error('List Suppliers Error:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

// 2. Create supplier
router.post('/suppliers', authenticateToken, async (req, res) => {
  try {
    const { supplier_code, name, contact_person, email, phone, address, city, payment_terms } = req.body;

    const existing = await Supplier.findOne({ where: { supplier_code } });
    if (existing) {
      return res.status(400).json({ detail: 'Supplier code already exists' });
    }

    const newSupplier = await Supplier.create({
      supplier_code,
      name,
      contact_person,
      email,
      phone,
      address,
      city,
      payment_terms
    });

    return res.status(201).json(newSupplier);
  } catch (error) {
    console.error('Create Supplier Error:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

// 3. Get supplier details
router.get('/suppliers/:supplier_id', authenticateToken, async (req, res) => {
  try {
    const supplier = await Supplier.findByPk(parseInt(req.params.supplier_id));
    if (!supplier) {
      return res.status(404).json({ detail: 'Supplier not found' });
    }
    return res.json(supplier);
  } catch (error) {
    console.error('Get Supplier Error:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

// 4. List purchase orders
router.get('/purchase-orders', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.skip) || 0;
    const { status, supplier_id, date_from, date_to } = req.query;

    const whereClause = {};
    if (status) {
      whereClause.status = status;
    }
    if (supplier_id) {
      whereClause.supplier_id = parseInt(supplier_id);
    }
    if (date_from) {
      whereClause.order_date = { ...whereClause.order_date, [Op.gte]: date_from };
    }
    if (date_to) {
      whereClause.order_date = { ...whereClause.order_date, [Op.lte]: date_to };
    }

    const orders = await PurchaseOrder.findAll({
      where: whereClause,
      order: [['order_date', 'DESC']],
      limit,
      offset
    });

    return res.json(orders);
  } catch (error) {
    console.error('List POs Error:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

// 5. Create new purchase order
router.post('/purchase-orders', authenticateToken, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { supplier_id, order_date, expected_delivery_date, items, notes } = req.body;

    // Generate PO number (format: PO-YYYYMMDD-XXXX)
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = await PurchaseOrder.count({ transaction: t });
    const po_number = `PO-${todayStr}-${(count + 1).toString().padStart(4, '0')}`;

    const new_po = await PurchaseOrder.create({
      po_number,
      supplier_id,
      order_date,
      expected_delivery_date,
      status: 'draft',
      notes,
      created_by: req.user.user_id
    }, { transaction: t });

    let total_amount = 0;
    for (const item of items) {
      const item_total = item.quantity * item.unit_price;
      total_amount += item_total;

      await POItem.create({
        po_id: new_po.po_id,
        material_id: item.material_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item_total
      }, { transaction: t });
    }

    new_po.total_amount = total_amount;
    new_po.net_amount = total_amount;
    await new_po.save({ transaction: t });

    await t.commit();

    return res.status(201).json(new_po);

  } catch (error) {
    await t.rollback();
    console.error('Create PO Error:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

// 6. Get purchase order details
router.get('/purchase-orders/:po_id', authenticateToken, async (req, res) => {
  try {
    const po_id = parseInt(req.params.po_id);
    const po = await PurchaseOrder.findByPk(po_id, {
      include: [
        { model: POItem, as: 'items', include: [{ model: Material, as: 'material' }] },
        { model: Supplier, as: 'supplier' }
      ]
    });

    if (!po) {
      return res.status(404).json({ detail: 'Purchase order not found' });
    }

    return res.json({
      po,
      items: po.items,
      supplier: po.supplier
    });
  } catch (error) {
    console.error('Get PO Error:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

// 7. Approve purchase order
router.put('/purchase-orders/:po_id/approve', authenticateToken, async (req, res) => {
  try {
    const po_id = parseInt(req.params.po_id);
    const po = await PurchaseOrder.findByPk(po_id);
    if (!po) {
      return res.status(404).json({ detail: 'Purchase order not found' });
    }

    if (po.status !== 'draft' && po.status !== 'pending_approval') {
      return res.status(400).json({ detail: 'PO cannot be approved in current status' });
    }

    po.status = 'approved';
    po.approved_by = req.user.user_id;
    po.approved_at = new Date();
    await po.save();

    return res.json({ message: 'Purchase order approved successfully', po_number: po.po_number });
  } catch (error) {
    console.error('Approve PO Error:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

// 8. Mark PO as received
router.put('/purchase-orders/:po_id/receive', authenticateToken, async (req, res) => {
  try {
    const po_id = parseInt(req.params.po_id);
    const po = await PurchaseOrder.findByPk(po_id);
    if (!po) {
      return res.status(404).json({ detail: 'Purchase order not found' });
    }

    po.status = 'received';
    po.actual_delivery_date = new Date();
    await po.save();

    return res.json({ message: 'Purchase order marked as received', po_number: po.po_number });
  } catch (error) {
    console.error('Receive PO Error:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

// 9. Get POs pending approval
router.get('/pending-approvals', authenticateToken, async (req, res) => {
  try {
    const pending_pos = await PurchaseOrder.findAll({
      where: {
        status: { [Op.in]: ['pending_approval', 'draft'] }
      },
      order: [['order_date', 'DESC']]
    });

    return res.json({ count: pending_pos.length, purchase_orders: pending_pos });
  } catch (error) {
    console.error('Get Pending Approvals Error:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

// 10. Update delivery status
router.post('/delivery-update', authenticateToken, async (req, res) => {
  try {
    const { po_id, actual_delivery_date, notes } = req.body;

    const po = await PurchaseOrder.findByPk(po_id);
    if (!po) {
      return res.status(404).json({ detail: 'Purchase order not found' });
    }

    po.actual_delivery_date = actual_delivery_date;
    if (notes) {
      po.notes = (po.notes || '') + `\nDelivery update: ${notes}`;
    }
    await po.save();

    return res.json({ message: 'Delivery status updated', po_number: po.po_number });
  } catch (error) {
    console.error('Delivery Update Error:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

module.exports = router;
