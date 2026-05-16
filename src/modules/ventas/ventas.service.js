const pool = require('../../config/db')
const promoService = require('../promociones/promociones.service');

exports.getSales = async ({
  negocioId,
  fecha
}) => {

  const client = await pool.connect()

  try {

    const result = await client.query(`
      SELECT
        v.*,
        r.fecha,
        r.hora_inicio,

        c.nombre,
        c.telefono,

        s.nombre AS servicio,

        p.tipo AS promo_tipo,
        p.monto AS promo_monto,
        p.dia AS promo_dia,
        p.segmento AS promo_segmento

          FROM ventas v

          JOIN reservas r
            ON v.reserva_id = r.id

          JOIN clientes c
            ON v.cliente_id = c.id

          JOIN servicios s
            ON r.servicio_id = s.id

          LEFT JOIN promociones p
            ON v.promocion_id = p.id

          WHERE r.fecha = $2
          AND v.negocio_id = $1
        `, [negocioId, fecha]
      );
      
    const total = result.rows.reduce( (sum, v) => sum + Number(v.monto), 0 )

    return {
      fecha,
      total,
      ventas: result.rows
    }

  } finally {
    client.release()
  }
}

exports.getSalesById = async ({ negocioId, cajaId }) => {

  const client = await pool.connect();
  try {

    await client.query('BEGIN');
    // =====================================
    // 🔥 VALIDAR CAJA
    // =====================================
    const cajaResult = await client.query(`
      SELECT
        id,
        fecha,
        cerrado,
        total

      FROM cajas

      WHERE id = $1
      AND negocio_id = $2

      LIMIT 1
    `, [ cajaId, negocioId ]);

    if (cajaResult.rows.length === 0) {
      throw new Error(
        'Caja no encontrada'
      );
    }

    const caja = cajaResult.rows[0];
    // =====================================
    // 🔥 OBTENER VENTAS
    // =====================================
    const result = await client.query(`
      SELECT

        v.id,
        v.created_at,

        -- 💰 venta
        v.monto_original,
        v.descuento,
        v.monto,
        v.metodo_pago,

        -- 🎯 promo
        v.promocion_id,

        -- 👤 cliente
        c.id AS cliente_id,
        c.nombre,
        c.telefono,

        -- 📅 reserva
        r.id AS reserva_id,
        r.fecha,
        r.hora_inicio,
        r.hora_fin,
        r.estado,

        -- 💈 servicio
        s.nombre AS servicio,

        -- 🎁 promoción
        p.tipo AS promo_tipo,
        p.monto AS promo_monto,
        p.dia AS promo_dia,
        p.segmento AS promo_segmento

      FROM ventas v

      JOIN reservas r
        ON v.reserva_id = r.id

      JOIN clientes c
        ON v.cliente_id = c.id

      JOIN servicios s
        ON r.servicio_id = s.id

      LEFT JOIN promociones p
        ON v.promocion_id = p.id

      WHERE v.caja_id = $1
      AND v.negocio_id = $2

      ORDER BY
        v.created_at DESC
    `, [ cajaId, negocioId ]);

    const total = result.rows.reduce( (sum, v) => sum + Number(v.monto), 0 );
    await client.query('COMMIT');

    return {
      caja,
      total,
      ventas: result.rows
    };

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;

  } finally {
    client.release();
  }
};

exports.createVenta = async (data, negocio_id) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 🔥 1. obtener promoción aplicable
    const promo = await promoService.getApplicablePromotion({
      cliente_id: data.cliente_id,
      negocio_id,
      fecha: new Date()
    });

    // 🔥 2. usar SIEMPRE monto_original como base
    const montoOriginal = Number(data.monto_original);

    let descuento = 0;
    let promocion_id = null;

    if (promo && promo.descuento > 0) {
      descuento = Number(promo.descuento);
      promocion_id = promo.promo?.id || null;
    }

    const montoFinal = montoOriginal - descuento;

    // 🔥 3. guardar venta COMPLETA
    const query = `
      INSERT INTO ventas (
        negocio_id,
        cliente_id,
        reserva_id,
        monto,
        metodo_pago,
        monto_original,
        descuento,
        promocion_id
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *
    `;

    const { rows } = await client.query(query, [
      negocio_id,
      data.cliente_id,
      data.reserva_id,
      montoFinal,
      data.metodo_pago,
      montoOriginal,
      descuento,
      promocion_id
    ]);

    await client.query('COMMIT');

    return {
      venta: rows[0],
      descuento,
      promos: promo.promocionesAplicadas || []
    };

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};