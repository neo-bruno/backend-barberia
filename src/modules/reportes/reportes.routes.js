const express = require('express');
const router = express.Router();

const controller = require('./reportes.controller');
const { verifyToken, allowRoles } = require('../auth/auth.middleware');

// SOLO admin puede hacer los reportes
router.get('/:fechaDesde/:fechaHasta', verifyToken, allowRoles('admin'), controller.getReportCashRegister);
router.get('/:ano', verifyToken, allowRoles('superadmin'), controller.getReportDashboard)

module.exports = router;