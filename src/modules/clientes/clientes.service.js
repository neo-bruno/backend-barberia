const pool = require('../../config/db')

function calcularSegmento(ultimaVisita, referenciaFecha = new Date()) {

  if (!ultimaVisita) {
    return 'nuevos'
  }

  const ultima = new Date(ultimaVisita)
  const referencia = new Date(referenciaFecha)

  // 🔥 USAR UTC PURO
  const ultimaUTC = Date.UTC(
    ultima.getUTCFullYear(),
    ultima.getUTCMonth(),
    ultima.getUTCDate()
  )

  const referenciaUTC = Date.UTC(
    referencia.getUTCFullYear(),
    referencia.getUTCMonth(),
    referencia.getUTCDate()
  )

  const dias = Math.floor(
    (referenciaUTC - ultimaUTC) / (1000 * 60 * 60 * 24)
  )

  if (dias <= 7) return 'frecuentes'
  if (dias <= 14) return 'normales'
  if (dias <= 25) return 'ocasionales'
  if (dias <= 35) return 'riesgo'

  return 'inactivos'
}

exports.getClients = async ({ negocioId }) => {

  const result = await pool.query(
    `
    select * from clientes where negocio_id = $1 order by id desc
    `,
    [negocioId]
  )
  return result.rows
}

exports.getCustomerSummary = async (negocio_id) => {

  const query = `
    SELECT 
      c.id,
      c.nombre,
      c.telefono,

      COUNT(
        CASE 
          WHEN r.estado = 'completada'
          THEN 1
        END
      ) AS visitas,

      MAX(
        CASE
          WHEN r.estado = 'completada'
          THEN r.fecha
        END
      ) AS ultima_visita

    FROM clientes c

    LEFT JOIN reservas r 
      ON r.cliente_id = c.id 
      AND r.negocio_id = $1

    WHERE c.negocio_id = $1

    GROUP BY c.id
  `

  const { rows } = await pool.query(query, [negocio_id])

  const hoy = new Date()

  const clientes = rows.map(c => {

    let dias = null

    if (c.ultima_visita) {
      dias = Math.floor(
        (hoy - new Date(c.ultima_visita))
        / (1000 * 60 * 60 * 24)
      )
    }

    const visitas = Number(c.visitas)

    // 🔥 SEGMENTACIÓN REAL BARBERÍA    
    const segmento = calcularSegmento(c.ultima_visita, new Date())

    return {
      id: c.id,
      nombre: c.nombre,
      telefono: c.telefono,
      visitas,
      ultimaVisita: dias,
      sinHistorial: !c.ultima_visita,
      segmento
    }
  })

  // 🔥 MÉTRICAS
  const recurrentes = clientes.filter(c =>
    ['frecuentes', 'normales'].includes(c.segmento)
  )
  const inactivos = clientes.filter(c =>
    c.segmento === 'inactivos'
  )
  const nuevos = clientes.filter(c =>
    c.segmento === 'nuevos'
  )
  const normales = clientes.filter(c =>
    c.segmento === 'normales'
  )
  const ocasionales = clientes.filter(c =>
    c.segmento === 'ocasionales'
  )
  // 🔥 TOP CLIENTE
  const topCliente = [...clientes].sort((a, b) => b.visitas - a.visitas)[0] || null

  // 🔥 CLIENTES FRECUENTES
  const frecuentes = clientes.filter(c => c.segmento === 'frecuentes').sort((a, b) => b.visitas - a.visitas).slice(0, 5)

  // 🔥 CLIENTES EN RIESGO
  const riesgo = clientes
    .filter(c => ['riesgo', 'inactivos'].includes(c.segmento))
    .map(c => ({
      id: c.id,
      nombre: c.nombre,
      telefono: c.telefono,
      diasSinVenir: c.ultimaVisita,
      segmento: c.segmento
    }))



  return {
    // 🔥 TOTALES
    total: clientes.length,
    totalFrecuentes: frecuentes.length,
    totalNormales: normales.length,
    totalOcacionales: ocasionales.length,
    totalRiesgo: riesgo.length,
    totalInactivos: inactivos.length,
    totalNuevos: nuevos.length,

    // 🔥 ARRAYS
    frecuentes,
    normales,
    ocasionales,
    riesgo,
    inactivos,
    nuevos,

    // 🔥 TOP
    topCliente,

    // 🔥 TODOS
    clientes
  }
}

// solo para publico
exports.createClient = async ({
  nombre,
  telefono,
  slug
}) => {

  // 🔥 1. Buscar negocio por slug
  const negocioResult = await pool.query(
    `
    SELECT id, nombre, slug
    FROM negocios
    WHERE slug = $1
    LIMIT 1
    `,
    [slug]
  )

  if (negocioResult.rows.length === 0) {
    throw new Error('Negocio no encontrado')
  }

  const negocio = negocioResult.rows[0]

  // 🔥 2. Buscar cliente existente
  const clienteExistente = await pool.query(
    `
    SELECT *
    FROM clientes
    WHERE telefono = $1
    AND negocio_id = $2
    LIMIT 1
    `,
    [
      telefono,
      negocio.id
    ]
  )

  // ✅ SI EXISTE → devolver
  if (clienteExistente.rows.length > 0) {

    return {
      status: 200,
      data: clienteExistente.rows[0]
    }
  }

  // 🔥 3. Crear nuevo cliente
  const nuevoCliente = await pool.query(
    `
    INSERT INTO clientes
    (
      negocio_id,
      nombre,
      telefono
    )
    VALUES ($1, $2, $3)
    RETURNING *
    `,
    [
      negocio.id,
      nombre,
      telefono
    ]
  )

  return {
    status: 201,
    data: nuevoCliente.rows[0]
  }
}
exports.getSpaceClient = async (slug, cliente_id) => {

  const client = await pool.connect()

  try {

    await client.query('BEGIN')

    // =========================================================
    // 🔥 1. NEGOCIO
    // =========================================================

    const negocioQuery = `
      SELECT *
      FROM negocios
      WHERE slug = $1
      AND activo = true
      LIMIT 1
    `

    const negocioRes = await client.query(
      negocioQuery,
      [slug]
    )

    if (negocioRes.rows.length === 0) {
      throw {
        status: 404,
        message: 'Negocio no encontrado'
      }
    }

    const negocio = negocioRes.rows[0]

    // =========================================================
    // 🔥 2. CLIENTE
    // =========================================================

    const clienteQuery = `
      SELECT *
      FROM clientes
      WHERE id = $1
      AND negocio_id = $2
      LIMIT 1
    `

    const clienteRes = await client.query(
      clienteQuery,
      [
        cliente_id,
        negocio.id
      ]
    )

    if (clienteRes.rows.length === 0) {
      throw {
        status: 404,
        message: 'Cliente no encontrado'
      }
    }

    const cliente = clienteRes.rows[0]

    // =========================================================
    // 🔥 3. RESERVA ACTUAL
    // =========================================================

    const reservaQuery = `
      SELECT
        r.*,

        s.nombre AS servicio_nombre,
        s.precio,
        s.duracion

      FROM reservas r

      INNER JOIN servicios s
        ON s.id = r.servicio_id

      WHERE r.cliente_id = $1
      AND r.negocio_id = $2

      AND r.estado NOT IN (
        'cancelada',
        'completada',
        'no_asistio'
      )

      ORDER BY
        r.fecha ASC,
        r.hora_inicio ASC      
    `

    const reservaRes = await client.query(
      reservaQuery,
      [
        cliente_id,
        negocio.id
      ]
    )

    const reservas_actuales = reservaRes.rows

    // =========================================================
    // 🔥 4. HISTORIAL
    // =========================================================

    const historialQuery = `
      SELECT
        r.id,
        r.fecha,
        r.hora_inicio,
        r.hora_fin,
        r.estado,

        -- 🔥 servicio
        s.nombre AS servicio_nombre,
        COALESCE(v.monto_original, s.precio) AS precio_servicio,

        -- 🔥 venta real
        v.id AS venta_id,
        v.monto_original,
        v.descuento,
        v.monto AS total_pagado,
        v.metodo_pago,

        -- 🔥 promoción
        p.id AS promocion_id,
        p.tipo AS promocion_tipo,
        p.monto AS promocion_monto,
        p.segmento AS promocion_segmento,
        p.dia AS promocion_dia,

        -- 🔥 helpers frontend
        CASE
          WHEN v.descuento > 0 THEN true
          ELSE false
        END AS tuvo_promocion

      FROM reservas r

      INNER JOIN servicios s
        ON s.id = r.servicio_id

      -- 🔥 venta asociada a la reserva
      LEFT JOIN ventas v
        ON v.reserva_id = r.id

      -- 🔥 promoción usada en la venta
      LEFT JOIN promociones p
        ON p.id = v.promocion_id

      WHERE r.cliente_id = $1
      AND r.negocio_id = $2

      AND r.estado IN (
        'completada',
        'cancelada',
        'no_asistio'
      )

      ORDER BY
        r.fecha DESC,
        r.hora_inicio DESC
    `

    const historialRes = await client.query(
      historialQuery,
      [
        cliente_id,
        negocio.id
      ]
    )

    const historial = historialRes.rows

    // =========================================================
    // 🔥 5. ESTADÍSTICAS
    // =========================================================

    const statsQuery = `
      SELECT
        COUNT(*) FILTER (
          WHERE estado = 'completada'
        )::int AS visitas,

        MAX(fecha) FILTER (
          WHERE estado = 'completada'
        ) AS ultima_visita

      FROM reservas

      WHERE cliente_id = $1
      AND negocio_id = $2
    `

    const statsRes = await client.query(
      statsQuery,
      [
        cliente_id,
        negocio.id
      ]
    )

    const estadisticas = statsRes.rows[0]

    const visitas = Number(
      estadisticas.visitas || 0
    )

    // =========================================================
    // 🔥 6. SEGMENTACIÓN REAL BARBERÍA
    // =========================================================
    const hoy = new Date()
    const fechaReferencia = [
      hoy.getFullYear(),
      String(hoy.getMonth() + 1).padStart(2, '0'),
      String(hoy.getDate()).padStart(2, '0')
    ].join('-')

    const segmento = calcularSegmento(estadisticas.ultima_visita, fechaReferencia)

    let diasSinVisitar = null

    if (estadisticas.ultima_visita) {

      const ultimaFecha = estadisticas.ultima_visita
        .toISOString()
        .split('T')[0]

      const [uy, um, ud] = ultimaFecha
        .split('-')
        .map(Number)

      const [fy, fm, fd] = fechaReferencia
        .split('-')
        .map(Number)

      const fechaUltima = Date.UTC(
        uy,
        um - 1,
        ud
      )

      const fechaActual = Date.UTC(
        fy,
        fm - 1,
        fd
      )

      diasSinVisitar = Math.floor(
        (fechaActual - fechaUltima) /
        (1000 * 60 * 60 * 24)
      )
    }

    // =========================================================
    // 🔥 7. PROMOCIONES DISPONIBLES
    // =========================================================

    const promocionesQuery = `
      SELECT *
      FROM promociones

      WHERE negocio_id = $1
      AND activo = true

      AND (
        LOWER(TRIM(segmento)) = LOWER(TRIM($2))
        OR LOWER(TRIM(segmento)) = 'todos'
      )

      ORDER BY
        CASE
          WHEN LOWER(dia) = 'lunes' THEN 1
          WHEN LOWER(dia) = 'martes' THEN 2
          WHEN LOWER(dia) = 'miercoles' THEN 3
          WHEN LOWER(dia) = 'jueves' THEN 4
          WHEN LOWER(dia) = 'viernes' THEN 5
          WHEN LOWER(dia) = 'sabado' THEN 6
          WHEN LOWER(dia) = 'domingo' THEN 7
          ELSE 8
        END,
        monto DESC
    `

    const promocionesRes = await client.query(promocionesQuery, [negocio.id, segmento])

    const promociones = promocionesRes.rows

    // =========================================================
    // 🔥 8. PROMOCIÓN DE RESERVA ACTUAL
    // =========================================================

    for (const reserva of reservas_actuales) {

      const diasSemana = {
        0: 'domingo',
        1: 'lunes',
        2: 'martes',
        3: 'miercoles',
        4: 'jueves',
        5: 'viernes',
        6: 'sabado'
      }

      let fechaReserva

      if (typeof reserva.fecha === 'string') {

        const [year, month, day] = reserva.fecha
          .split('-')
          .map(Number)

        fechaReserva = new Date(
          year,
          month - 1,
          day
        )

      } else if (reserva.fecha instanceof Date) {

        fechaReserva = new Date(
          reserva.fecha.getFullYear(),
          reserva.fecha.getMonth(),
          reserva.fecha.getDate()
        )

      } else {

        throw new Error('Fecha inválida en reserva')
      }

      const diaReserva = diasSemana[
        fechaReserva.getDay()
      ]

      const promoReservaQuery = `
        SELECT *
        FROM promociones

        WHERE negocio_id = $1
        AND activo = true

        AND (
          LOWER(TRIM(segmento)) = LOWER(TRIM($2))
          OR LOWER(TRIM(segmento)) = 'todos'
        )

        AND (
          LOWER(TRIM(dia)) = LOWER(TRIM($3))
          OR dia IS NULL
        )

        ORDER BY monto DESC

        LIMIT 1
      `

      const promoReservaRes = await client.query(
        promoReservaQuery,
        [
          negocio.id,
          segmento,
          diaReserva
        ]
      )
      reserva.promocion = promoReservaRes.rows[0] || null
      console.log(
  promoReservaRes.rows
)
      console.log({
  segmento,
  diaReserva
})
    }

    // =========================================================
    // 🔥 COMMIT
    // =========================================================

    await client.query('COMMIT')

    return {
      cliente,
      reservas_actuales,
      promociones,
      historial,
      estadisticas: {
        visitas,
        ultima_visita: estadisticas.ultima_visita,
        diasSinVisitar
      },
      segmento
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
exports.getClientPublic = async (slug, telefono) => {

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    // =====================================
    // 🔥 1. BUSCAR NEGOCIO
    // =====================================
    const negocioQuery = `
      SELECT *
      FROM negocios
      WHERE slug = $1
      AND activo = true
      LIMIT 1
    `
    const negocioRes = await client.query(negocioQuery, [slug])

    if (negocioRes.rows.length === 0) {
      throw {
        status: 404,
        message: 'Negocio no encontrado'
      }
    }
    const negocio = negocioRes.rows[0]
    // =====================================
    // 🔥 2. BUSCAR CLIENTE
    // =====================================
    const clienteQuery = `
      SELECT *
      FROM clientes

      WHERE negocio_id = $1
      AND telefono = $2

      LIMIT 1
    `
    const clienteRes = await client.query(clienteQuery, [negocio.id, telefono])
    if (clienteRes.rows.length === 0) {
      throw {
        status: 404,
        message: 'Cliente no encontrado'
      }
    }
    await client.query('COMMIT')
    return clienteRes.rows[0]

  } catch (error) {
    await client.query('ROLLBACK')
    throw error

  } finally {
    client.release()
  }
}