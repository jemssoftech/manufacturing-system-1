const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Customer = sequelize.define('Customer', {
    customer_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    customer_code: {
      type: DataTypes.STRING(50),
      unique: true,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    contact_person: {
      type: DataTypes.STRING(100),
    },
    email: {
      type: DataTypes.STRING(100),
    },
    phone: {
      type: DataTypes.STRING(20),
    },
    address: {
      type: DataTypes.TEXT,
    },
    city: {
      type: DataTypes.STRING(100),
    },
    state: {
      type: DataTypes.STRING(100),
    },
    country: {
      type: DataTypes.STRING(100),
    },
    postal_code: {
      type: DataTypes.STRING(20),
    },
    tax_id: {
      type: DataTypes.STRING(50),
    },
    credit_limit: {
      type: DataTypes.DECIMAL(15, 2),
    },
    credit_days: {
      type: DataTypes.INTEGER,
    },
    region: {
      type: DataTypes.STRING(100),
    },
    customer_type: {
      type: DataTypes.STRING(50), // "retail", "wholesale", "distributor"
    },
    rating: {
      type: DataTypes.DECIMAL(3, 2),
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    }
  }, {
    tableName: 'customers',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  const SalesOrder = sequelize.define('SalesOrder', {
    so_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    so_number: {
      type: DataTypes.STRING(50),
      unique: true,
      allowNull: false,
    },
    customer_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    order_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    delivery_date: {
      type: DataTypes.DATEONLY,
    },
    status: {
      type: DataTypes.ENUM('draft', 'confirmed', 'in_production', 'ready_to_dispatch', 'partially_dispatched', 'dispatched', 'delivered', 'cancelled'),
      defaultValue: 'draft',
    },
    total_amount: {
      type: DataTypes.DECIMAL(15, 2),
    },
    tax_amount: {
      type: DataTypes.DECIMAL(15, 2),
    },
    discount_amount: {
      type: DataTypes.DECIMAL(15, 2),
    },
    net_amount: {
      type: DataTypes.DECIMAL(15, 2),
    },
    payment_terms: {
      type: DataTypes.STRING(100),
    },
    shipping_address: {
      type: DataTypes.TEXT,
    },
    billing_address: {
      type: DataTypes.TEXT,
    },
    notes: {
      type: DataTypes.TEXT,
    },
    customer_po_number: {
      type: DataTypes.STRING(100),
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
    }
  }, {
    tableName: 'sales_orders',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  const SOItem = sequelize.define('SOItem', {
    item_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    so_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    product_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    quantity: {
      type: DataTypes.DECIMAL(15, 3),
      allowNull: false,
    },
    unit_price: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    total_price: {
      type: DataTypes.DECIMAL(15, 2),
    },
    tax_rate: {
      type: DataTypes.DECIMAL(5, 2),
    },
    tax_amount: {
      type: DataTypes.DECIMAL(15, 2),
    },
    discount_rate: {
      type: DataTypes.DECIMAL(5, 2),
    },
    discount_amount: {
      type: DataTypes.DECIMAL(15, 2),
    },
    dispatched_quantity: {
      type: DataTypes.DECIMAL(15, 3),
      defaultValue: 0.000,
    },
    notes: {
      type: DataTypes.TEXT,
    }
  }, {
    tableName: 'so_items',
    timestamps: false
  });

  const DispatchNote = sequelize.define('DispatchNote', {
    dispatch_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    dispatch_number: {
      type: DataTypes.STRING(50),
      unique: true,
      allowNull: false,
    },
    so_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    dispatch_date: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    vehicle_number: {
      type: DataTypes.STRING(50),
    },
    driver_name: {
      type: DataTypes.STRING(100),
    },
    driver_phone: {
      type: DataTypes.STRING(20),
    },
    transporter: {
      type: DataTypes.STRING(200),
    },
    tracking_number: {
      type: DataTypes.STRING(100),
    },
    expected_delivery_date: {
      type: DataTypes.DATEONLY,
    },
    actual_delivery_date: {
      type: DataTypes.DATE,
    },
    delivery_status: {
      type: DataTypes.STRING(50), // "dispatched", "in_transit", "delivered"
    },
    notes: {
      type: DataTypes.TEXT,
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
    }
  }, {
    tableName: 'dispatch_notes',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return { Customer, SalesOrder, SOItem, DispatchNote };
};
