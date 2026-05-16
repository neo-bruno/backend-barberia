const service = require('./servicios.service')


exports.createService = async (req, res) => {
  try {
    const negocioId = req.user.negocio_id
    const data = {
      ...req.body,
      negocio_id: negocioId
    }
    const result = await service.createService(data)

    return res.status(201).json(result)
  } catch (error) {
    console.error(error)
    return res.status(
      error.status || 500
    ).json({
      error: error.message || 'Error interno'
    })
  }
}

exports.updateService = async (req, res) => {
  try {
    const negocioId = req.user.negocio_id
    const id = req.params.id

    const result = await service.updateService(
      id,
      negocioId,
      req.body
    )
    return res.status(200).json(result)
  } catch (error) {
    return res.status(
      error.status || 500
    ).json({
      error: error.message || 'Error interno'
    })
  }
}

exports.getServices = async (req, res) => {
  try {
    const negocioId = req.user.negocio_id
    
    const result = await service.getServices(negocioId)
    res.json(result)
  } catch (error) {
    res.status(
      error.status || 500
    ).json({
      error: error.message
    })
  }
}

exports.changeStatus = async (req, res) => {
  try {
    const { activo } = req.body
    const negocioId = req.user.negocio_id
    const id = req.params.id

    const result = await service.changeStatus(
      id,
      negocioId,
      activo
    )
    res.json(result)
  } catch (error) {
    res.status(
      error.status || 500
    ).json({
      error: error.message
    })
  }
}

// solo para publico
exports.getServicesPublic = async (req, res) => {
  try {
    const { slug } = req.params

    if (!slug) {
      return res.status(400).json({
        error: 'El slug es requerido'
      })
    }

    const servicios = await service.getServicesBySlug(slug)

    res.json(servicios)
  } catch (error) {
    res.status(error.status || 500).json({
      error: error.message
    })
  }
}