const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { Customer, SalesOrder, SOItem, DispatchNote, Product, sequelize } = require('../models');
const { authenticateToken } = require('../middleware/auth');

// 1. List all customers
router.get('/customers', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.skip) || 0;
    const { region, search } = req.query;

    const whereClause = { is_active: true };
    if (region) {
      whereClause.region = region;
    }
    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { customer_code: { [Op.like]: `%${search}%` } }
      ];
    }

    const customers = await Customer.findAll({
      where: whereClause,
      limit,
      offset
    });

    return res.json(customers);
  } catch (error) {
    console.error('List Customers Error:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

// 2. Create customer
router.post('/customers', authenticateToken, async (req, res) => {
  try {
    const { customer_code, name, contact_person, email, phone, credit_limit, region } = req.body;

    const existing = await Customer.findOne({ where: { customer_code } });
    if (existing) {
      return res.status(400).json({ detail: 'Customer code already exists' });
    }

    const newCustomer = await Customer.create({
      customer_code,
      name,
      contact_person,
      email,
      phone,
      credit_limit,
      region
    });

    return res.status(201).json(newCustomer);
  } catch (error) {
    console.error('Create Customer Error:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

// 3. Get customer details
router.get('/customers/:customer_id', authenticateToken, async (req, res) => {
  try {
    const customer = await Customer.findByPk(parseInt(req.params.customer_id));
    if (!customer) {
      return res.status(404).json({ detail: 'Customer not found' });
    }
    return res.json(customer);
  } catch (error) {
    console.error('Get Customer Error:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

// 4. Update customer
router.put('/customers/:customer_id', authenticateToken, async (req, res) => {
  try {
    const customer_id = parseInt(req.params.customer_id);
    const { customer_code, name, contact_person, email, phone, credit_limit, region } = req.body;

    const customer = await Customer.findByPk(customer_id);
    if (!customer) {
      return res.status(404).json({ detail: 'Customer not found' });
    }

    await customer.update({
      customer_code,
      name,
      contact_person,
      email,
      phone,
      credit_limit,
      region
    });

    return res.json(customer);
  } catch (error) {
    console.error('Update Customer Error:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

// 5. List sales orders
router.get('/sales-orders', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.skip) || 0;
    const { status, customer_id, date_from, date_to } = req.query;

    const whereClause = {};
    if (status) {
      whereClause.status = status;
    }
    if (customer_id) {
      whereClause.customer_id = parseInt(customer_id);
    }
    if (date_from) {
      whereClause.order_date = { ...whereClause.order_date, [Op.gte]: date_from };
    }
    if (date_to) {
      whereClause.order_date = { ...whereClause.order_date, [Op.lte]: date_to };
    }

    const orders = await SalesOrder.findAll({
      where: whereClause,
      order: [['order_date', 'DESC']],
      limit,
      offset
    });

    return res.json(orders);
  } catch (error) {
    console.error('List SOs Error:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

// 6. Create new sales order
router.post('/sales-orders', authenticateToken, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { customer_id, order_date, delivery_date, items, customer_po_number, notes } = req.body;

    const customer = await Customer.findByPk(customer_id, { transaction: t });
    if (!customer) {
      await t.rollback();
      return res.status(404).json({ detail: 'Customer not found' });
    }

    // Generate SO number (SO-YYYYMMDD-XXXX)
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = await SalesOrder.count({ transaction: t });
    const so_number = `SO-${todayStr}-${(count + 1).toString().padStart(4, '0')}`;

    const new_so = await SalesOrder.create({
      so_number,
      customer_id,
      order_date,
      delivery_date,
      customer_po_number,
      notes,
      status: 'draft',
      created_by: req.user.user_id
    }, { transaction: t });

    let total_amount = 0;
    for (const item of items) {
      const item_total = item.quantity * item.unit_price;
      total_amount += item_total;

      await SOItem.create({
        so_id: new_so.so_id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item_total
      }, { transaction: t });
    }

    new_so.total_amount = total_amount;
    new_so.net_amount = total_amount;
    await new_so.save({ transaction: t });

    await t.commit();

    return res.status(201).json(new_so);

  } catch (error) {
    await t.rollback();
    console.error('Create SO Error:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

// 7. Get sales order details
router.get('/sales-orders/:so_id', authenticateToken, async (req, res) => {
  try {
    const so_id = parseInt(req.params.so_id);
    const so = await SalesOrder.findByPk(so_id, {
      include: [
        { model: SOItem, as: 'items', include: [{ model: Product, as: 'product' }] },
        { model: Customer, as: 'customer' },
        { model: DispatchNote, as: 'dispatch_notes' }
      ]
    });

    if (!so) {
      return res.status(404).json({ detail: 'Sales order not found' });
    }

    return res.json({
      sales_order: so,
      items: so.items,
      customer: so.customer,
      dispatch_notes: so.dispatch_notes
    });
  } catch (error) {
    console.error('Get SO Error:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

// 8. Confirm sales order
router.put('/sales-orders/:so_id/confirm', authenticateToken, async (req, res) => {
  try {
    const so_id = parseInt(req.params.so_id);
    const so = await SalesOrder.findByPk(so_id);
    if (!so) {
      return res.status(404).json({ detail: 'Sales order not found' });
    }

    if (so.status !== 'draft') {
      return res.status(400).json({ detail: 'Only draft orders can be confirmed' });
    }

    so.status = 'confirmed';
    await so.save();

    return res.json({
      message: 'Sales order confirmed successfully',
      so_number: so.so_number,
      status: so.status
    });
  } catch (error) {
    console.error('Confirm SO Error:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

// 9. Add items to sales order
router.post('/sales-orders/:so_id/items', authenticateToken, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const so_id = parseInt(req.params.so_id);
    const { items } = req.body;

    const so = await SalesOrder.findByPk(so_id, { transaction: t });
    if (!so) {
      await t.rollback();
      return res.status(404).json({ detail: 'Sales order not found' });
    }

    let items_added = 0;
    for (const item of items) {
      const item_total = item.quantity * item.unit_price;

      await SOItem.create({
        so_id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item_total
      }, { transaction: t });

      so.total_amount = parseFloat(so.total_amount || 0) + item_total;
      so.net_amount = so.total_amount;
      items_added++;
    }

    await so.save({ transaction: t });
    await t.commit();

    return res.json({
      message: `${items_added} items added successfully`,
      items_added
    });

  } catch (error) {
    await t.rollback();
    console.error('Add SO Items Error:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

// 10. Create dispatch note
router.post('/dispatch', authenticateToken, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { so_id, vehicle_number, driver_name, driver_phone, transporter, expected_delivery_date } = req.body;

    const so = await SalesOrder.findByPk(so_id, { transaction: t });
    if (!so) {
      await t.rollback();
      return res.status(404).json({ detail: 'Sales order not found' });
    }

    if (!['confirmed', 'in_production', 'ready_to_dispatch'].includes(so.status)) {
      await t.rollback();
      return res.status(400).json({ detail: 'Sales order not ready for dispatch' });
    }

    // Generate DN number (DN-YYYYMMDD-XXXX)
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = await DispatchNote.count({ transaction: t });
    const dispatch_number = `DN-${todayStr}-${(count + 1).toString().padStart(4, '0')}`;

    const dispatch_note = await DispatchNote.create({
      dispatch_number,
      so_id,
      vehicle_number,
      driver_name,
      driver_phone,
      transporter,
      expected_delivery_date,
      delivery_status: 'dispatched',
      created_by: req.user.user_id
    }, { transaction: t });

    so.status = 'dispatched';
    await so.save({ transaction: t });

    await t.commit();

    return res.json({
      message: 'Dispatch note created successfully',
      dispatch_number,
      so_number: so.so_number
    });

  } catch (error) {
    await t.rollback();
    console.error('Create Dispatch Note Error:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

// 11. Get dispatch details
router.get('/dispatch/:so_id', authenticateToken, async (req, res) => {
  try {
    const so_id = parseInt(req.params.so_id);
    const dispatch_notes = await DispatchNote.findAll({ where: { so_id } });

    if (!dispatch_notes || dispatch_notes.length === 0) {
      return res.status(404).json({ detail: 'No dispatch notes found for this order' });
    }

    return res.json({
      so_id,
      total_dispatches: dispatch_notes.length,
      dispatch_notes
    });
  } catch (error) {
    console.error('Get Dispatch Details Error:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

module.exports = router;
