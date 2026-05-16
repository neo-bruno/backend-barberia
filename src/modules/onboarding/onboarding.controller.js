const service = require('./onboarding.service');

exports.createOnboarding = async (req, res) => {
  try {
    const data = await service.createOnboarding(req.body)
    res.status(200).json(data)

  } catch (error) {
    console.error(error)
    res.status(400).json({
      ok: false,
      error: error.message
    })
  }
}

exports.updateOnboarding = async (req, res) => {
  try {

    const data = await service.updateOnboarding(req.body)

    res.status(200).json(data)

  } catch (error) {

    console.error(error)

    res.status(400).json({
      error: error.message || 'Error al actualizar afiliado'
    })

  }
}