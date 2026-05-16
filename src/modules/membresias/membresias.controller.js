const service = require('./membresias.service')

exports.create = async (req, res) => {
  try {
    const data = await service.create(req.body, req.user)
    res.json(data)
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
}

exports.list = async (req, res) => {
  const data = await service.list()
  res.json(data)
}

exports.getById = async (req, res) => {
  const data = await service.getById(req.params.id)
  res.json(data)
}

exports.update = async (req, res) => {
  const data = await service.update(req.params.id, req.body)
  res.json(data)
}

exports.addPago = async (req, res) => {
  const data = await service.addPago(req.params.id, req.body.monto)
  res.json(data)
}

exports.suspender = async (req, res) => {
  try {
    const membresia_id = Number(req.params.id)

    if (!membresia_id) {
      return res.status(400).json({
        error: 'La membresía es requerida'
      })
    }
    const result = await service.suspender(membresia_id)

    return res.status(200).json({
      message: 'Membresía suspendida correctamente',
      data: result
    })

  } catch (error) {
    console.error(error)
    return res.status(500).json({
      error: error.message || 'Error interno del servidor'
    })
  }
}

exports.reactivar = async (req, res) => {
  try {
    const membresia_id = Number(req.params.id)

    if (!membresia_id) {
      return res.status(400).json({
        error: 'La membresía es requerida'
      })
    }
    const result = await service.reactivar(membresia_id)

    return res.status(200).json({
      message: 'Membresía reactivada correctamente',
      data: result
    })

  } catch (error) {
    console.error(error)
    return res.status(500).json({
      error: error.message || 'Error interno del servidor'
    })
  }
}