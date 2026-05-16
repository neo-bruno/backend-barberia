const service = require('./disponibilidad.service');

exports.createAgenda = async (req, res, next) => {
  try {

    const negocioId = req.user.negocio_id

    const data = await service.createAgenda(
      negocioId,
      req.body
    )

    res.json({
      ok: true,
      data
    })

  } catch (error) {
    next(error)
  }
}

exports.getAgenda = async (req, res, next) => {
  try {
    const negocioId = req.user.negocio_id
    const data = await service.getAgenda(negocioId)

    res.json({
      ok: true,
      data
    })

  } catch (error) {
    next(error)
  }
}

exports.getDisponibilidad = async (req, res) => {
  try {

    const negocio_id = req.user.id

    const data = await service.obtenerDisponibilidad( negocio_id )
    res.json(data)
  } catch (error) {
    console.error(error)
    res.status(500).json({
      error: 'Error cargando disponibilidad'
    })

  }
}