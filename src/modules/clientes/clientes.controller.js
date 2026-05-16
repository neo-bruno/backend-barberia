const clientsService = require('./clientes.service')

exports.getClients = async (req, res) => {
  try {
    const negocioId = req.user.negocio_id
        
    const clientes = await clientsService.getClients({ negocioId })
    return res.json(clientes)

  } catch (error) {
    console.error(error)
    return res.status(500).json({
      error: 'Error al obtener clientes'
    })
  }
}

exports.getCustomerSummary = async (req, res) => {
  try {
    const negocio_id = req.user.negocio_id
    if (!negocio_id) {
      return res.status(400).json({
        msg: 'Usuario sin negocio asignado'
      })
    }
    const data = await clientsService.getCustomerSummary(negocio_id)
    res.json(data)

  } catch (error) {
    console.error(error)
    res.status(500).json({
      msg: 'Error obteniendo resumen de clientes'
    })
  }
}

// solo para publico
exports.createClient = async (req, res) => {
  try {
    const cliente = await clientsService.createClient(req.body)

    return res.status(cliente.status).json(cliente.data)
  } catch (error) {

    console.error(error)
    return res.status(500).json({
      error: 'Error al procesar cliente'
    })
  }
}
exports.getSpaceClient = async ( req, res ) => {

  try {
    const {slug, id} = req.params
    const data = await clientsService.getSpaceClient(slug, id)
    res.status(200).json(data)
  } catch (error) {
    console.error(error)
    res.status(
      error.status || 500
    ).json({
      error:
        error.message ||
        'Error interno del servidor'
    })
  }
}
exports.getClientPublic = async ( req, res ) => {
  try {
    const { slug, telefono } = req.params
    const cliente = await clientsService.getClientPublic( slug, telefono )
    return res.status(200).json({
      ok: true,
      cliente
    })

  } catch (error) {

    console.error(error)

    return res.status(
      error.status || 500
    ).json({
      ok: false,
      message:
        error.message ||
        'Error al obtener cliente'
    })
  }
}
