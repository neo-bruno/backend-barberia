const express = require('express');
const router = express.Router();
const controller = require('./ventas.controller');
const { verifyToken, allowRoles } = require('../auth/auth.middleware');
/*
------------------------------------------------
 Ventas
------------------------------------------------
*/
// obtener ventas por fecha
router.get('/:fecha', verifyToken, allowRoles('admin'), controller.getSales );
router.get('/:caja_id/caja', verifyToken, allowRoles('admin'), controller.getSalesById)
router.post('/', verifyToken, allowRoles('admin'), controller.createVenta)

module.exports = router;