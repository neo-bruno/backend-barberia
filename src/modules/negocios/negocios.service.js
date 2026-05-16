const pool = require('../../config/db')

exports.getBusiness = async (negocio_id) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // =====================================================
    // 🔥 NEGOCIO
    // =====================================================
    const negocioQuery = `
      SELECT id, nombre, slug, telefono, descripcion, descripcion_larga, logo_url, portada_url, direccion, ciudad, horario_texto, instagram_url, facebook_url, activo, created_at
	    FROM negocios
      WHERE id = $1
      LIMIT 1
    `;
    const negocioResult = await client.query(
      negocioQuery,
      [negocio_id]
    );

    const negocio = negocioResult.rows[0];

    // =====================================================
    // 🔥 VALIDACION
    // =====================================================

    if (!negocio) {
      await client.query('ROLLBACK');
      return null;
    }

    // =====================================================
    // 🔥 GALERIA
    // =====================================================
    const galeriaQuery = `
      SELECT id, negocio_id, imagen_url, descripcion, created_at
	    FROM galeria
      WHERE negocio_id = $1
      ORDER BY id DESC
    `;
    const galeriaResult = await client.query(
      galeriaQuery,
      [negocio_id]
    );

    negocio.galeria = galeriaResult.rows;

    // =====================================================
    // 🔥 COMMIT
    // =====================================================
    await client.query('COMMIT');
    return negocio;

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('ERROR GET BUSINESS:', error);
    throw error;

  } finally {
    client.release();
  }
};

exports.modifyBusiness = async ( negocio_id, data ) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // =========================================
    // NEGOCIO
    // =========================================
    const negocioQuery = `

      UPDATE negocios
      SET
        nombre = $1,
        telefono = $2,
        descripcion = $3,
        direccion = $4,
        ciudad = $5,
        horario_texto = $6,
        instagram_url = $7,
        facebook_url = $8
      WHERE id = $9

    `;

    await client.query(
      negocioQuery,
      [
        data.nombre,
        data.telefono,
        data.descripcion,
        data.direccion,
        data.ciudad,
        data.horario_texto,
        data.instagram_url,
        data.facebook_url,
        negocio_id
      ]
    );

    // =========================================
    // GALERIA
    // =========================================

    if (data.galeria?.length) {
      for (const item of data.galeria) {
        const galeriaQuery = `
          UPDATE galeria
          SET descripcion = $1
          WHERE id = $2
          AND negocio_id = $3
        `;
        await client.query( galeriaQuery, [ item.descripcion, item.id, negocio_id]

        );
      }
    }
    await client.query('COMMIT');

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;

  } finally {
    client.release();
  }
};