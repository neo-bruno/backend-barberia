const express = require('express');
const router = express.Router();
const controller = require('./disponibilidad.controller');
const { verifyToken, allowRoles } = require('../auth/auth.middleware');
/*
------------------------------------------------
 Disponibilidad / Agenda
------------------------------------------------
*/
// guardar plantilla semanal + bloqueos
router.post( '/', verifyToken, allowRoles('admin'), controller.createAgenda);

// cargar disponibilidad configurada
router.get( '/', verifyToken, allowRoles('admin'), controller.getAgenda );
router.get('/plantilla', verifyToken, allowRoles('admin'), controller.getDisponibilidad)

module.exports = router;