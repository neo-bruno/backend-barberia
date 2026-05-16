const express = require('express');
const router = express.Router();

const controller = require('./bloqueos.controller');
const { verifyToken, allowRoles } = require('../auth/auth.middleware');

// SOLO admin puede hacer crud de clientes
router.post('/', verifyToken, allowRoles('admin'), controller.createBlockade);
router.delete('/:id', verifyToken, allowRoles('admin'), controller.deleteBlockade)
// router.get('/', verifyToken, allowRoles('admin'), controller.getClients)

module.exports = router;