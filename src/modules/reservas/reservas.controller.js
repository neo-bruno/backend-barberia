const reservasService = require('./reservas.service')


exports.createReservation = async (req, res) => {
  try {
    const negocioId = req.user.negocio_id
    const {
      fecha,
      cliente,
      servicio,
      slot
    } = req.body

    // validación básica
    if (
      !fecha ||
      !cliente?.nombre ||
      !cliente?.telefono ||
      !servicio ||
      !slot?.inicio ||
      !slot?.fin
    ) {
      return res.status(400).json({
        error: 'Datos incompletos'
      })
    }
    const reserva = await reservasService.createReservation({
      negocioId,
      fecha,
      cliente,
      servicioId: servicio,
      slot
    })
    return res.status(201).json({
      message: 'Reserva creada correctamente',
      reserva
    })
  } catch (error) {
    console.error(error)
    return res.status(500).json({
      error: error.message || 'Error al crear reserva'
    })
  }
}
exports.getReservations = async (req, res) => {
  try {
    const negocioId = req.user.negocio_id
    const { fecha } = req.params

    if (!fecha) {
      return res.status(400).json({
        error: 'La fecha es requerida'
      })
    }

    const reservas = await reservasService.getReservations({
      negocioId,
      fecha
    })
    return res.json(reservas)

  } catch (error) {
    console.error(error)
    return res.status(500).json({
      error: 'Error al obtener reservas'
    })
  }
}

exports.patchState = async (req, res) => {
  try {
    const negocio_id = req.user.negocio_id
    const { id } = req.params;
    const { estado } = req.body;

    if (!estado) {
      return res.status(400).json({
        msg: 'Debe enviar un estado'
      });
    }

    await reservasService.patchState(id, estado, negocio_id);

    res.json({
      msg: 'Estado actualizado correctamente'
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      msg: error.message || 'Error interno'
    });
  }
}

exports.finalizeReservation = async (req, res) => {
  try {
    const { id } = req.params;
    const negocioId = req.user.negocio_id;

    const {
      caja_id,
      metodo_pago,
      monto_original
    } = req.body;
    
    if (!metodo_pago || !monto_original) {
      return res.status(400).json({
        msg: 'Datos incompletos'
      });
    }

    const resultado = await reservasService.finalizeReservation(
      id,
      negocioId,
      {
        caja_id,
        metodo_pago,
        monto_original
      }
    );

    res.json({
      msg: 'Servicio finalizado correctamente',
      venta: resultado.venta,
      descuento: resultado.descuento,
      promocionesAplicadas: resultado.promos
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      msg: error.message || 'Error interno'
    });
  }
};

exports.rescheduleReservation = async (req, res) => {
  try {

    const { id } = req.params;

    const negocioId = req.user.negocio_id;

    const {
      fecha, hora_inicio, hora_fin, estado
    } = req.body;

    if (!hora_inicio || !hora_fin) {
      return res.status(400).json({
        msg: 'Datos incompletos'
      });
    }

    const resultado =
      await reservasService.rescheduleReservation(
        id,
        negocioId,
        fecha,
        hora_inicio,
        hora_fin,
        estado
      );

    res.json({
      msg: 'Reserva reprogramada correctamente',
      reserva: resultado
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      msg: error.message || 'Error interno'
    });

  }
};

// solo para publico
exports.createReservationClient = async (req, res) => {
  try {
    const data = await reservasService.createReservationClient(req.body)
    res.status(201).json(data)
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
exports.changeReservationPublic = async (req, res) => {

  try {
    const { token } = req.params
    const { fecha, hora_inicio } = req.body

    const reserva = await reservasService.changeReservationPublic(token, { fecha, hora_inicio })

    return res.status(200).json({
      ok: true,
      message: 'Reserva reprogramada correctamente',
      reserva
    })

  } catch (error) {
    console.error(error)
    return res.status(
      error.status || 500
    ).json({
      ok: false,
      message:
        error.message ||
        'Error al reprogramar reserva'
    })
  }
}
exports.cancelReservationPublic = async ( req, res ) => {
  try {
    const { token } = req.params
    const reserva = await reservasService.cancelReservationPublic( token )

    return res.status(200).json({
      ok: true,
      message: 'Reserva cancelada correctamente',
      reserva
    })

  } catch (error) {
    console.error(error)
    return res.status(
      error.status || 500
    ).json({
      ok: false,
      message:
        error.message ||
        'Error al cancelar reserva'
    })
  }
}