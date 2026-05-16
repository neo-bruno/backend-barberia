const pool = require('../../config/db')

exports.createNewPay = async (body) => {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    const { membresia_id, monto, metodo_pago, usuario_id } = body

    // =====================================================
    // BUSCAR MEMBRESÍA
    // =====================================================
    const membresiaQuery = `
      SELECT *
      FROM membresias
      WHERE id = $1
      FOR UPDATE
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
    // VALIDAR SALDO
    // =====================================================

    if (Number(monto) > Number(membresia.saldo)) {
      throw new Error(
        `El monto excede el saldo pendiente (${membresia.saldo})`
      )
    }
    // =====================================================
    // INSERTAR PAGO
    // =====================================================
    const insertPagoQuery = `
      INSERT INTO pagos (
        membresia_id,
        usuario_id,
        monto,
        metodo_pago
      )
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `

    const pagoResult = await client.query(
      insertPagoQuery,
      [
        membresia_id,
        usuario_id,
        monto,
        metodo_pago
      ]
    )
    // =====================================================
    // NUEVO SALDO
    // =====================================================
    const nuevoSaldo = Number(membresia.saldo) - Number(monto)

    // =====================================================
    // ACTUALIZAR MEMBRESÍA
    // =====================================================
    const updateMembresiaQuery = `
      UPDATE membresias
      SET saldo = $1
      WHERE id = $2
      RETURNING *
    `
    const membresiaActualizada = await client.query(updateMembresiaQuery, [nuevoSaldo, membresia_id])

    await client.query('COMMIT')
    return {
      pago: pagoResult.rows[0],
      membresia: membresiaActualizada.rows[0]
    }

  } catch (error) {
    await client.query('ROLLBACK')
    throw error

  } finally {
    client.release()
  }
}

exports.getPays = async (membresia_id) => {
  const client = await pool.connect()
  try {
    const query = `
      SELECT
        p.id,
        p.monto,
        p.metodo_pago,
        p.fecha_pago,
        p.observaciones,
        p.created_at,

        u.nombre AS usuario_nombre

      FROM pagos p
      LEFT JOIN usuarios u
        ON u.id = p.usuario_id
      WHERE p.membresia_id = $1
      ORDER BY p.fecha_pago DESC
    `
    const result = await client.query(
      query,
      [membresia_id]
    )
    return result.rows
  } catch (error) {
    throw error
  } finally {
    client.release()
  }
}

// =====================================================
// MODIFICAR PAGO
// =====================================================
exports.modifyPay = async (body) => {

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const {
      id,
      monto,
      metodo_pago
    } = body

    // =====================================================
    // BUSCAR PAGO
    // =====================================================

    const pagoQuery = `
      SELECT *
      FROM pagos
      WHERE id = $1
      FOR UPDATE
    `

    const pagoResult = await client.query(
      pagoQuery,
      [id]
    )

    if (pagoResult.rows.length === 0) {
      throw new Error('El pago no existe')
    }

    const pago = pagoResult.rows[0]

    // =====================================================
    // BUSCAR MEMBRESÍA
    // =====================================================

    const membresiaQuery = `
      SELECT *
      FROM membresias
      WHERE id = $1
      FOR UPDATE
    `

    const membresiaResult = await client.query(
      membresiaQuery,
      [pago.membresia_id]
    )

    if (membresiaResult.rows.length === 0) {
      throw new Error('La membresía no existe')
    }
    const membresia = membresiaResult.rows[0]

    // =====================================================
    // RESTAURAR SALDO ORIGINAL
    // =====================================================
    const saldoRestaurado = Number(membresia.saldo) + Number(pago.monto)

    // =====================================================
    // VALIDAR NUEVO MONTO
    // =====================================================
    if (Number(monto) > saldoRestaurado) {
      throw new Error(
        `El monto excede el saldo pendiente (${saldoRestaurado})`
      )
    }

    // =====================================================
    // NUEVO SALDO
    // =====================================================
    const nuevoSaldo = saldoRestaurado - Number(monto)

    // =====================================================
    // ACTUALIZAR PAGO
    // =====================================================
    const updatePagoQuery = `
      UPDATE pagos
      SET
        monto = $1,
        metodo_pago = $2,
        fecha_pago = NOW()
      WHERE id = $3
      RETURNING *
    `
    const pagoActualizado = await client.query( updatePagoQuery, [monto, metodo_pago, id] )

    // =====================================================
    // ACTUALIZAR MEMBRESÍA
    // =====================================================
    const updateMembresiaQuery = `
      UPDATE membresias
      SET saldo = $1
      WHERE id = $2
      RETURNING *
    `
    const membresiaActualizada = await client.query(updateMembresiaQuery, [nuevoSaldo, pago.membresia_id])

    await client.query('COMMIT')
    return {
      pago: pagoActualizado.rows[0],
      membresia: membresiaActualizada.rows[0]
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error

  } finally {
    client.release()
  }
}