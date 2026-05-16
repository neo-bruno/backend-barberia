const pool = require('../../config/db');
const bcrypt = require('bcrypt');

exports.createOnboarding = async (body) => {

  const client = await pool.connect();

  try {

    await client.query('BEGIN');

    const {
      negocio,
      usuario,
      membresia,
      pago
    } = body;

    // =========================
    // VALIDACIONES
    // =========================

    if (
      !negocio?.nombre ||
      !usuario?.telefono ||
      !usuario?.email
    ) {
      throw new Error('Datos incompletos');
    }

    // =========================
    // CREAR NEGOCIO
    // =========================

    const negocioRes = await client.query(
      `
      INSERT INTO negocios
      (
        nombre,
        slug,
        telefono,
        direccion,
        activo
      )
      VALUES ($1,$2,$3,$4,$5)
      RETURNING *
      `,
      [
        negocio.nombre,
        negocio.slug,
        negocio.telefono || null,
        negocio.direccion || null,
        true
      ]
    );

    const negocioDB = negocioRes.rows[0];

    // =========================
    // HASH PASSWORD
    // =========================

    const hashedPassword =
      await bcrypt.hash(usuario.password, 10);

    // =========================
    // CREAR USUARIO ADMIN
    // =========================

    const userRes = await client.query(
      `
      INSERT INTO usuarios
      (
        negocio_id,
        nombre,
        telefono,
        email,
        password,
        rol,
        activo
      )
      VALUES ($1,$2,$3,$4,$5,'admin',$6)

      RETURNING
        id,
        nombre,
        telefono,
        email,
        rol
      `,
      [
        negocioDB.id,
        usuario.nombre,
        usuario.telefono,
        usuario.email,
        hashedPassword,
        true
      ]
    );

    const userDB = userRes.rows[0];

    // =========================
    // FECHAS MEMBRESIA
    // =========================

    const [year, month, day] =
      membresia.fecha_inicio
        .split('-')
        .map(Number);

    let newMonth = month + membresia.meses;
    let newYear = year;

    while (newMonth > 12) {
      newMonth -= 12;
      newYear++;
    }

    const fechaInicio =
      new Date(year, month - 1, day);

    const fechaFin =
      new Date(newYear, newMonth - 1, day);

    // =========================
    // TOTALES
    // =========================

    const total =
      Number(membresia.meses) *
      Number(membresia.precio_mensual);

    const montoInicial =
      Number(pago?.monto || 0);

    const saldo =
      total - montoInicial;

    // =========================
    // CREAR MEMBRESIA
    // =========================

    const memRes = await client.query(
      `
      INSERT INTO membresias
      (
        usuario_id,
        negocio_id,
        fecha_inicio,
        fecha_fin,
        meses,
        precio_mensual,
        total,
        saldo,
        estado
      )

      VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9)

      RETURNING *
      `,
      [
        userDB.id,
        negocioDB.id,
        fechaInicio,
        fechaFin,
        membresia.meses,
        membresia.precio_mensual,
        total,
        saldo,
        'activo'
      ]
    );

    const membresiaDB = memRes.rows[0];

    // =========================
    // REGISTRAR PAGO
    // =========================

    if (montoInicial > 0) {

      await client.query(
        `
        INSERT INTO pagos
        (
          membresia_id,
          monto,
          metodo_pago      
        )

        VALUES ($1,$2,$3)
        `,
        [
          membresiaDB.id,
          montoInicial,
          pago.metodo_pago || 'efectivo'
        ]
      );
    }

    // =========================
    // COMMIT
    // =========================

    await client.query('COMMIT');

    return {
      negocio: negocioDB,
      usuario: userDB,
      membresia: membresiaDB
    };

  } catch (error) {

    await client.query('ROLLBACK');

    if (error.code === '23505') {
      console.log(error.detail)
      throw new Error(error.detail)
    }

    throw error;

  } finally {

    client.release();

  }

};

exports.updateOnboarding = async (body) => {

  const client = await pool.connect()

  try {

    await client.query('BEGIN')

    const {
      negocio,
      usuario,
      membresia
    } = body

    // =========================
    // VALIDACIONES
    // =========================

    if (
      !negocio?.id ||
      !usuario?.id ||
      !membresia?.id
    ) {
      throw new Error('Faltan IDs para actualizar')
    }

    // =========================
    // ACTUALIZAR NEGOCIO
    // =========================

    const negocioRes = await client.query(
      `
      UPDATE negocios
      SET
        nombre = $1,
        slug = $2,
        telefono = $3,
        direccion = $4
      WHERE id = $5
      RETURNING *
      `,
      [
        negocio.nombre,
        negocio.slug,
        negocio.telefono || '',
        negocio.direccion || '',
        negocio.id
      ]
    )

    // =========================
    // ACTUALIZAR USUARIO
    // =========================

    const userRes = await client.query(
      `
      UPDATE usuarios
      SET
        nombre = $1,
        telefono = $2,
        email = $3
      WHERE id = $4
      RETURNING id, nombre, telefono, email, rol
      `,
      [
        usuario.nombre,
        usuario.telefono,
        usuario.email,
        usuario.id
      ]
    )

    // =========================
    // ACTUALIZAR PASSWORD
    // SOLO SI VIENE UNA NUEVA
    // =========================

    if (
      usuario.password &&
      usuario.password.trim() !== ''
    ) {

      const hashedPassword =
        await bcrypt.hash(usuario.password, 10)

      await client.query(
        `
        UPDATE usuarios
        SET password = $1
        WHERE id = $2
        `,
        [
          hashedPassword,
          usuario.id
        ]
      )
    }

    // =========================
    // CALCULAR NUEVA FECHA FIN
    // =========================

    const [year, month, day] =
      membresia.fecha_inicio
        .split('-')
        .map(Number)

    let newMonth =
      month + Number(membresia.meses)

    let newYear = year

    while (newMonth > 12) {
      newMonth -= 12
      newYear++
    }

    const fechaInicio =
      new Date(year, month - 1, day)

    const fechaFin =
      new Date(newYear, newMonth - 1, day)

    // =========================
    // TOTAL Y SALDO
    // =========================

    const total =
      Number(membresia.meses) *
      Number(membresia.precio_mensual)

    // obtener pagos realizados
    const pagosRes = await client.query(
      `
      SELECT
        COALESCE(SUM(monto), 0) as total_pagado
      FROM pagos
      WHERE membresia_id = $1
      `,
      [membresia.id]
    )

    const totalPagado =
      Number(
        pagosRes.rows[0]?.total_pagado || 0
      )

    const saldo =
      total - totalPagado

    // =========================
    // ACTUALIZAR MEMBRESIA
    // =========================

    const memRes = await client.query(
      `
      UPDATE membresias
      SET
        fecha_inicio = $1,
        fecha_fin = $2,
        meses = $3,
        precio_mensual = $4,
        total = $5,
        saldo = $6
      WHERE id = $7
      RETURNING *
      `,
      [
        fechaInicio,
        fechaFin,
        membresia.meses,
        membresia.precio_mensual,
        total,
        saldo,
        membresia.id
      ]
    )

    // =========================
    // COMMIT
    // =========================

    await client.query('COMMIT')

    return {
      negocio: negocioRes.rows[0],
      usuario: userRes.rows[0],
      membresia: memRes.rows[0]
    }

  } catch (error) {

    await client.query('ROLLBACK')

    // =========================
    // ERRORES DUPLICADOS
    // =========================

    if (error.code === '23505') {

      const detalle =
        error.detail || ''

      if (detalle.includes('telefono')) {
        throw new Error(
          'El teléfono ya está registrado'
        )
      }

      if (detalle.includes('email')) {
        throw new Error(
          'El email ya está registrado'
        )
      }

      throw new Error(
        'Registro duplicado'
      )
    }
    throw error
  } finally {
    client.release()
  }
}