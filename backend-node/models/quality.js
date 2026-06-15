const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const DefectType = sequelize.define('DefectType', {
    type_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    code: {
      type: DataTypes.STRING(50),
      unique: true,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    category: {
      type: DataTypes.STRING(100),
    },
    description: {
      type: DataTypes.TEXT,
    },
    threshold_percentage: {
      type: DataTypes.DECIMAL(5, 2),
    },
    severity: {
      type: DataTypes.ENUM('minor', 'major', 'critical'),
      defaultValue: 'minor',
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    }
  }, {
    tableName: 'defect_types',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
  });

  const QCInspection = sequelize.define('QCInspection', {
    inspection_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    inspection_number: {
      type: DataTypes.STRING(50),
      unique: true,
      allowNull: false,
    },
    wo_id: {
      type: DataTypes.INTEGER,
    },
    po_id: {
      type: DataTypes.INTEGER,
    },
    batch_number: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    inspection_date: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    inspector_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    quantity_inspected: {
      type: DataTypes.DECIMAL(15, 3),
      allowNull: false,
    },
    quantity_accepted: {
      type: DataTypes.DECIMAL(15, 3),
    },
    quantity_rejected: {
      type: DataTypes.DECIMAL(15, 3),
    },
    result: {
      type: DataTypes.ENUM('pending', 'passed', 'failed', 'conditional'),
      defaultValue: 'pending',
    },
    remarks: {
      type: DataTypes.TEXT,
    },
    approved_by: {
      type: DataTypes.INTEGER,
    },
    approved_at: {
      type: DataTypes.DATE,
    }
  }, {
    tableName: 'qc_inspections',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  const DefectLog = sequelize.define('DefectLog', {
    defect_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    inspection_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    defect_type_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    quantity: {
      type: DataTypes.DECIMAL(15, 3),
      allowNull: false,
    },
    severity: {
      type: DataTypes.ENUM('minor', 'major', 'critical'),
      allowNull: false,
    },
    location: {
      type: DataTypes.STRING(200),
    },
    description: {
      type: DataTypes.TEXT,
    },
    root_cause: {
      type: DataTypes.TEXT,
    },
    corrective_action: {
      type: DataTypes.TEXT,
    },
    image_url: {
      type: DataTypes.STRING(500),
    }
  }, {
    tableName: 'defect_logs',
    timestamps: true,
    createdAt: 'logged_at',
    updatedAt: false
  });

  const BatchApproval = sequelize.define('BatchApproval', {
    approval_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    batch_number: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    inspection_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(20),
      defaultValue: 'pending', // "pending", "approved", "rejected", "rework"
    },
    approved_by: {
      type: DataTypes.INTEGER,
    },
    approved_at: {
      type: DataTypes.DATE,
    },
    rejection_reason: {
      type: DataTypes.TEXT,
    },
    rework_instructions: {
      type: DataTypes.TEXT,
    },
    notes: {
      type: DataTypes.TEXT,
    }
  }, {
    tableName: 'batch_approvals',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return { DefectType, QCInspection, DefectLog, BatchApproval };
};
