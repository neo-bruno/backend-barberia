const express = require('express');
const router = express.Router();

const controller = require('./servicios.controller');
const { verifyToken, allowRoles } = require('../auth/auth.middleware');

// SOLO admin puede hacer crud el servicio
router.post('/', verifyToken, allowRoles('admin'), controller.createService);
router.put('/:id', verifyToken, allowRoles('admin'), controller.updateService)
router.get('/', verifyToken, allowRoles('admin'), controller.getServices)
router.patch('/:id/status', verifyToken, allowRoles('admin'), controller.changeStatus)

// solo publico
router.get('/publico/:slug', controller.getServicesPublic)

module.exports = router;