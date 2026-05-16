const express = require('express');
const router = express.Router();

const controller = require('./pagos.controller');
const { verifyToken, allowRoles } = require('../auth/auth.middleware');

// SOLO superadmin puede crear afiliados
router.post('/', verifyToken, allowRoles('superadmin'), controller.createNewPay);
router.get('/:membresia_id', verifyToken, allowRoles('superadmin'), controller.getPays)
router.put('/', verifyToken, allowRoles('superadmin'), controller.modifyPay);

module.exports = router;