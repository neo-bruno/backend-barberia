const pool = require('../../config/db')

exports.createAgenda = async (negocioId, body) => {

  const { intervalo, horarios, bloqueos } = body

  const client = await pool.connect()

  try {

    await client.query('BEGIN')

    // borrar configuración anterior
    await client.query(`
      DELETE FROM horarios
      WHERE negocio_id=$1
   `, [negocioId])

    await client.query(`
      DELETE FROM bloqueos
      WHERE negocio_id=$1
   `, [negocioId])

    await client.query(`
      DELETE FROM configuracion_negocio
      WHERE negocio_id=$1
   `, [negocioId])


    // guardar configuracion
    await client.query(`
      INSERT INTO public.configuracion_negocio(
      negocio_id, intervalo_citas)
      VALUES ($1, $2);
   `, [negocioId, intervalo])

    // guardar horarios
    for (const h of horarios) {
      await client.query(`
        INSERT INTO horarios(
          negocio_id,
          dia_semana,
          hora_inicio,
          hora_fin
        )
        VALUES($1,$2,$3,$4)
      `,
        [
          negocioId,
          h.dia_semana,
          h.hora_inicio,
          h.hora_fin
        ])
    }

    // guardar bloqueos
    for (const b of bloqueos) {
      await client.query(`
       INSERT INTO bloqueos(
         negocio_id,
         fecha,
         hora_inicio,
         hora_fin,
         motivo
       )
       VALUES($1,$2,$3,$4,$5)
      `,
        [
          negocioId,
          b.fecha,
          b.hora_inicio || null,
          b.hora_fin || null,
          b.motivo
        ])
    }

    await client.query('COMMIT')

    return {
      mensaje: 'Agenda guardada correctamente'
    }
  } catch (error) {

    await client.query('ROLLBACK')
    throw error

  } finally {

    client.release()

  }

}

exports.getAgenda = async (negocioId) => {

  const horarios = await pool.query(
    `
    SELECT
      dia_semana,
      hora_inicio,
      hora_fin
    FROM horarios
    WHERE negocio_id=$1
    ORDER BY dia_semana,hora_inicio
    `,
    [negocioId]
  )
  const bloqueos = await pool.query(
    `
    SELECT
      id,
      fecha,
      hora_inicio,
      hora_fin,
      motivo
    FROM bloqueos
    WHERE negocio_id=$1
    ORDER BY fecha
    `,
    [negocioId]
  )
  return {
    horarios: horarios.rows,
    bloqueos: bloqueos.rows
  }
}

exports.obtenerDisponibilidad = async (negocio_id) => {
  const client = await pool.connect()

  try {

    /* intervalo de citas */
    const config = await client.query(
      `
      SELECT intervalo_citas
      FROM configuracion_negocio
      WHERE negocio_id=$1
      `,
      [negocio_id]
    )

    /* horarios semanales */
    const horarios = await client.query(
      `
      SELECT
      dia_semana,
      hora_inicio,
      hora_fin
      FROM horarios
      WHERE negocio_id=$1
      ORDER BY dia_semana,hora_inicio
      `,
      [negocio_id]
    )

    /* bloqueos especiales */
    const bloqueos = await client.query(
      `
      SELECT
      id,
      fecha,
      hora_inicio,
      hora_fin,
      motivo
      FROM bloqueos
      WHERE negocio_id=$1
      ORDER BY fecha
      `,
      [negocio_id]
    )
    return {
      intervalo: config.rows[0]?.intervalo_citas || 60,
      horarios: reconstruirSemana(horarios.rows),
      bloqueos: bloqueos.rows
    }
  }
  finally {
    client.release()
  }
}

function reconstruirSemana(rows) {
  const dias = [
    'Lunes',
    'Martes',
    'Miércoles',
    'Jueves',
    'Viernes',
    'Sábado',
    'Domingo'
  ]
  let semana = []
  for (let i = 1; i <= 7; i++) {
    const bloques = rows.filter( r => Number(r.dia_semana) === i )

    if (!bloques.length) {

      semana.push({
        dia_semana: i,
        nombre: dias[i - 1],
        activo: false,
        apertura: '',
        cierre: '',
        descansos: []
      })
      continue
    }

    /* reconstruye descansos desde huecos */
    let descansos = []

    for ( let j = 0; j < bloques.length - 1; j++ ) {
      descansos.push({
        inicio: bloques[j].hora_fin,
        fin: bloques[j + 1].hora_inicio
      })
    }
    semana.push({
      dia_semana: i,
      nombre: dias[i - 1],
      activo: true,
      apertura: bloques[0].hora_inicio,
      cierre: bloques[bloques.length - 1].hora_fin,
      descansos
    })
  }
  return semana
}