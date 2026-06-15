const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { QCInspection, DefectLog, DefectType, BatchApproval, sequelize } = require('../models');
const { authenticateToken } = require('../middleware/auth');

// 1. List all QC inspections
router.get('/inspections', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.skip) || 0;
    const { result, wo_id } = req.query;

    const whereClause = {};
    if (result) {
      whereClause.result = result;
    }
    if (wo_id) {
      whereClause.wo_id = parseInt(wo_id);
    }

    const inspections = await QCInspection.findAll({
      where: whereClause,
      order: [['inspection_date', 'DESC']],
      limit,
      offset
    });

    return res.json(inspections);
  } catch (error) {
    console.error('List Inspections Error:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

// 2. Create new QC inspection
router.post('/inspections', authenticateToken, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { wo_id, po_id, batch_number, quantity_inspected, defects } = req.body;

    // Generate inspection number (QC-YYYYMMDD-XXXX)
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = await QCInspection.count({ transaction: t });
    const inspection_number = `QC-${todayStr}-${(count + 1).toString().padStart(4, '0')}`;

    const new_inspection = await QCInspection.create({
      inspection_number,
      wo_id,
      po_id,
      batch_number,
      quantity_inspected,
      inspector_id: req.user.user_id,
      result: 'pending'
    }, { transaction: t });

    let total_defects = 0;
    let critical_defects = 0;

    if (defects && defects.length > 0) {
      for (const d of defects) {
        await DefectLog.create({
          inspection_id: new_inspection.inspection_id,
          defect_type_id: d.defect_type_id,
          quantity: d.quantity,
          severity: d.severity,
          location: d.location,
          description: d.description
        }, { transaction: t });

        total_defects += parseFloat(d.quantity);
        if (d.severity === 'critical') {
          critical_defects += parseFloat(d.quantity);
        }
      }
    }

    const defect_rate = quantity_inspected > 0 ? (total_defects / quantity_inspected) * 100 : 0;

    if (critical_defects > 0 || defect_rate > 5) {
      new_inspection.result = 'failed';
      new_inspection.quantity_rejected = total_defects;
      new_inspection.quantity_accepted = quantity_inspected - total_defects;
    } else if (defect_rate > 2) {
      new_inspection.result = 'conditional';
      new_inspection.quantity_accepted = quantity_inspected - critical_defects;
      new_inspection.quantity_rejected = critical_defects;
    } else {
      new_inspection.result = 'passed';
      new_inspection.quantity_accepted = quantity_inspected;
      new_inspection.quantity_rejected = 0;
    }

    await new_inspection.save({ transaction: t });

    await t.commit();

    return res.status(201).json(new_inspection);

  } catch (error) {
    await t.rollback();
    console.error('Create Inspection Error:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

// 3. Get inspection details
router.get('/inspections/:inspection_id', authenticateToken, async (req, res) => {
  try {
    const inspection_id = parseInt(req.params.inspection_id);
    const inspection = await QCInspection.findByPk(inspection_id);
    if (!inspection) {
      return res.status(404).json({ detail: 'Inspection not found' });
    }

    const defects = await DefectLog.findAll({
      where: { inspection_id },
      include: [{ model: DefectType, as: 'defect_type' }]
    });

    const insQty = parseFloat(inspection.quantity_inspected || 0);
    const rejQty = parseFloat(inspection.quantity_rejected || 0);

    return res.json({
      inspection,
      defects,
      defect_count: defects.length,
      defect_rate: insQty > 0 ? (rejQty / insQty) * 100 : 0
    });
  } catch (error) {
    console.error('Get Inspection Error:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

// 4. Approve inspection
router.put('/inspections/:inspection_id/approve', authenticateToken, async (req, res) => {
  try {
    const inspection_id = parseInt(req.params.inspection_id);
    const { notes } = req.body;

    const inspection = await QCInspection.findByPk(inspection_id);
    if (!inspection) {
      return res.status(404).json({ detail: 'Inspection not found' });
    }

    inspection.approved_by = req.user.user_id;
    inspection.approved_at = new Date();
    if (notes) {
      inspection.remarks = (inspection.remarks || '') + `\nApproval notes: ${notes}`;
    }
    await inspection.save();

    return res.json({
      message: 'Inspection approved successfully',
      inspection_number: inspection.inspection_number,
      result: inspection.result
    });
  } catch (error) {
    console.error('Approve Inspection Error:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

// 5. Log defect
router.post('/defects', authenticateToken, async (req, res) => {
  try {
    const { inspection_id, defect_type_id, quantity, severity, location, description } = req.body;

    const defect = await DefectLog.create({
      inspection_id,
      defect_type_id,
      quantity,
      severity,
      location,
      description
    });

    return res.json({
      message: 'Defect logged successfully',
      defect_id: defect.defect_id
    });
  } catch (error) {
    console.error('Log Defect Error:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

// 6. List defects
router.get('/defects', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.skip) || 0;
    const { inspection_id, defect_type_id, severity } = req.query;

    const whereClause = {};
    if (inspection_id) {
      whereClause.inspection_id = parseInt(inspection_id);
    }
    if (defect_type_id) {
      whereClause.defect_type_id = parseInt(defect_type_id);
    }
    if (severity) {
      whereClause.severity = severity;
    }

    const count = await DefectLog.count({ where: whereClause });
    const defects = await DefectLog.findAll({
      where: whereClause,
      order: [['logged_at', 'DESC']],
      limit,
      offset
    });

    return res.json({
      total: count,
      defects
    });
  } catch (error) {
    console.error('List Defects Error:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

// 7. Defect Types
router.get('/defects/types', authenticateToken, async (req, res) => {
  try {
    const defect_types = await DefectType.findAll({ where: { is_active: true } });
    return res.json({ total: defect_types.length, defect_types });
  } catch (error) {
    console.error('List Defect Types Error:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

// 8. Get batch approval status
router.get('/batch-approval/:batch_number', authenticateToken, async (req, res) => {
  try {
    const { batch_number } = req.params;
    const approval = await BatchApproval.findOne({ where: { batch_number } });

    if (!approval) {
      const inspection = await QCInspection.findOne({ where: { batch_number } });
      if (!inspection) {
        return res.status(404).json({ detail: 'Batch not found' });
      }

      return res.json({
        batch_number,
        status: 'not_approved',
        inspection
      });
    }

    return res.json({
      batch_number,
      status: approval.status,
      approval
    });
  } catch (error) {
    console.error('Get Batch Approval Error:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

// 9. Approve or reject batch
router.post('/batch-approval/:batch_number', authenticateToken, async (req, res) => {
  try {
    const { batch_number } = req.params;
    const { action, notes, rejection_reason, rework_instructions } = req.body;

    const inspection = await QCInspection.findOne({ where: { batch_number } });
    if (!inspection) {
      return res.status(404).json({ detail: 'No inspection found for this batch' });
    }

    let approval = await BatchApproval.findOne({ where: { batch_number } });

    if (approval) {
      approval.status = action;
      approval.approved_by = req.user.user_id;
      approval.approved_at = new Date();
      approval.notes = notes;
      approval.rejection_reason = rejection_reason;
      approval.rework_instructions = rework_instructions;
      await approval.save();
    } else {
      approval = await BatchApproval.create({
        batch_number,
        inspection_id: inspection.inspection_id,
        status: action,
        approved_by: req.user.user_id,
        approved_at: new Date(),
        notes,
        rejection_reason,
        rework_instructions
      });
    }

    return res.json({
      message: `Batch ${action} successfully`,
      batch_number,
      status: action
    });

  } catch (error) {
    console.error('Approve Batch Error:', error);
    return res.status(500).json({ detail: 'Internal server error' });
  }
});

module.exports = router;
