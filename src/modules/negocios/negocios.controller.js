const service = require('./negocios.service');

exports.getBusiness = async (req, res) => {
  try {
    const negocio_id = req.user.negocio_id;
    const negocio = await service.getBusiness(negocio_id);

    if (!negocio) {
      return res.status(404).json({
        ok: false,
        message: 'Negocio no encontrado'
      });
    }
    return res.status(200).json({
      ok: true,
      negocio
    });

  } catch (error) {
    console.error('ERROR GET BUSINESS:', error);
    return res.status(500).json({
      ok: false,
      message: 'Error interno del servidor'
    });
  }
};

exports.modifyBusiness = async (req, res) => {
  try {
    const negocio_id = req.user.negocio_id;
    await service.modifyBusiness(
      negocio_id,
      req.body
    );

    return res.status(200).json({
      ok: true,
      message: 'Negocio actualizado'
    });
  } catch (error) {

    console.log('ERROR MODIFY BUSINESS:', error);
    return res.status(500).json({
      ok: false,
      message: 'Error actualizando negocio'
    });
  }
};