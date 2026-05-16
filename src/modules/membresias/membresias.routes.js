const express = require('express')
const router = express.Router()

const controller = require('./membresias.controller')
const { verifyToken, allowRoles } = require('../auth/auth.middleware')

router.use(verifyToken, allowRoles('superadmin'))

router.post('/', verifyToken, allowRoles('superadmin'), controller.create)
router.get('/', verifyToken, allowRoles('superadmin'), controller.list)
router.get('/:id', verifyToken, allowRoles('superadmin'), controller.getById)
router.put('/:id', verifyToken, allowRoles('superadmin'), controller.update)
router.patch('/suspender/:id', verifyToken, allowRoles('superadmin'), controller.suspender)
router.patch('/reactivar/:id', verifyToken, allowRoles('superadmin'), controller.reactivar)

// pagos
router.post('/:id/pagos', verifyToken, allowRoles('superadmin'), controller.addPago)

module.exports = router