const service = require('./cajas.service');

exports.getCashBoxToday = async (req, res) => {
  try {
    const negocio_id = req.user.negocio_id;
    
    const caja = await service.getCashBoxToday(negocio_id);

    if (!caja) {
      return res.json({
        estado: 'no_existe',
        caja: null
      });
    }

    const total = await service.getTotalVentasHoy(negocio_id);

    return res.json({
      estado: caja.cerrado ? 'cerrada' : 'abierta',
      caja: {
        ...caja,
        total
      }
    });

  } catch (error) {
    console.error('Error getCashBox:', error);
    res.status(500).json({
      message: 'Error al obtener la caja'
    });
  }
}

// POST /cajas
exports.openCashRegister = async (req, res) => {
  try {
    const negocio_id = req.user.negocio_id;
    const usuario_id = req.user.id;

    const { monto_inicial } = req.body;

    // 🔍 validación básica
    if (monto_inicial === undefined || monto_inicial < 0) {
      return res.status(400).json({
        error: 'Monto inicial inválido'
      });
    }

    // 🔍 verificar si ya existe caja hoy
    const existeCaja = await service.getCashBoxToday(negocio_id);

    if (existeCaja) {
      return res.status(400).json({
        error: 'La caja de hoy ya fue abierta'
      });
    }

    // 🟢 crear caja
    const caja = await service.createCashBox({
      negocio_id,
      usuario_id,
      monto_inicial
    });

    return res.status(201).json({
      message: 'Caja abierta correctamente',
      caja
    });

  } catch (error) {
    console.error('Error openCashRegister:', error);
    res.status(500).json({
      error: 'Error al abrir caja'
    });
  }
}
// PATCH /cajas/cerrar
exports.closeCashRegister = async (req, res) => {
  try {
    const negocio_id = req.user.negocio_id;
    const usuario_id = req.user.id;

    // 🔍 buscar caja de hoy
    const caja = await service.getCashBoxToday(negocio_id);

    if (!caja) {
      return res.status(400).json({
        error: 'No existe caja para hoy'
      });
    }

    if (caja.cerrado) {
      return res.status(400).json({
        error: 'La caja ya está cerrada'
      });
    }

    // 🔴 cerrar caja
    const cajaCerrada = await service.closeCashBox({
      negocio_id,
      usuario_id
    });

    return res.json({
      message: 'Caja cerrada correctamente',
      caja: cajaCerrada
    });

  } catch (error) {
    console.error('Error closeCashRegister:', error);

    res.status(500).json({
      error: 'Error al cerrar caja'
    });
  }
};