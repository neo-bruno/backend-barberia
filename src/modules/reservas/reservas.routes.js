const express = require('express');
const router = express.Router();

const controller = require('./reservas.controller');
const { verifyToken, allowRoles } = require('../auth/auth.middleware');

// SOLO admin puede hacer crud el reservas
router.post('/', verifyToken, allowRoles('admin'), controller.createReservation);
router.get('/:fecha', verifyToken, allowRoles('admin'), controller.getReservations)

// acciones
router.patch('/:id/estado', verifyToken, allowRoles('admin'), controller.patchState);
router.patch('/:id/finalizar', verifyToken, allowRoles('admin'), controller.finalizeReservation);
router.patch('/:id/reprogramar', verifyToken, allowRoles('admin'), controller.rescheduleReservation)

// solo para publico
router. post('/publico', controller.createReservationClient)
router.patch('/publico/:token', controller.changeReservationPublic)
router.patch('/publico/:token/cancelar', controller.cancelReservationPublic)
module.exports = router;