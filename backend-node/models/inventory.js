const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Material = sequelize.define('Material', {
    material_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    material_code: {
      type: DataTypes.STRING(50),
      unique: true,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
    },
    category: {
      type: DataTypes.ENUM('raw_material', 'finished_goods', 'work_in_progress', 'consumable', 'spare_parts'),
      allowNull: false,
    },
    unit: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    reorder_level: {
      type: DataTypes.DECIMAL(15, 3),
    },
    reorder_quantity: {
      type: DataTypes.DECIMAL(15, 3),
    },
    unit_cost: {
      type: DataTypes.DECIMAL(15, 2),
    },
    hsn_code: {
      type: DataTypes.STRING(20),
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    }
  }, {
    tableName: 'materials',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  const InventoryItem = sequelize.define('InventoryItem', {
    item_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    material_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    batch_number: {
      type: DataTypes.STRING(50),
    },
    quantity: {
      type: DataTypes.DECIMAL(15, 3),
      allowNull: false,
    },
    location: {
      type: DataTypes.STRING(100),
    },
    warehouse: {
      type: DataTypes.STRING(100),
    },
    bin_location: {
      type: DataTypes.STRING(50),
    },
    unit_cost: {
      type: DataTypes.DECIMAL(15, 2),
    },
    total_value: {
      type: DataTypes.DECIMAL(15, 2),
    },
    manufactured_date: {
      type: DataTypes.DATE,
    },
    expiry_date: {
      type: DataTypes.DATE,
    },
    supplier_id: {
      type: DataTypes.INTEGER,
    },
    po_id: {
      type: DataTypes.INTEGER,
    },
    quality_status: {
      type: DataTypes.STRING(50), // "approved", "quarantine", "rejected"
    }
  }, {
    tableName: 'inventory_items',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  const StockMovement = sequelize.define('StockMovement', {
    movement_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    material_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    movement_type: {
      type: DataTypes.ENUM('receipt', 'issue', 'transfer', 'adjustment', 'return'),
      allowNull: false,
    },
    quantity: {
      type: DataTypes.DECIMAL(15, 3),
      allowNull: false,
    },
    batch_number: {
      type: DataTypes.STRING(50),
    },
    from_location: {
      type: DataTypes.STRING(100),
    },
    to_location: {
      type: DataTypes.STRING(100),
    },
    reference_type: {
      type: DataTypes.STRING(50), // "purchase_order", "work_order", "sales_order"
    },
    reference_id: {
      type: DataTypes.INTEGER,
    },
    unit_cost: {
      type: DataTypes.DECIMAL(15, 2),
    },
    total_value: {
      type: DataTypes.DECIMAL(15, 2),
    },
    notes: {
      type: DataTypes.TEXT,
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
    }
  }, {
    tableName: 'stock_movements',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
  });

  const ReorderAlert = sequelize.define('ReorderAlert', {
    alert_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    material_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    current_stock: {
      type: DataTypes.DECIMAL(15, 3),
    },
    reorder_level: {
      type: DataTypes.DECIMAL(15, 3),
    },
    recommended_quantity: {
      type: DataTypes.DECIMAL(15, 3),
    },
    priority: {
      type: DataTypes.STRING(20), // "low", "medium", "high", "critical"
    },
    status: {
      type: DataTypes.STRING(20),
      defaultValue: 'pending', // "pending", "ordered", "ignored"
    },
    po_id: {
      type: DataTypes.INTEGER,
    },
    notes: {
      type: DataTypes.TEXT,
    },
    resolved_at: {
      type: DataTypes.DATE,
    },
    resolved_by: {
      type: DataTypes.INTEGER,
    }
  }, {
    tableName: 'reorder_alerts',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
  });

  return { Material, InventoryItem, StockMovement, ReorderAlert };
};
