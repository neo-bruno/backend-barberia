const express = require('express');
const router = express.Router();

const controller = require('./clientes.controller');
const { verifyToken, allowRoles } = require('../auth/auth.middleware');

// SOLO admin puede hacer crud de clientes
// router.post('/', verifyToken, allowRoles('admin'), controller.createReservation);
router.get('/', verifyToken, allowRoles('admin'), controller.getClients)
router.get('/resumen', verifyToken, allowRoles('admin'), controller.getCustomerSummary)
// solo para publico
router.post('/', controller.createClient)
router.get('/espacio/:slug/:id', controller.getSpaceClient)
router.get('/:slug/:telefono', controller.getClientPublic)

module.exports = router;