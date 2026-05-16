const service = require('./pagos.service')

exports.createNewPay = async (req, res) => {

  try {
    const body = req.body

    // =====================================================
    // DATA
    // =====================================================
    const membresia_id = Number(body.membresia_id)
    const monto = Number(body.monto)
    const metodo_pago = body.metodo_pago

    const usuario_id = req.user?.id

    // =====================================================
    // VALIDACIONES
    // =====================================================
    if (!membresia_id) {
      return res.status(400).json({
        error: 'La membresía es requerida'
      })
    }

    if (!monto || monto <= 0) {
      return res.status(400).json({
        error: 'El monto debe ser mayor a 0'
      })
    }

    if (!metodo_pago) {
      return res.status(400).json({
        error: 'Debe seleccionar un método de pago'
      })
    }

    const metodosValidos = ['efectivo', 'qr']

    if (!metodosValidos.includes(metodo_pago)) {
      return res.status(400).json({
        error: 'Método de pago inválido'
      })
    }

    // =====================================================
    // SERVICE
    // =====================================================

    const result = await service.createNewPay({
      membresia_id,
      monto,
      metodo_pago,
      usuario_id
    })

    return res.status(200).json({
      message: 'Pago registrado correctamente',
      data: result
    })

  } catch (error) {

    console.error(error)

    return res.status(500).json({
      error: error.message || 'Error interno del servidor'
    })
  }
}

// =====================================================
// OBTENER PAGOS
// =====================================================
exports.getPays = async (req, res) => {
  try {
    const membresia_id = Number(req.params.membresia_id)

    if (!membresia_id) {
      return res.status(400).json({
        error: 'La membresía es requerida'
      })
    }

    const result = await service.getPays(membresia_id)
    return res.status(200).json({
      data: result
    })

  } catch (error) {
    console.error(error)
    return res.status(500).json({
      error: error.message || 'Error interno del servidor'
    })
  }
}

// =====================================================
// MODIFICAR PAGO
// =====================================================
exports.modifyPay = async (req, res) => {
  try {
    const body = req.body

    const id = Number(body.id)
    const monto = Number(body.monto)
    const metodo_pago = body.metodo_pago

    // =====================================================
    // VALIDACIONES
    // =====================================================
    if (!id) {
      return res.status(400).json({
        error: 'El pago es requerido'
      })
    }

    if (!monto || monto <= 0) {
      return res.status(400).json({
        error: 'El monto debe ser mayor a 0'
      })
    }

    if (!metodo_pago) {
      return res.status(400).json({
        error: 'Debe seleccionar un método de pago'
      })
    }

    const metodosValidos = ['efectivo', 'qr']

    if (!metodosValidos.includes(metodo_pago)) {
      return res.status(400).json({
        error: 'Método de pago inválido'
      })
    }

    const result = await service.modifyPay({
      id,
      monto,
      metodo_pago
    })

    return res.status(200).json({
      message: 'Pago actualizado correctamente',
      data: result
    })

  } catch (error) {

    console.error(error)

    return res.status(500).json({
      error: error.message || 'Error interno del servidor'
    })
  }
}