const express = require('express');
const router = express.Router();

const controller = require('./negocios.controller');
const { verifyToken, allowRoles } = require('../auth/auth.middleware');

// SOLO admin puede hacer los reportes
router.get('/', verifyToken, allowRoles('admin'), controller.getBusiness)
router.put('/', verifyToken, allowRoles('admin'), controller.modifyBusiness)
// router.patch('/:id/estado', verifyToken, allowRoles('admin'), controller.changeStatePromotion)

module.exports = router;