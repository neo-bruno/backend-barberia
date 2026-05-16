const db = require('../../config/db')


exports.createService = async (data) => {

  const existe = await db.query(`
   SELECT id
   FROM servicios
   WHERE negocio_id=$1
   AND lower(nombre)=lower($2)
 `, [data.negocio_id, data.nombre])

  if (existe.rows.length) {
    throw {
      status: 400,
      message: 'Ese servicio ya existe'
    }
  }
  const result = await db.query(`
    INSERT INTO servicios
    (
      negocio_id,
      nombre,
      duracion,
      precio,
      activo
    )
    VALUES($1,$2,$3,$4,true)
    RETURNING *
 `, [
    data.negocio_id,
    data.nombre,
    data.duracion,
    data.precio
  ])
  return result.rows[0]
}

exports.updateService = async (id, negocioId, data) => {

  const result = await db.query(`
    UPDATE servicios
    SET nombre=$1, duracion=$2, precio=$3, activo=$4, updated_at=now()
    WHERE id=$5 AND negocio_id=$6 RETURNING *
  `, [
    data.nombre,
    data.duracion,
    data.precio,
    data.activo,
    id,
    negocioId
  ])

  if (!result.rows.length) {
    throw {
      status: 404,
      message: 'Servicio no encontrado'
    }
  }
  return result.rows[0]
}

exports.getServices = async (negocioId) => {

  const result = await db.query(`
    SELECT id, nombre, duracion, precio, activo
    FROM servicios
    WHERE negocio_id=$1
    ORDER BY nombre
  `, [negocioId])

  return result.rows
}

exports.changeStatus = async (id, negocioId, activo ) => {

  const result = await db.query(`
    UPDATE servicios
    SET activo=$1
    WHERE id=$2
    AND negocio_id=$3
    RETURNING *
  `, [activo, id, negocioId])

  return result.rows[0]
}

// solo para publico
exports.getServicesBySlug = async (slug) => {
  try {
    // 🔹 1. NEGOCIO + SERVICIOS
    const result = await db.query(
      `
      SELECT 
        n.id AS negocio_id,
        n.nombre,
        n.slug,
        n.descripcion,
        n.descripcion_larga,
        n.telefono,
        n.logo_url,
        n.portada_url,
        n.direccion,
        n.ciudad,
        n.horario_texto,
        n.instagram_url,
        n.facebook_url,

        s.id AS servicio_id,
        s.nombre AS servicio_nombre,
        s.precio,
        s.duracion

      FROM negocios n
      LEFT JOIN servicios s 
        ON s.negocio_id = n.id 
        AND s.activo = true

      WHERE n.slug = $1
      AND n.activo = true
      `,
      [slug]
    )

    if (result.rows.length === 0) {
      throw {
        status: 404,
        message: 'Negocio no encontrado'
      }
    }

    const negocioId = result.rows[0].negocio_id

    // 🔹 2. ARMAR NEGOCIO
    const negocio = {
      id: negocioId,
      nombre: result.rows[0].nombre,
      slug: result.rows[0].slug,
      descripcion: result.rows[0].descripcion,
      descripcion_larga: result.rows[0].descripcion_larga,
      telefono: result.rows[0].telefono,
      logo_url: result.rows[0].logo_url,
      portada_url: result.rows[0].portada_url,
      direccion: result.rows[0].direccion,
      ciudad: result.rows[0].ciudad,
      horario_texto: result.rows[0].horario_texto,
      instagram_url: result.rows[0].instagram_url,
      facebook_url: result.rows[0].facebook_url
    }

    // 🔹 3. SERVICIOS
    const servicios = result.rows
      .filter(r => r.servicio_id !== null)
      .map(r => ({
        id: r.servicio_id,
        nombre: r.servicio_nombre,
        precio: r.precio,
        duracion: r.duracion
      }))

    // 🔥 4. GALERÍA (CLAVE)
    const galeriaResult = await db.query(
      `
      SELECT 
        id,
        imagen_url,
        descripcion
      FROM galeria
      WHERE negocio_id = $1
      ORDER BY id DESC
      `,
      [negocioId]
    )

    const galeria = galeriaResult.rows

    // 🔥 5. RESPUESTA FINAL
    return {
      negocio,
      servicios,
      galeria
    }

  } catch (error) {
    throw error
  }
}