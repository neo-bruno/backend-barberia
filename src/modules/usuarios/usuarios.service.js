const pool = require('../../config/db')

// 🔹 LISTAR
exports.list = async (user) => {

  let query = `
    SELECT id, nombre, telefono, email, rol, activo, created_at
    FROM usuarios
  `
  let params = []

  // 🔥 multi negocio, aqui el peluquero con rol admin, puede ver solo los usuarios de su negocio. genial!!!
  if (user.rol !== 'superadmin') {
    query += ` WHERE negocio_id = $1`
    params.push(user.negocio_id)
  }

  query += ` ORDER BY created_at DESC`

  const res = await pool.query(query, params)
  return res.rows
}

// 🔹 DETALLE
exports.getById = async (id, user) => {

  let query = `
    SELECT id, nombre, telefono, email, rol, activo
    FROM usuarios
    WHERE id = $1
  `
  let params = [id]

  // solo el admin, peluquero puede ver al usuario especifico que pertenezca a su negocio.
  if (user.rol !== 'superadmin') {
    query += ` AND negocio_id = $2`
    params.push(user.negocio_id)
  }

  const res = await pool.query(query, params)

  if (!res.rows.length) {
    throw new Error('Usuario no encontrado')
  }

  return res.rows[0]
}

// 🔹 ACTUALIZAR
exports.update = async (id, data, user) => {

  const { nombre, telefono, rol } = data

  try {
    let query = `
      UPDATE usuarios
      SET nombre = $1, telefono = $2, rol = $3
      WHERE id = $4
    `
    let params = [nombre, telefono, rol, id]

    if (user.rol !== 'superadmin') {
      query += ` AND negocio_id = $5`
      params.push(user.negocio_id)
    }

    const res = await pool.query(query, params)

    if (res.rowCount === 0) {
      throw new Error('No se pudo actualizar')
    }

    return { ok: true }

  } catch (e) {

    if (e.code === '23505') {
      throw new Error('Teléfono duplicado')
    }

    throw e
  }
}

// 🔹 ACTIVAR / DESACTIVAR
exports.toggleActivo = async (id, user) => {

  let query = `
    UPDATE usuarios
    SET activo = NOT activo
    WHERE id = $1
    RETURNING activo
  `
  let params = [id]

  // solo el peluquero puede activar o desactivar a sus usuarios de su negocio
  if (user.rol !== 'superadmin') {
    query += ` AND negocio_id = $2`
    params.push(user.negocio_id)
  }

  const res = await pool.query(query, params)

  if (!res.rows.length) {
    throw new Error('Usuario no encontrado')
  }

  return res.rows[0]
}