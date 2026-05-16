const express = require('express');
const router = express.Router();

const controller = require('./promociones.controller');
const { verifyToken, allowRoles } = require('../auth/auth.middleware');

// SOLO admin puede hacer los reportes
router.post('/', verifyToken, allowRoles('admin'), controller.createPromotion);
router.get('/', verifyToken, allowRoles('admin'), controller.getPromotions)
router.delete('/:id', verifyToken, allowRoles('admin'), controller.deletePromotion)
router.patch('/:id/estado', verifyToken, allowRoles('admin'), controller.changeStatePromotion)
router.get('/aplicable/:id/:fecha', verifyToken, allowRoles('admin'), controller.getApplicablePromotion)
router.get('/publico/:negocio_id/:cliente_id/:servicio_id/:fecha', controller.getPromotionClient)

module.exports = router;