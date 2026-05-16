const express = require('express')
const router = express.Router()
const controller = require('./auth.controller')

// 🔓 PUBLICO
router.post('/register', controller.register)
router.post('/login', controller.login)

// 🔐 RECUPERACIÓN
router.post('/request-reset', controller.requestReset)
router.post('/reset-password', controller.resetPassword)

module.exports = router