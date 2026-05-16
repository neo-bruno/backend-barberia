const pool = require('../../config/db')

// 🔹 CREAR MEMBRESIA
exports.create = async (data, user) => {

  const {
    usuario_id,
    fecha_inicio,
    meses,
    precio_mensual
  } = data

  const total = meses * precio_mensual
  const saldo = total

  const res = await pool.query(`
  INSERT INTO membresias
  (usuario_id, negocio_id, fecha_inicio, fecha_fin, meses, precio_mensual, total, saldo)
  VALUES (
    $1,
    $2,
    $3,
    $3 + ($5 || ' months')::interval - interval '1 day',
    $5,
    $6,
    $7,
    $8
  )
  RETURNING *
`, [
    usuario_id,
    user.negocio_id,
    fecha_inicio,
    meses,
    precio_mensual,
    total,
    saldo
  ])

  return res.rows[0]
}

// 🔹 LISTAR
exports.list = async () => {
  const res = await pool.query(`
    SELECT
      m.id,

      -- =========================
      -- USUARIO
      -- =========================
      u.id AS usuario_id,
      u.nombre AS usuario_nombre,
      u.telefono AS usuario_telefono,
      u.email AS usuario_email,
      u.activo AS usuario_activo,

      -- =========================
      -- NEGOCIO
      -- =========================
      n.id AS negocio_id,
      n.nombre AS negocio_nombre,
      n.telefono AS negocio_telefono,
      n.ciudad AS negocio_ciudad,
      n.activo AS negocio_activo,

      -- =========================
      -- MEMBRESÍA
      -- =========================
      m.fecha_inicio,
      m.fecha_fin,
      m.meses,

      m.precio_mensual::int AS importe,

      m.total::int,
      m.saldo::int,

      m.estado,

      -- =========================
      -- DÍAS RESTANTES
      -- =========================
      (
        m.fecha_fin - CURRENT_DATE
      ) AS dias_restantes

    FROM membresias m
    JOIN usuarios u
      ON u.id = m.usuario_id
    JOIN negocios n
      ON n.id = m.negocio_id
    ORDER BY m.created_at DESC;
  `)

  return res.rows
}

// 🔹 DETALLE
exports.getById = async (id) => {

  // =========================
  // MEMBRESIA + USUARIO + NEGOCIO
  // =========================
  const res = await pool.query(`

  SELECT 

    -- NEGOCIO
    n.id as negocio_id,
    n.nombre as negocio_nombre,
    n.slug,
    n.telefono as negocio_telefono,
    n.direccion,

    -- USUARIO
    u.id as usuario_id,
    u.nombre as usuario_nombre,
    u.telefono as usuario_telefono,
    u.email,

    -- MEMBRESIA
    m.id as membresia_id,
    m.fecha_inicio,
    m.fecha_fin,
    m.meses,
    m.precio_mensual::int,
    m.total::int,
    m.saldo::int,
    m.estado,

    -- PAGOS
    p.id as pago_id,
    p.monto::int,
    p.metodo_pago,
    p.created_at as fecha_pago

  FROM membresias m

  JOIN usuarios u
    ON u.id = m.usuario_id

  LEFT JOIN negocios n
    ON n.id = m.negocio_id

  LEFT JOIN pagos p
    ON p.membresia_id = m.id

  WHERE m.id = $1

  ORDER BY p.created_at DESC

`, [id])

  const data = res.rows[0]

  if (!data) return null

  // =========================
  // PAGOS
  // =========================

  const pagosRes = await pool.query(`
    SELECT
      id,
      monto::int,
      metodo_pago,
      fecha_pago
    FROM pagos
    WHERE membresia_id = $1
    ORDER BY created_at DESC
  `, [id])

  // =========================
  // RESPONSE
  // =========================

  return {
    negocio: {
      id: data.negocio_id,
      nombre: data.negocio_nombre || '',
      slug: data.slug || '',
      telefono: data.negocio_telefono || '',
      direccion: data.direccion || ''
    },
    usuario: {
      id: data.usuario_id,
      nombre: data.usuario_nombre || '',
      telefono: data.usuario_telefono || '',
      email: data.email || '',
      password: ''
    },
    membresia: {
      id: data.membresia_id,
      fecha_inicio: data.fecha_inicio || '',
      meses: data.meses || 1,
      precio_mensual: data.precio_mensual || 0
    },
    pagos: pagosRes.rows || []
  }
}

// 🔹 ACTUALIZAR
exports.update = async (id, data) => {

  const { meses, precio_mensual, estado } = data

  const total = meses * precio_mensual

  await pool.query(`
    UPDATE membresias
    SET meses=$1, precio_mensual=$2, total=$3, estado=$4
    WHERE id=$5
  `, [meses, precio_mensual, total, estado, id])

  return { ok: true }
}

// 🔹 PAGAR
exports.addPago = async (membresia_id, monto) => {

  // 1. guardar pago
  await pool.query(`
    INSERT INTO pagos (membresia_id, monto)
    VALUES ($1,$2)
  `, [membresia_id, monto])

  // 2. actualizar saldo
  await pool.query(`
    UPDATE membresias
    SET saldo = saldo - $1
    WHERE id = $2
  `, [monto, membresia_id])

  return { ok: true }
}

exports.suspender = async (membresia_id) => {
  
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // =====================================================
    // BUSCAR MEMBRESÍA
    // =====================================================
    const membresiaQuery = `
      SELECT *
      FROM membresias
      WHERE id = $1
    `
    const membresiaResult = await client.query( membresiaQuery, [membresia_id])

    if (membresiaResult.rows.length === 0) {
      throw new Error('La membresía no existe')
    }

    const membresia = membresiaResult.rows[0]

    // =====================================================
    // SUSPENDER MEMBRESÍA
    // =====================================================
    const suspendMembershipQuery = `
      UPDATE membresias
      SET estado = 'suspendido'
      WHERE id = $1
    `
    await client.query( suspendMembershipQuery, [membresia_id])

    // =====================================================
    // DESACTIVAR NEGOCIO
    // =====================================================
    const disableBusinessQuery = `
      UPDATE negocios
      SET activo = false
      WHERE id = $1
    `
    await client.query( disableBusinessQuery, [membresia.negocio_id])

    // =====================================================
    // DESACTIVAR USUARIOS
    // =====================================================
    const disableUsersQuery = `
      UPDATE usuarios
      SET activo = false
      WHERE negocio_id = $1
      AND rol != 'superadmin'
    `
    await client.query( disableUsersQuery,[membresia.negocio_id])
    await client.query('COMMIT')
    return true

  } catch (error) {
    await client.query('ROLLBACK')
    throw error

  } finally {
    client.release()
  }
}

exports.reactivar = async (membresia_id) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // =====================================================
    // BUSCAR MEMBRESÍA
    // =====================================================

    const membresiaQuery = `
      SELECT *
      FROM membresias
      WHERE id = $1
    `

    const membresiaResult = await client.query(
      membresiaQuery,
      [membresia_id]
    )

    if (membresiaResult.rows.length === 0) {
      throw new Error('La membresía no existe')
    }

    const membresia = membresiaResult.rows[0]

    // =====================================================
    // REACTIVAR MEMBRESÍA
    // =====================================================

    const reactivateMembershipQuery = `
      UPDATE membresias
      SET estado = 'activo'
      WHERE id = $1
    `

    await client.query(
      reactivateMembershipQuery,
      [membresia_id]
    )

    // =====================================================
    // ACTIVAR NEGOCIO
    // =====================================================

    const activateBusinessQuery = `
      UPDATE negocios
      SET activo = true
      WHERE id = $1
    `

    await client.query(
      activateBusinessQuery,
      [membresia.negocio_id]
    )

    // =====================================================
    // ACTIVAR USUARIOS
    // =====================================================

    const activateUsersQuery = `
      UPDATE usuarios
      SET activo = true
      WHERE negocio_id = $1
      AND rol != 'superadmin'
    `
    await client.query(
      activateUsersQuery,
      [membresia.negocio_id]
    )
    await client.query('COMMIT')
    return true

  } catch (error) {
    await client.query('ROLLBACK')
    throw error

  } finally {
    client.release()
  }
}