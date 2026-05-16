const pool = require('../../config/db')
const promoService = require('../promociones/promociones.service');

exports.createReservation = async ({
  negocioId,
  fecha,
  cliente,
  servicioId,
  slot
}) => {

  const client = await pool.connect()

  try {

    await client.query('BEGIN')


    // 1 buscar cliente existente
    let clienteResult = await client.query(
      `
      SELECT id
      FROM clientes
      WHERE negocio_id=$1
      AND telefono=$2
    `,
      [
        negocioId,
        cliente.telefono
      ]
    )
    let clienteId

    if (clienteResult.rows.length) {
      clienteId = clienteResult.rows[0].id
    } else {
      const nuevoCliente = await client.query(
        `
        INSERT INTO clientes(
        negocio_id,
        nombre,
        telefono,
        notas
        )
        VALUES($1, $2, $3, $4)
        RETURNING id
        `,
        [
          negocioId,
          cliente.nombre,
          cliente.telefono,
          cliente.notas
        ]
      )
      clienteId = nuevoCliente.rows[0].id
    }

    // 2 validar si horario sigue libre
    const conflicto = await client.query(
      `
      SELECT id
      FROM reservas
      WHERE negocio_id=$1
      AND fecha=$2
      AND estado NOT IN ('cancelada','no_asistio')
      AND (
          hora_inicio < $3
          AND hora_fin > $4
      )
      `,
      [
        negocioId,
        fecha,
        slot.fin,
        slot.inicio
      ]
    )


    if (conflicto.rows.length) {
      throw new Error('Ese horario ya fue reservado')
    }



    // 3 crear reserva
    const reservaResult = await client.query(
      `
      INSERT INTO reservas(
          negocio_id,
          cliente_id,
          servicio_id,
          fecha,
          hora_inicio,
          hora_fin,
          estado,
          notas
      )
      VALUES(
          $1,$2,$3,$4,$5,$6,'confirmada', $7
      )
      RETURNING *
      `,
      [
        negocioId,
        clienteId,
        servicioId,
        fecha,
        slot.inicio,
        slot.fin,
        cliente.notas
      ]
    )

    await client.query('COMMIT')
    return reservaResult.rows[0]

  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

exports.getReservations = async ({
  negocioId,
  fecha
}) => {

  const result = await pool.query(
    `
    SELECT
      r.id,
      r.fecha,
      TO_CHAR(r.hora_inicio,'HH24:MI') AS hora_inicio,
      TO_CHAR(r.hora_fin,'HH24:MI') AS hora_fin,
      r.estado,
      c.nombre cliente,
      c.telefono,
      s.nombre servicio,
      s.precio
    FROM reservas r
    JOIN clientes c
      ON c.id=r.cliente_id
    JOIN servicios s
      ON s.id=r.servicio_id
    WHERE r.negocio_id=$1
    AND r.fecha=$2
    ORDER BY r.hora_inicio
    `,
    [negocioId, fecha]
  )
  return result.rows
}

exports.patchState = async (id, estado, negocio_id) => {

  const estadosPermitidos = [
    'confirmada',
    'proceso',
    'completada',
    'cancelada',
    'no_asistio'
  ];

  if (!estadosPermitidos.includes(estado)) {
    throw new Error('Estado inválido');
  }

  const estadosBloqueados = ['proceso', 'completada']

  if (estadosBloqueados.includes(estado)) {

    const estadoCaja = await pool.query(
      `SELECT cerrado FROM cajas
      WHERE negocio_id = $1 AND fecha = CURRENT_DATE`,
      [negocio_id]
    )

    const caja = estadoCaja.rows[0]

    if (!caja) {
      throw new Error('Debe abrir la caja antes de iniciar servicios')
    }

    if (caja.cerrado) {
      throw new Error('Caja cerrada, no se pueden iniciar servicios')
    }
  }
  
  const result = await pool.query(`
      UPDATE reservas
      SET estado = $1
      WHERE id = $2
      AND negocio_id = $3
      RETURNING *
  `, [estado, id, negocio_id]);

  if (result.rows.length === 0) {
    throw new Error('Reserva no encontrada');
  }

  return result.rows[0];
}

// exports.finalizeReservation = async (
//   reservaId,
//   negocioId,
//   data
// ) => {
//   const client = await pool.connect();

//   try {
//     await client.query('BEGIN');

//     // 🔹 1. validar reserva
//     const reservaResult = await client.query(`
//       SELECT id, cliente_id, estado
//       FROM reservas
//       WHERE id=$1
//       AND negocio_id=$2
//     `, [reservaId, negocioId]);

//     if (reservaResult.rows.length === 0) {
//       throw new Error('Reserva no encontrada');
//     }

//     const reserva = reservaResult.rows[0];

//     if (reserva.estado !== 'proceso') {
//       throw new Error('Solo reservas en proceso pueden finalizarse');
//     }

//     // 🔹 2. aplicar promociones
//     const promo = await promoService.getApplicablePromotion({
//       cliente_id: reserva.cliente_id,
//       negocio_id: negocioId,
//       fecha: new Date()
//     });

//     const montoOriginal = Number(data.monto_original);

//     let descuento = 0;
//     let promocion_id = null;

//     if (promo && promo.descuento > 0) {
//       descuento = Number(promo.descuento);
//       promocion_id = promo.promo?.id || null;
//     }

//     const montoFinal = montoOriginal - descuento;

//     // 🔹 3. crear venta COMPLETA
//     const ventaResult = await client.query(`
//       INSERT INTO ventas(
//         negocio_id,
//         reserva_id,
//         cliente_id,
//         monto,
//         metodo_pago,
//         promocion_id,
//         monto_original,
//         descuento
//       )
//       VALUES($1,$2,$3,$4,$5,$6,$7,$8)
//       RETURNING *
//     `,
//     [
//       negocioId,
//       reservaId,
//       reserva.cliente_id,
//       montoFinal,
//       data.metodo_pago,
//       promocion_id,
//       montoOriginal,
//       descuento      
//     ]);

//     // 🔹 4. completar reserva
//     await client.query(`
//       UPDATE reservas
//       SET estado='completada'
//       WHERE id=$1
//       AND negocio_id=$2
//     `,
//     [reservaId, negocioId]);

//     await client.query('COMMIT');

//     return {
//       venta: ventaResult.rows[0],
//       descuento,
//       promos: promo.promocionesAplicadas || []
//     };

//   } catch (error) {
//     await client.query('ROLLBACK');
//     throw error;
//   } finally {
//     client.release();
//   }
// };

exports.finalizeReservation = async ( reservaId, negocioId, data ) => {

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // =====================================================
    // 🔥 1. VALIDAR RESERVA
    // =====================================================
    const reservaResult = await client.query(`
      SELECT
        r.id,
        r.cliente_id,
        r.estado,
        r.negocio_id,

        s.id AS servicio_id,
        s.precio

      FROM reservas r

      INNER JOIN servicios s
        ON s.id = r.servicio_id

      WHERE r.id = $1
      AND r.negocio_id = $2

      LIMIT 1
    `,
    [
      reservaId,
      negocioId
    ]);

    if (reservaResult.rows.length === 0) {
      throw new Error(
        'Reserva no encontrada'
      );
    }
    const reserva = reservaResult.rows[0];
    // =====================================================
    // 🔥 2. VALIDAR ESTADO
    // =====================================================
    if (reserva.estado !== 'proceso') {
      throw new Error(
        'Solo reservas en proceso pueden finalizarse'
      );
    }
    // =====================================================
    // 🔥 3. VALIDAR CAJA
    // =====================================================
    if (!data.caja_id) {
      throw new Error(
        'Caja requerida'
      );
    }
    const cajaResult = await client.query(`
      SELECT
        id,
        cerrado

      FROM cajas

      WHERE id = $1
      AND negocio_id = $2

      LIMIT 1
    `, [ data.caja_id, negocioId ]);

    if (cajaResult.rows.length === 0) {
      throw new Error(
        'Caja no encontrada'
      );
    }

    const caja = cajaResult.rows[0];
    if (caja.cerrado) {
      throw new Error(
        'La caja está cerrada'
      );
    }
    // =====================================================
    // 🔥 4. PROMOCIONES
    // =====================================================
    const promo = await promoService.getApplicablePromotion({ cliente_id: reserva.cliente_id, negocio_id: negocioId, fecha: new Date() });

    const montoOriginal = Number( data.monto_original || reserva.precio );
    let descuento = 0;
    let promocion_id = null;

    if ( promo && promo.descuento > 0 ) {
      descuento = Number(promo.descuento);
      promocion_id = promo.promo?.id || null;
    }
    // =====================================================
    // 🔥 5. TOTAL FINAL
    // =====================================================
    const montoFinal = montoOriginal - descuento;

    if (montoFinal < 0) {
      throw new Error(
        'Monto final inválido'
      );
    }
    // =====================================================
    // 🔥 6. CREAR VENTA
    // =====================================================
    const ventaResult = await client.query(`
      INSERT INTO ventas (

        negocio_id,
        caja_id,

        reserva_id,
        cliente_id,

        promocion_id,

        monto_original,
        descuento,
        monto,

        metodo_pago

      )

      VALUES (
        $1,$2,$3,$4,$5,
        $6,$7,$8,
        $9
      )

      RETURNING *
    `,
    [
      negocioId,
      data.caja_id,

      reserva.id,
      reserva.cliente_id,

      promocion_id,

      montoOriginal,
      descuento,
      montoFinal,

      data.metodo_pago
    ]);

    const venta = ventaResult.rows[0];
    // =====================================================
    // 🔥 7. COMPLETAR RESERVA
    // =====================================================
    await client.query(`
      UPDATE reservas

      SET estado = 'completada'

      WHERE id = $1
      AND negocio_id = $2
    `,
    [ reservaId, negocioId ]);
    // =====================================================
    // 🔥 8. COMMIT
    // =====================================================
    await client.query('COMMIT');

    return {
      venta,
      descuento,
      promos:
        promo?.promocionesAplicadas || []
    };

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;

  } finally {
    client.release();
  }
};

exports.rescheduleReservation = async(
  id,
  negocioId,
  fecha,
  hora_inicio,
  hora_fin,
  estado
)=>{

  const client = await pool.connect();

  try{

    await client.query('BEGIN');


    // validar que exista y esté en proceso
    const reservaResult = await client.query(`
      SELECT id, cliente_id, estado
      FROM reservas
      WHERE id=$1
      AND negocio_id=$2
    `,[id, negocioId]);
    const clienteId = reservaResult.rows[0].cliente_id

    if(reservaResult.rows.length===0){
      throw new Error('Reserva no encontrada');
    }

    const reserva = reservaResult.rows[0];

    if(reserva.estado !== 'confirmada'){
      throw new Error(
        'Solo reservas confirmadas pueden finalizarse'
      );
    }

    // completar reserva
    const updateReservaResult = await client.query(`
      UPDATE public.reservas
      SET  fecha=$4, hora_inicio=$5, hora_fin=$6, estado=$7
      WHERE id=$1 AND negocio_id=$2 AND cliente_id=$3 RETURNING *;
    `,
    [id, negocioId, clienteId, fecha, hora_inicio, hora_fin, estado]);

    await client.query('COMMIT');
    return updateReservaResult.rows[0];

  }catch(error){
    await client.query('ROLLBACK');
    throw error;
  }finally{
    client.release();
  }
}

// solo para publico
exports.createReservationClient = async ( reserva ) => {

  const client = await pool.connect()

  try {

    await client.query('BEGIN')

    const {
      negocio_id,
      cliente_id,
      servicio_id,
      fecha,
      hora_inicio,
      hora_fin,
      notas,
      estado
    } = reserva
    console.log('datos para crear cliente: ', negocio_id,
      cliente_id,
      servicio_id,
      fecha,
      hora_inicio,
      hora_fin,
      notas,
      estado)
    // 🔥 1. VALIDAR SERVICIO
    const servicioQuery = `
      SELECT *
      FROM servicios
      WHERE id = $1
      AND negocio_id = $2
      LIMIT 1
    `

    const servicioRes = await client.query(
      servicioQuery,
      [servicio_id, negocio_id]
    )

    if (servicioRes.rows.length === 0) {
      throw {
        status: 404,
        message: 'Servicio no encontrado'
      }
    }

    // 🔥 2. VALIDAR CLIENTE
    const clienteQuery = `
      SELECT *
      FROM clientes
      WHERE id = $1
      AND negocio_id = $2
      LIMIT 1
    `

    const clienteRes = await client.query(
      clienteQuery,
      [cliente_id, negocio_id]
    )

    if (clienteRes.rows.length === 0) {
      throw {
        status: 404,
        message: 'Cliente no encontrado'
      }
    }

    // 🔥 3. VALIDAR CRUCE DE HORARIOS
    const conflictoQuery = `
      SELECT id
      FROM reservas
      WHERE negocio_id = $1
      AND fecha = $2

      AND estado NOT IN (
        'cancelada',
        'no_asistio'
      )

      AND (
        (hora_inicio < $4)
        AND
        (hora_fin > $3)
      )

      LIMIT 1
    `

    const conflictoRes = await client.query(
      conflictoQuery,
      [
        negocio_id,
        fecha,
        hora_inicio,
        hora_fin
      ]
    )

    if (conflictoRes.rows.length > 0) {

      throw {
        status: 409,
        message:
          'El horario ya fue reservado'
      }
    }

    // 🔥 4. VALIDAR BLOQUEOS
    const bloqueoQuery = `
      SELECT id
      FROM bloqueos
      WHERE negocio_id = $1
      AND fecha = $2

      AND (
        (
          hora_inicio IS NULL
          AND hora_fin IS NULL
        )

        OR

        (
          hora_inicio < $4
          AND hora_fin > $3
        )
      )

      LIMIT 1
    `

    const bloqueoRes = await client.query(
      bloqueoQuery,
      [
        negocio_id,
        fecha,
        hora_inicio,
        hora_fin
      ]
    )

    if (bloqueoRes.rows.length > 0) {

      throw {
        status: 409,
        message:
          'Horario no disponible'
      }
    }

    // 🔥 5. CREAR RESERVA
    const insertQuery = `
      INSERT INTO reservas (
        negocio_id,
        cliente_id,
        servicio_id,
        fecha,
        hora_inicio,
        hora_fin,
        estado,
        notas
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8
      )
      RETURNING *
    `

    const insertRes = await client.query(
      insertQuery,
      [
        negocio_id,
        cliente_id,
        servicio_id,
        fecha,
        hora_inicio,
        hora_fin,
        estado || 'pendiente',
        notas || ''
      ]
    )

    const nuevaReserva = insertRes.rows[0]

    await client.query('COMMIT')

    return nuevaReserva

  } catch (error) {

    await client.query('ROLLBACK')

    throw error

  } finally {

    client.release()
  }
}
exports.changeReservationPublic = async ( token, data ) => {

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { fecha, hora_inicio } = data

    // =====================================
    // 🔥 1. BUSCAR RESERVA POR TOKEN
    // =====================================

    const reservaQuery = `
      SELECT
        r.*,
        s.duracion
      FROM reservas r
      INNER JOIN servicios s
        ON s.id = r.servicio_id
      WHERE r.token = $1
      LIMIT 1
    `
    const reservaRes = await client.query( reservaQuery, [token] )

    if (reservaRes.rows.length === 0) {
      throw {
        status: 404,
        message: 'Reserva no encontrada'
      }
    }

    const reserva = reservaRes.rows[0]

    // =====================================
    // 🔥 2. VALIDAR ESTADO
    // =====================================

    const estadosPermitidos = [ 'pendiente', 'confirmada' ]
    if ( !estadosPermitidos.includes( reserva.estado )) {
      throw {
        status: 400,
        message:
          'Esta reserva no puede reprogramarse'
      }
    }

    // =====================================
    // 🔥 3. CALCULAR NUEVA HORA FIN
    // =====================================

    const sumarMinutos = ( hora, minutos ) => {      
      const [ h, m ] = hora.split(':').map(Number)
      const date = new Date()

      date.setHours(h)
      date.setMinutes(m + minutos)

      const hh = String( date.getHours() ).padStart(2, '0')
      const mm = String( date.getMinutes() ).padStart(2, '0')
      
      return `${hh}:${mm}`
    }

    const hora_fin = sumarMinutos( hora_inicio, reserva.duracion )

    // =====================================
    // 🔥 4. VALIDAR SOLAPAMIENTOS
    // =====================================

    const conflictoQuery = `
      SELECT id
      FROM reservas

      WHERE negocio_id = $1
      AND fecha = $2

      AND estado NOT IN (
        'cancelada',
        'no_asistio'
      )

      AND id != $3

      AND (
        hora_inicio < $4::time
        AND hora_fin > $5::time
      )

      LIMIT 1
    `
    const conflictoRes = await client.query(conflictoQuery, [reserva.negocio_id, fecha, reserva.id, hora_fin, hora_inicio])

    if (conflictoRes.rows.length > 0) {
      throw {
        status: 400,
        message:
          'El horario ya no está disponible'
      }
    }

    // =====================================
    // 🔥 5. ACTUALIZAR RESERVA
    // =====================================

    const updateQuery = `
      UPDATE reservas

      SET
        fecha = $1,
        hora_inicio = $2,
        hora_fin = $3
      WHERE id = $4

      RETURNING *
    `
    const updateRes = await client.query( updateQuery, [ fecha, hora_inicio, hora_fin, reserva.id ] )

    await client.query('COMMIT')
    return updateRes.rows[0]
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
exports.cancelReservationPublic = async ( token ) => {  
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    // =====================================
    // 🔥 1. BUSCAR RESERVA
    // =====================================

    const reservaQuery = `
      SELECT *
      FROM reservas
      WHERE token = $1
      LIMIT 1
    `
    const reservaRes = await client.query( reservaQuery, [token] )

    if (reservaRes.rows.length === 0) {
      throw {
        status: 404,
        message: 'Reserva no encontrada'
      }
    }

    const reserva = reservaRes.rows[0]
    // =====================================
    // 🔥 2. VALIDAR ESTADO
    // =====================================

    const estadosPermitidos = [ 'pendiente', 'confirmada' ]

    if (!estadosPermitidos.includes( reserva.estado )) {
      throw {
        status: 400,
        message: 'Esta reserva no puede cancelarse'
      }
    }
    // =====================================
    // 🔥 3. CANCELAR RESERVA
    // =====================================
    const updateQuery = `
      UPDATE reservas
      SET estado = 'cancelada'
      WHERE id = $1
      RETURNING *
    `
    const updateRes = await client.query( updateQuery, [reserva.id] )

    await client.query('COMMIT')
    return updateRes.rows[0]
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}