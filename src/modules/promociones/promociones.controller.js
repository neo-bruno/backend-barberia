const service = require('./promociones.service');

// 🔹 CREAR
exports.createPromotion = async (req, res) => {
  try {
    const negocio_id = req.user.negocio_id;

    const promo = await service.createPromotion(req.body, negocio_id);

    res.json(promo);

  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Error al crear promoción' });
  }
};

// 🔹 LISTAR
exports.getPromotions = async (req, res) => {
  try {
    const negocio_id = req.user.negocio_id;

    const promociones = await service.getPromotions(negocio_id);
    const sugerencias = await service.getSuggestions(negocio_id);

    res.json({
      promociones,
      sugerencias
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Error al obtener promociones' });
  }
};

// 🔹 ELIMINAR
exports.deletePromotion = async (req, res) => {
  try {
    const negocio_id = req.user.negocio_id;
    const { id } = req.params;

    await service.deletePromotion(id, negocio_id);

    res.json({ msg: 'Promoción eliminada' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Error al eliminar promoción' });
  }
};

// promociones.controller.js
exports.getApplicablePromotion = async (req, res) => {
  try {
    const cliente_id = req.params.id;
    const fecha = req.params.fecha;
    const negocio_id = req.user.negocio_id;    

    const result = await service.getApplicablePromotion({
      cliente_id,
      negocio_id,
      fecha
    });

    return res.status(200).json(result);

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      msg: 'Error al calcular promoción'
    });
  }
};

exports.changeStatePromotion = async (req, res) => {
  try {
    const { id } = req.params;
    const negocio_id = req.user.negocio_id;

    const { activo } = req.body;

    // 🔒 validación
    if (typeof activo !== 'boolean') {
      return res.status(400).json({
        msg: 'El campo "activo" debe ser true o false'
      });
    }

    const result = await service.changeStatePromotion(
      id,
      negocio_id,
      activo
    );

    res.json({
      msg: `Promoción ${activo ? 'activada' : 'desactivada'} correctamente`,
      promocion: result
    });

  } catch (error) {
    console.error('changeStatePromotion:', error);

    res.status(500).json({
      msg: error.message || 'Error al cambiar estado de la promoción'
    });
  }
};

exports.getPromotionClient = async (req, res) => {
  try {

    const { negocio_id, cliente_id, servicio_id, fecha } = req.params

    const data = await service.getPromotionClient(
      negocio_id,
      cliente_id,
      servicio_id,
      fecha
    )

    res.status(200).json(data)

  } catch (error) {

    console.error(error)

    res.status(error.status || 500).json({
      error: error.message || 'Error interno del servidor'
    })
  }
}