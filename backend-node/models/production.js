const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Product = sequelize.define('Product', {
    product_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    product_code: {
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
      type: DataTypes.STRING(100),
    },
    unit: {
      type: DataTypes.STRING(20),
    },
    standard_cost: {
      type: DataTypes.DECIMAL(15, 2),
    },
    selling_price: {
      type: DataTypes.DECIMAL(15, 2),
    },
    lead_time_days: {
      type: DataTypes.INTEGER,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    }
  }, {
    tableName: 'products',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  const BillOfMaterials = sequelize.define('BillOfMaterials', {
    bom_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    product_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    material_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    quantity_required: {
      type: DataTypes.DECIMAL(15, 3),
      allowNull: false,
    },
    wastage_percentage: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0.00,
    },
    unit: {
      type: DataTypes.STRING(20),
    },
    notes: {
      type: DataTypes.TEXT,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    }
  }, {
    tableName: 'bom',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  const Machine = sequelize.define('Machine', {
    machine_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    machine_code: {
      type: DataTypes.STRING(50),
      unique: true,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    machine_type: {
      type: DataTypes.STRING(100),
    },
    capacity: {
      type: DataTypes.DECIMAL(15, 3),
    },
    capacity_unit: {
      type: DataTypes.STRING(20),
    },
    status: {
      type: DataTypes.ENUM('available', 'in_use', 'maintenance', 'breakdown', 'idle'),
      defaultValue: 'available',
    },
    location: {
      type: DataTypes.STRING(100),
    },
    purchase_date: {
      type: DataTypes.DATEONLY,
    },
    last_maintenance_date: {
      type: DataTypes.DATEONLY,
    },
    next_maintenance_date: {
      type: DataTypes.DATEONLY,
    },
    maintenance_frequency_days: {
      type: DataTypes.INTEGER,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    }
  }, {
    tableName: 'machines',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  const WorkOrder = sequelize.define('WorkOrder', {
    wo_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    wo_number: {
      type: DataTypes.STRING(50),
      unique: true,
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
    unit: {
      type: DataTypes.STRING(20),
    },
    planned_start_date: {
      type: DataTypes.DATEONLY,
    },
    planned_end_date: {
      type: DataTypes.DATEONLY,
    },
    actual_start_date: {
      type: DataTypes.DATE,
    },
    actual_end_date: {
      type: DataTypes.DATE,
    },
    status: {
      type: DataTypes.ENUM('draft', 'planned', 'released', 'in_progress', 'paused', 'completed', 'cancelled'),
      defaultValue: 'draft',
    },
    priority: {
      type: DataTypes.STRING(20), // "low", "medium", "high", "urgent"
    },
    sales_order_id: {
      type: DataTypes.INTEGER,
    },
    produced_quantity: {
      type: DataTypes.DECIMAL(15, 3),
      defaultValue: 0.000,
    },
    rejected_quantity: {
      type: DataTypes.DECIMAL(15, 3),
      defaultValue: 0.000,
    },
    notes: {
      type: DataTypes.TEXT,
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
    }
  }, {
    tableName: 'work_orders',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  const MachineAllocation = sequelize.define('MachineAllocation', {
    allocation_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    wo_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    machine_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    planned_start_time: {
      type: DataTypes.DATE,
    },
    planned_end_time: {
      type: DataTypes.DATE,
    },
    actual_start_time: {
      type: DataTypes.DATE,
    },
    actual_end_time: {
      type: DataTypes.DATE,
    },
    status: {
      type: DataTypes.STRING(20), // "planned", "active", "completed", "cancelled"
    },
    notes: {
      type: DataTypes.TEXT,
    }
  }, {
    tableName: 'machine_allocations',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
  });

  const ProductionLog = sequelize.define('ProductionLog', {
    log_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    wo_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    quantity_produced: {
      type: DataTypes.DECIMAL(15, 3),
      allowNull: false,
    },
    quantity_rejected: {
      type: DataTypes.DECIMAL(15, 3),
      defaultValue: 0.000,
    },
    shift: {
      type: DataTypes.STRING(20), // "morning", "afternoon", "night"
    },
    operator_id: {
      type: DataTypes.INTEGER,
    },
    supervisor_id: {
      type: DataTypes.INTEGER,
    },
    machine_id: {
      type: DataTypes.INTEGER,
    },
    downtime_minutes: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    downtime_reason: {
      type: DataTypes.TEXT,
    },
    notes: {
      type: DataTypes.TEXT,
    }
  }, {
    tableName: 'production_logs',
    timestamps: true,
    createdAt: 'logged_at',
    updatedAt: false
  });

  return { Product, BillOfMaterials, Machine, WorkOrder, MachineAllocation, ProductionLog };
};
