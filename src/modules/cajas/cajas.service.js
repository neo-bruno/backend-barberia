const pool = require('../../config/db')

exports.getCashBoxToday = async (negocio_id) => {
  const client = await pool.connect();

  try {
    const result = await client.query(
      `
      SELECT *
      FROM cajas
      WHERE negocio_id = $1
      AND fecha = CURRENT_DATE
      LIMIT 1
      `,
      [negocio_id]
    );

    return result.rows[0];

  } finally {
    client.release();
  }
};

exports.getTotalVentasHoy = async (negocio_id) => {
  const result = await pool.query(
    `
    SELECT COALESCE(SUM(monto), 0) AS total
    FROM ventas
    WHERE negocio_id = $1
    AND DATE(created_at) = CURRENT_DATE
    `,
    [negocio_id]
  );

  return result.rows[0].total;
}
// 🟢 crear caja
exports.createCashBox = async ({
  negocio_id,
  usuario_id,
  monto_inicial
}) => {

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `
      INSERT INTO cajas (
        negocio_id,
        fecha,
        monto_inicial,
        usuario_apertura,
        fecha_apertura,
        cerrado
      )
      VALUES ($1, CURRENT_DATE, $2, $3, NOW(), false)
      RETURNING *
      `,
      [negocio_id, monto_inicial, usuario_id]
    );

    await client.query('COMMIT');

    return result.rows[0];

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;

  } finally {
    client.release();
  }
}
// 🔴 cerrar caja
exports.closeCashBox = async ({ negocio_id, usuario_id }) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 💰 calcular total real
    const total = await exports.getTotalVentasHoy(negocio_id);

    // 🔴 actualizar caja
    const result = await client.query(
      `
      UPDATE cajas
      SET 
        cerrado = true,
        fecha_cierre = NOW(),
        usuario_cierre = $2,
        total = $3
      WHERE negocio_id = $1
      AND fecha = CURRENT_DATE
      RETURNING *
      `,
      [negocio_id, usuario_id, total]
    );

    await client.query('COMMIT');

    return result.rows[0];

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;

  } finally {
    client.release();
  }
};