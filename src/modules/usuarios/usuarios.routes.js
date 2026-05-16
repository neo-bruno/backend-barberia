const express = require('express')
const router = express.Router()

const controller = require('./usuarios.controller')
const { verifyToken, allowRoles } = require('../auth/auth.middleware')

// 🔒 TODAS PROTEGIDAS
router.use(verifyToken)

// 🔹 listar
router.get('/', allowRoles('admin','superadmin'), controller.list)

// 🔹 detalle
router.get('/:id', allowRoles('admin','superadmin'), controller.getById)

// 🔹 actualizar
router.put('/:id', allowRoles('admin','superadmin'), controller.update)

// 🔹 activar / desactivar
router.patch('/:id/activo', allowRoles('admin','superadmin'), controller.toggleActivo)

module.exports = router