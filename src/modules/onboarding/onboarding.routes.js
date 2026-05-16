const express = require('express');
const router = express.Router();

const controller = require('./onboarding.controller');
const { verifyToken, allowRoles } = require('../auth/auth.middleware');

// SOLO superadmin puede crear afiliados
router.post('/', verifyToken, allowRoles('superadmin'), controller.createOnboarding);
router.put('/', verifyToken, allowRoles('superadmin'), controller.updateOnboarding);

module.exports = router;