const express = require('express');
const router = express.Router();
const controller = require('./agenda.controller');
const { verifyToken, allowRoles } = require('../auth/auth.middleware');
/*
------------------------------------------------
 Agenda
------------------------------------------------
*/
router.get('/slots/:fecha', verifyToken, allowRoles('admin'), controller.getAgendaSlots)

// solo para publico
router.get('/publico/:slug/:fecha', controller.getAgendaPublic)

module.exports = router;

