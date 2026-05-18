// uploads.controller.js
const service = require('./images.service');

exports.uploadLogo = async (req, res) => {
  try {
    // =====================================================
    // 🔥 VALIDAR IMAGEN
    // =====================================================
    if (!req.file) {
      return res.status(400).json({
        ok: false,
        message: 'No se recibió ninguna imagen'
      });
    }

    // =====================================================
    // 🔥 NEGOCIO DEL TOKEN
    // =====================================================
    const negocio_id = req.user.negocio_id;

    // =====================================================
    // 🔥 URL IMAGEN
    // =====================================================
    const logo = `${req.protocol}://${req.get('host')}/uploads/negocios/${req.file.filename}`;
    // const logo = `http://peluqueria.emsofe.com/uploads/negocios/${req.file.filename}`;

    // =====================================================
    // 🔥 GUARDAR EN DB
    // =====================================================
    await service.updateLogo(
      negocio_id,
      logo
    );

    // =====================================================
    // 🔥 RESPONSE
    // =====================================================
    return res.status(200).json({
      ok: true,
      logo
    });

  } catch (error) {
    console.error(
      'ERROR UPLOAD LOGO:',
      error
    );
    return res.status(500).json({
      ok: false,
      message: 'Error subiendo imagen'
    });
  }
};

exports.uploadPortada = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        ok: false,
        message: 'No se recibió imagen'
      });
    }

    const negocio_id = req.user.negocio_id;
    const portada_url = `${req.protocol}://${req.get('host')}/uploads/negocios/${req.file.filename}`;
    // const portada_url = `http://peluqueria.emsofe.com/uploads/negocios/${req.file.filename}`;

    await service.updatePortada(
      negocio_id,
      portada_url
    );
    return res.status(200).json({
      ok: true,
      portada_url
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      ok: false,
      message: 'Error subiendo portada'
    });
  }
};

exports.uploadGaleria = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        ok: false,
        message: 'No se recibió imagen'
      });
    }

    const { id } = req.params;
    const negocio_id = req.user.negocio_id;

    const imagen_url = `${req.protocol}://${req.get('host')}/uploads/negocios/${req.file.filename}`;    
    // const imagen_url = `http://peluqueria.emsofe.com/uploads/negocios/${req.file.filename}`;

    // 🔥 ahora es UPDATE en vez de CREATE
    const galeria = await service.updateGaleria(
      id,
      negocio_id,
      imagen_url
    );

    return res.status(200).json({
      ok: true,
      galeria
    });

  } catch (error) {
    console.log(error);
    return res.status(500).json({
      ok: false,
      message: 'Error actualizando imagen de galería'
    });
  }
};