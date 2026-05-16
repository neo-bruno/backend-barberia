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

  console.log({
    ultimaVisita,
    referenciaFecha,
    dias
  })

  if (dias <= 7) return 'frecuentes'
  if (dias <= 14) return 'normales'
  if (dias <= 25) return 'ocasionales'
  if (dias <= 35) return 'riesgo'

  return 'inactivos'
}

// 🔹 CREAR PROMO
exports.createPromotion = async (promo, negocio_id) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const query = `
      INSERT INTO promociones (
        negocio_id,
        tipo,
        monto,
        dia,
        segmento
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const values = [
      negocio_id,
      promo.tipo,
      promo.monto,
      promo.dia,
      promo.segmento
    ];

    const { rows } = await client.query(query, values);

    await client.query('COMMIT');

    return rows[0];

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// 🔹 LISTAR PROMOS
exports.getPromotions = async (negocio_id) => {
  const query = `
    SELECT id, tipo, monto, dia, segmento, activo
    FROM promociones
    WHERE negocio_id = $1
    ORDER BY id DESC
  `;

  const { rows } = await pool.query(query, [negocio_id]);

  return rows;
};

// 🔹 ELIMINAR
exports.deletePromotion = async (id, negocio_id) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      `DELETE FROM promociones WHERE id = $1 AND negocio_id = $2`,
      [id, negocio_id]
    );

    await client.query('COMMIT');

    return true;

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

exports.getSuggestions = async (negocio_id) => {

  // 🔥 1. Día más flojo (menos reservas)
  const diasQuery = `
    SELECT 
      EXTRACT(DOW FROM fecha) AS dia,
      COUNT(*) as total
    FROM reservas
    WHERE negocio_id = $1
    GROUP BY dia
    ORDER BY total ASC
    LIMIT 1
  `;

  const diasRes = await pool.query(diasQuery, [negocio_id]);

  const diasMap = [
    'Domingo', 'Lunes', 'Martes', 'Miercoles',
    'Jueves', 'Viernes', 'Sábado'
  ];

  const diaFlojo = diasRes.rows[0]
    ? diasMap[diasRes.rows[0].dia]
    : 'Martes'; // fallback razonable

  // 🔥 2. Armar sugerencias dinámicas
  return [
    {
      id: 1,
      titulo: "Reactivar clientes",
      descripcion: `Descuento -5 Bs a clientes inactivos en ${diaFlojo}`,
      data: {
        tipo: "Descuento",
        monto: 5,
        dia: diaFlojo,
        segmento: "Inactivos"
      }
    },
    {
      id: 2,
      titulo: "Llenar día flojo",
      descripcion: `Promo general para aumentar flujo en ${diaFlojo}`,
      data: {
        tipo: "Descuento",
        monto: 5,
        dia: diaFlojo,
        segmento: "Todos"
      }
    },
    {
      id: 3,
      titulo: "Premiar fieles",
      descripcion: "Clientes frecuentes con descuento especial",
      data: {
        tipo: "Descuento",
        monto: 7,
        dia: diaFlojo,
        segmento: "Frecuentes"
      }
    }
  ];
};

// promociones.service.js
exports.getApplicablePromotion = async ({
  cliente_id,
  negocio_id,
  fecha
}) => {

  const client = await pool.connect();

  try {

    await client.query('BEGIN');

    // =====================================================
    // 🔥 1. NORMALIZAR FECHA
    // =====================================================

    let fechaString;
    let fechaLocal;

    if (typeof fecha === 'string') {

      fechaString = fecha;

      const [year, month, day] = fecha
        .split('-')
        .map(Number);

      fechaLocal = new Date(year, month - 1, day);

    } else if (fecha instanceof Date) {

      const year = fecha.getFullYear();
      const month = String(
        fecha.getMonth() + 1
      ).padStart(2, '0');

      const day = String(
        fecha.getDate()
      ).padStart(2, '0');

      fechaString = `${year}-${month}-${day}`;

      fechaLocal = new Date(
        year,
        fecha.getMonth(),
        fecha.getDate()
      );

    } else {

      throw {
        status: 400,
        message: 'Formato de fecha inválido'
      };
    }

    // =====================================================
    // 🔥 2. STATS CLIENTE
    // =====================================================

    const statsQuery = `
      SELECT 
        COUNT(r.id)::int as visitas,
        MAX(r.fecha) as ultima_visita

      FROM reservas r

      WHERE r.cliente_id = $1
      AND r.negocio_id = $2
      AND r.estado = 'completada'
    `;

    const statsRes = await client.query(
      statsQuery,
      [cliente_id, negocio_id]
    );

    const stats = statsRes.rows[0];

    const visitas = Number(stats.visitas || 0);
    const ultima = stats.ultima_visita;

    // =====================================================
    // 🔥 3. DIAS SIN VISITAR
    // =====================================================

    let diasSinVisitar = 999;

    if (ultima) {

      const ultimaFecha = ultima
        .toISOString()
        .split('T')[0];

      const [uy, um, ud] = ultimaFecha
        .split('-')
        .map(Number);

      const [fy, fm, fd] = fechaString
        .split('-')
        .map(Number);

      const fechaUltima = Date.UTC(
        uy,
        um - 1,
        ud
      );

      const fechaActual = Date.UTC(
        fy,
        fm - 1,
        fd
      );

      diasSinVisitar = Math.floor(
        (fechaActual - fechaUltima) /
        (1000 * 60 * 60 * 24)
      );
    }

    // =====================================================
    // 🔥 4. SEGMENTO CLIENTE
    // =====================================================

    const segmentoCliente = calcularSegmento(
      ultima,
      fechaString
    );

    // =====================================================
    // 🔥 5. DIA SEMANA
    // =====================================================

    const diasSemana = [
      'domingo',
      'lunes',
      'martes',
      'miercoles',
      'jueves',
      'viernes',
      'sabado'
    ];

    const dia = diasSemana[
      fechaLocal.getDay()
    ];

    console.log({
      dia,
      segmentoCliente,
      diasSinVisitar
    });

    // =====================================================
    // 🔥 6. PROMOS VALIDAS
    // =====================================================

    const promosQuery = `
      SELECT *
      FROM promociones

      WHERE negocio_id = $1

      AND activo = true

      AND LOWER(TRIM(dia)) =
          LOWER(TRIM($2))

      AND (
        LOWER(TRIM(segmento)) =
        LOWER(TRIM($3))

        OR LOWER(TRIM(segmento)) =
        'todos'
      )
    `;

    const promosRes = await client.query(
      promosQuery,
      [
        negocio_id,
        dia,
        segmentoCliente
      ]
    );

    const promos = promosRes.rows;

    console.log(promos);

    // =====================================================
    // 🔥 7. MEJOR PROMO
    // =====================================================

    let mejorPromo = null;

    promos.forEach(promo => {

      if (
        !mejorPromo ||
        Number(promo.monto) >
        Number(mejorPromo.monto)
      ) {
        mejorPromo = promo;
      }
    });

    // =====================================================
    // 🔥 COMMIT
    // =====================================================

    await client.query('COMMIT');

    // =====================================================
    // 🔥 RESPUESTA
    // =====================================================

    return {

      aplica: !!mejorPromo,

      descuento: mejorPromo
        ? Number(mejorPromo.monto)
        : 0,

      promo: mejorPromo || null,

      meta: {
        visitas,
        diasSinVisitar,
        segmentoCliente,
        dia
      }
    };

  } catch (error) {

    await client.query('ROLLBACK');
    throw error;

  } finally {

    client.release();
  }
};

exports.changeStatePromotion = async (
  id,
  negocio_id,
  activo
) => {

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 🔹 validar existencia
    const check = await client.query(`
      SELECT id
      FROM promociones
      WHERE id = $1
      AND negocio_id = $2
    `, [id, negocio_id]);

    if (check.rows.length === 0) {
      throw new Error('Promoción no encontrada');
    }

    // 🔹 actualizar estado
    const result = await client.query(`
      UPDATE promociones
      SET activo = $1
      WHERE id = $2
      AND negocio_id = $3
      RETURNING *
    `, [activo, id, negocio_id]);

    await client.query('COMMIT');

    return result.rows[0];

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

exports.getPromotionClient = async (
  negocio_id,
  cliente_id,
  servicio_id,
  fecha
) => {

  const client = await pool.connect()

  try {

    await client.query('BEGIN')

    // 🔥 1. OBTENER SERVICIO
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

    const servicio = servicioRes.rows[0]

    // 🔥 2. STATS CLIENTE + VISITAS
    const statsQuery = `
      SELECT 
        COUNT(r.id) as visitas,
        MAX(r.fecha) as ultima_visita
      FROM reservas r
      WHERE r.cliente_id = $1
      AND r.negocio_id = $2
      AND r.estado = 'completada'
    `

    const statsRes = await client.query(statsQuery, [cliente_id, negocio_id])

    const stats = statsRes.rows[0]

    const visitas = Number(stats.visitas || 0)
    const ultima = stats.ultima_visita

    // 🔥 3. HISTORIAL DE VISITAS (NUEVO)
    const historialQuery = `
      SELECT 
        r.id,
        r.fecha,
        s.precio,
        r.hora_inicio,
        r.hora_fin,
        s.nombre AS servicio_nombre
      FROM reservas r
      JOIN servicios s ON s.id = r.servicio_id
      WHERE r.cliente_id = $1
      AND r.negocio_id = $2
      AND r.estado = 'completada'
      ORDER BY r.fecha DESC
      LIMIT 20
    `

    const historialRes = await client.query(
      historialQuery,
      [cliente_id, negocio_id]
    )

    const historial = historialRes.rows

    // 🔥 4. SEGMENTACIÓN REAL BARBERÍA    
    let diasSinVisitar = null
    const segmentoCliente = calcularSegmento(ultima, new Date(fecha))

    console.log({ ultima, fecha, segmentoCliente })
    // 🔥 5. FECHA LOCAL
    let fechaLocal

    if (typeof fecha === 'string') {

      const [y, m, d] = fecha.split('-').map(Number)

      fechaLocal = new Date(y, m - 1, d)

    } else {
      throw {
        status: 400,
        message: 'Formato de fecha inválido'
      }
    }

    const diasSemana = [
      'domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'
    ]

    const dia = diasSemana[fechaLocal.getDay()]

    // 🔥 6. PROMOS
    const promosQuery = `
      SELECT *
      FROM promociones
      WHERE negocio_id = $1
      AND activo = true
      AND (
        LOWER(dia) = LOWER($2)
        OR dia IS NULL
      )
      AND (
        LOWER(TRIM(segmento)) = LOWER(TRIM($3))
        OR LOWER(TRIM(segmento)) = 'todos'
      )
    `

    const promosRes = await client.query(
      promosQuery,
      [negocio_id, dia, segmentoCliente]
    )

    const promos = promosRes.rows
    console.log(promos)
    // 🔥 7. MEJOR PROMO
    let mejorPromo = null

    promos.forEach(promo => {
      if (!mejorPromo || Number(promo.monto) > Number(mejorPromo.monto)) {
        mejorPromo = promo
      }
    })

    // 🔥 8. PRECIO FINAL
    let precioFinal = parseFloat(servicio.precio)
    let descuento = 0

    if (mejorPromo) {
      descuento = parseFloat(mejorPromo.monto)
      precioFinal = precioFinal - descuento
      if (precioFinal < 0) precioFinal = 0
    }

    await client.query('COMMIT')

    // 🔥 9. RESPUESTA FINAL (YA INCLUYE HISTORIAL)
    return {
      aplica: !!mejorPromo,
      precio_original: parseFloat(servicio.precio),
      descuento: Number(descuento.toFixed(2)),
      precio_final: Number(precioFinal.toFixed(2)),
      promocion: mejorPromo,

      historial, // 🔥 AQUÍ ESTÁ LO NUEVO

      estadisticas: {
        visitas,
        diasSinVisitar,
        ultimaVisita: ultima
      },

      segmento: segmentoCliente,

      meta: {
        visitas,
        diasSinVisitar,
        segmentoCliente,
        dia
      }
    }

  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}