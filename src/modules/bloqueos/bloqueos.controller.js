const blockadeService = require('./bloqueos.service')

exports.createBlockade = async (req, res) => {
  try {
    const negocioId = req.user.negocio_id
    const {
      fecha,
      hora_inicio,
      hora_fin,
      motivo,
      tipo
    } = req.body

    // validación básica
    if (
      !fecha ||
      !hora_inicio ||
      !hora_fin ||
      !motivo ||
      !tipo
    ) {
      return res.status(400).json({
        error: 'Datos incompletos'
      })
    }
    const bloqueo = await blockadeService.createBlockade({
      negocioId,
      fecha,
      hora_inicio,
      hora_fin,
      motivo,
      tipo
    })
    return res.status(201).json({
      message: 'Bloqueo creado correctamente',
      bloqueo
    })
  } catch (error) {
    console.error(error)
    return res.status(500).json({
      error: error.message || 'Error al crear el bloqueo'
    })
  }
}

exports.deleteBlockade = async (req,res) => {
  try{
    const negocioId = req.user.negocio_id
    const { id } = req.params

    await blockadeService.deleteBlockade(
      id,
      negocioId
    )
    res.json({
      message:'Bloqueo eliminado'
    })
  }catch(error){
    console.error(error)
    res.status(500).json({
      error:'Error al eliminar bloqueo'
    })
  }
}