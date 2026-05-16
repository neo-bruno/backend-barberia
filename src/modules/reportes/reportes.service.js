const pool = require('../../config/db')

exports.getReportCashRegister = async (fechaDesde, fechaHasta, negocio_id) => {

  const result = await pool.query(`
    SELECT 
      c.id,
      c.fecha,

      -- horas reales desde timestamp
      TO_CHAR(c.fecha_apertura, 'HH24:MI') AS hora_apertura,
      TO_CHAR(c.fecha_cierre, 'HH24:MI') AS hora_cierre,

      CASE 
        WHEN c.cerrado = false THEN 'abierta'
        ELSE 'cerrada'
      END AS estado,

      COALESCE(SUM(v.monto), 0) AS total,

      COALESCE(SUM(
        CASE WHEN v.metodo_pago = 'efectivo' THEN v.monto END
      ), 0) AS efectivo,

      COALESCE(SUM(
        CASE WHEN v.metodo_pago = 'qr' THEN v.monto END
      ), 0) AS digital

    FROM cajas c

    LEFT JOIN ventas v 
      ON v.negocio_id = c.negocio_id
      AND DATE(v.created_at) = c.fecha

    WHERE c.fecha BETWEEN $1 AND $2
    AND c.negocio_id = $3

    GROUP BY c.id
    ORDER BY c.fecha DESC;
  `, [fechaDesde, fechaHasta, negocio_id])

  const dias = result.rows

  const totales = dias.reduce((acc, item) => {
    acc.total += Number(item.total)
    acc.efectivo += Number(item.efectivo)
    acc.digital += Number(item.digital)
    return acc
  }, {
    total: 0,
    efectivo: 0,
    digital: 0
  })

  return { totales, dias }
}

// ==============================
// reportes.service.js
// ==============================
exports.getReportDashboard = async (ano) => {

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    // =====================================
    // NEGOCIOS
    // =====================================
    const negociosQuery = `
      SELECT
        COUNT(*)::int AS total,

        COUNT(*) FILTER (
          WHERE activo = true
        )::int AS activos,

        COUNT(*) FILTER (
          WHERE activo = false
        )::int AS suspendidos

      FROM negocios;
    `

    const negociosResult = await client.query(negociosQuery)
    // =====================================
    // USUARIOS
    // =====================================
    const usuariosQuery = `
      SELECT
        COUNT(*)::int AS total,

        COUNT(*) FILTER (
          WHERE activo = true
        )::int AS activos,

        COUNT(*) FILTER (
          WHERE activo = false
        )::int AS suspendidos

      FROM usuarios

      WHERE rol != 'superadmin';
    `

    const usuariosResult = await client.query(usuariosQuery)
    // =====================================
    // MEMBRESIAS
    // =====================================
    const membresiasQuery = `
      SELECT

        COUNT(*)::int AS total,

        COUNT(*) FILTER (
          WHERE estado = 'activo'
        )::int AS activas,

        COUNT(*) FILTER (
          WHERE estado = 'suspendido'
        )::int AS suspendidas,

        COUNT(*) FILTER (
          WHERE estado = 'vencido'
        )::int AS vencidas

      FROM membresias;
    `

    const membresiasResult = await client.query(membresiasQuery)
    // =====================================
    // PAGOS / INGRESOS
    // =====================================
    const pagosQuery = `
      SELECT

        COUNT(*)::int AS total_pagos,

        COALESCE(
          SUM(monto),
          0
        )::int AS total_ingresos

      FROM pagos

      WHERE EXTRACT(YEAR FROM fecha_pago) = $1;
    `

    const pagosResult = await client.query(
      pagosQuery,
      [ano]
    )
    // =====================================
    // RESERVAS HOY
    // =====================================
    const reservasQuery = `
      SELECT

        COUNT(*)::int AS hoy

      FROM reservas

      WHERE fecha = CURRENT_DATE;
    `

    const reservasResult = await client.query(
      reservasQuery
    )

    // =====================================
    // INGRESOS MENSUALES
    // =====================================

    const ingresosMensualesQuery = `
      SELECT

        TO_CHAR(fecha_pago, 'Mon') AS mes,

        COALESCE(
          SUM(monto),
          0
        )::int AS total

      FROM pagos

      WHERE EXTRACT(YEAR FROM fecha_pago) = $1

      GROUP BY mes,
      EXTRACT(MONTH FROM fecha_pago)

      ORDER BY
      EXTRACT(MONTH FROM fecha_pago);
    `

    const ingresosMensualesResult = await client.query(
      ingresosMensualesQuery,
      [ano]
    )

    // =====================================
    // ULTIMOS PAGOS
    // =====================================

    const ultimosPagosQuery = `
      SELECT

        p.id,

        n.nombre AS negocio,

        u.nombre AS usuario,

        p.monto::int,

        p.metodo_pago,

        m.estado,

        p.fecha_pago

      FROM pagos p

      JOIN membresias m
        ON m.id = p.membresia_id

      JOIN negocios n
        ON n.id = m.negocio_id

      JOIN usuarios u
        ON u.id = m.usuario_id

      WHERE EXTRACT(YEAR FROM p.fecha_pago) = $1

      ORDER BY p.fecha_pago DESC

      LIMIT 10;
    `

    const ultimosPagosResult = await client.query(
      ultimosPagosQuery,
      [ano]
    )

    await client.query('COMMIT')

    return {

      negocios: negociosResult.rows[0],

      usuarios: usuariosResult.rows[0],

      membresias: membresiasResult.rows[0],

      pagos: pagosResult.rows[0],

      reservas: reservasResult.rows[0],

      ingresos_mensuales: ingresosMensualesResult.rows,

      ultimos_pagos: ultimosPagosResult.rows

    }

  } catch (error) {

    await client.query('ROLLBACK')

    throw error

  } finally {

    client.release()

  }

}