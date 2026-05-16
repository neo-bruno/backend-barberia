const express = require('express');
const router = express.Router();
const controller = require('./cajas.controller');
const { verifyToken, allowRoles } = require('../auth/auth.middleware');
/*
------------------------------------------------
 Cajas
------------------------------------------------
*/
// obtener caja de hoy
router.get( '/', verifyToken, allowRoles('admin'), controller.getCashBoxToday )
router.post('/', verifyToken, allowRoles('admin'), controller.openCashRegister)
router.patch('/cerrar', verifyToken, allowRoles('admin'), controller.closeCashRegister)

module.exports = router;