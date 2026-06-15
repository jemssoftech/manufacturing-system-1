const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Supplier = sequelize.define('Supplier', {
    supplier_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    supplier_code: {
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
    payment_terms: {
      type: DataTypes.STRING(100),
    },
    credit_limit: {
      type: DataTypes.DECIMAL(15, 2),
    },
    rating: {
      type: DataTypes.DECIMAL(3, 2),
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'blacklisted'),
      defaultValue: 'active',
    }
  }, {
    tableName: 'suppliers',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  const PurchaseOrder = sequelize.define('PurchaseOrder', {
    po_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    po_number: {
      type: DataTypes.STRING(50),
      unique: true,
      allowNull: false,
    },
    supplier_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    order_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    expected_delivery_date: {
      type: DataTypes.DATEONLY,
    },
    actual_delivery_date: {
      type: DataTypes.DATEONLY,
    },
    status: {
      type: DataTypes.ENUM('draft', 'pending_approval', 'approved', 'ordered', 'partially_received', 'received', 'cancelled'),
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
    notes: {
      type: DataTypes.TEXT,
    },
    approved_by: {
      type: DataTypes.INTEGER,
    },
    approved_at: {
      type: DataTypes.DATE,
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
    }
  }, {
    tableName: 'purchase_orders',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  const POItem = sequelize.define('POItem', {
    item_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    po_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    material_id: {
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
    received_quantity: {
      type: DataTypes.DECIMAL(15, 3),
      defaultValue: 0.000,
    },
    notes: {
      type: DataTypes.TEXT,
    }
  }, {
    tableName: 'po_items',
    timestamps: false
  });

  const SupplierRating = sequelize.define('SupplierRating', {
    rating_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    supplier_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    po_id: {
      type: DataTypes.INTEGER,
    },
    quality_score: {
      type: DataTypes.DECIMAL(3, 2),
    },
    delivery_score: {
      type: DataTypes.DECIMAL(3, 2),
    },
    price_score: {
      type: DataTypes.DECIMAL(3, 2),
    },
    communication_score: {
      type: DataTypes.DECIMAL(3, 2),
    },
    overall_score: {
      type: DataTypes.DECIMAL(3, 2),
    },
    delivery_time_days: {
      type: DataTypes.INTEGER,
    },
    defect_rate: {
      type: DataTypes.DECIMAL(5, 2),
    },
    comments: {
      type: DataTypes.TEXT,
    },
    rated_by: {
      type: DataTypes.INTEGER,
    }
  }, {
    tableName: 'supplier_ratings',
    timestamps: true,
    createdAt: 'rated_at',
    updatedAt: false
  });

  return { Supplier, PurchaseOrder, POItem, SupplierRating };
};
