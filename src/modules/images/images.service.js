// uploads.service.js
const pool = require('../../config/db'); // <- ajusta tu ruta
exports.updateLogo = async (
  negocio_id,
  logo
) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // =====================================================
    // 🔥 UPDATE LOGO
    // =====================================================
    const query = `
      UPDATE negocios
      SET logo_url = $1
      WHERE id = $2
    `;

    await client.query(
      query,
      [logo, negocio_id]
    );

    // =====================================================
    // 🔥 COMMIT
    // =====================================================
    await client.query('COMMIT');
    return true;

  } catch (error) {
    await client.query('ROLLBACK');
    console.error(
      'ERROR UPDATE LOGO:',
      error
    );
    throw error;

  } finally {
    client.release();
  }
};

exports.updatePortada = async ( negocio_id, portada_url ) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const query = `
      UPDATE negocios
      SET portada_url = $1
      WHERE id = $2
    `;
    await client.query( query, [portada_url, negocio_id]);
    await client.query('COMMIT');

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;

  } finally {
    client.release();
  }
};

exports.updateGaleria = async (id, negocio_id, imagen_url) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const query = `
      UPDATE galeria
      SET imagen_url = $1
      WHERE id = $2 AND negocio_id = $3
      RETURNING *
    `;

    const result = await client.query(query, [
      imagen_url,
      id,
      negocio_id
    ]);

    await client.query('COMMIT');

    return result.rows[0];

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;

  } finally {
    client.release();
  }
};