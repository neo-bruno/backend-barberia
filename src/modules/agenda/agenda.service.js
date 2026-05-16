const pool = require('../../config/db')

function sumarMinutos(hora, minutos) {

  let [h, m] = hora.split(':').map(Number)

  let total = (h * 60) + m + minutos

  let nh = Math.floor(total / 60)
  let nm = total % 60

  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`

}

exports.getAgendaSlots = async (negocioId, fecha) => {

  const [year,month,day] = fecha.split('-').map(Number)
  const fechaObj = new Date(year, month - 1, day)

  let diaSemana = fechaObj.getDay()

  if (diaSemana === 0) {
    diaSemana = 7
  }
  
  // horarios
  const horariosResult = await pool.query(
    `
    SELECT hora_inicio,hora_fin
    FROM horarios
    WHERE negocio_id=$1
    AND dia_semana=$2
    ORDER BY hora_inicio
  `,
    [negocioId, diaSemana]
  )
  // configuración
  const configuracionResult = await pool.query(
    `
    SELECT intervalo_citas
    FROM configuracion_negocio
    WHERE negocio_id=$1
    `,
    [negocioId]
  )

  const intervalo = configuracionResult.rows[0]?.intervalo_citas || 30

  // bloqueos
  const bloqueosResult = await pool.query(
    `
    SELECT id,hora_inicio,hora_fin,motivo,tipo
    FROM bloqueos
    WHERE negocio_id=$1
    AND fecha=$2
    `,
    [negocioId, fecha]
  )

  // reservas + cliente + servicio
  const reservasResult = await pool.query(
    `
    SELECT

      r.id as reserva_id,
      r.fecha,
      r.hora_inicio,
      r.hora_fin,
      r.estado,
      r.notas,
      r.created_at,

      c.id as cliente_id,
      c.nombre as cliente_nombre,
      c.telefono as cliente_telefono,
      c.notas as cliente_notas,

      s.id as servicio_id,
      s.nombre as servicio_nombre,
      s.duracion,
      s.precio,

      -- 🔥 NUEVO: datos de venta
      v.id as venta_id,
      v.monto,
      v.monto_original,
      v.descuento,
      v.promocion_id

    FROM reservas r

    JOIN clientes c ON c.id = r.cliente_id
    JOIN servicios s ON s.id = r.servicio_id

    LEFT JOIN ventas v ON v.reserva_id = r.id  -- 🔥 CLAVE

    WHERE r.negocio_id = $1
    AND r.fecha = $2

    AND r.estado NOT IN ('cancelada','no_asistio')
   `,
    [negocioId, fecha]
  )




  // generar slots
  let slots = []

  for (const bloque of horariosResult.rows) {

    let actual = bloque.hora_inicio.slice(0, 5)

    while (actual < bloque.hora_fin.slice(0, 5)) {

      let finSlot = sumarMinutos(
        actual,
        intervalo
      )
      if (
        finSlot <= bloque.hora_fin.slice(0, 5)
      ) {
        slots.push({          
          inicio: actual,
          fin: finSlot,
          estado: 'disponible',
          bloqueo: null,
          reserva: null,
          cliente: null,
          servicio: null
        })
      }
      actual = finSlot
    }
  }

  // aplicar bloqueos
  slots = slots.map(slot => {
    
    for (const b of bloqueosResult.rows) {
      const ini = b.hora_inicio?.slice(0, 5)
      const fin = b.hora_fin?.slice(0, 5)

      if (
        ini &&
        slot.inicio >= ini &&
        slot.inicio < fin
      ) {
        return {
          ...slot,
          estado:'bloqueado',
          bloqueo:{
            id:b.id,
            motivo:b.motivo,
            tipo:b.tipo
          }
        }
      }
    }

    return slot

  })



  // inyectar reserva completa
  slots = slots.map(slot => {

    const reserva = reservasResult.rows.find(
      r => r.hora_inicio.slice(0, 5) === slot.inicio
    )

    if (!reserva) {
      return slot
    }


    return {
      ...slot,

      estado: reserva.estado,

      reserva: {
        id: reserva.reserva_id,
        fecha: reserva.fecha,
        notas: reserva.notas,
        created_at: reserva.created_at
      },

      cliente: {
        id: reserva.cliente_id,
        nombre: reserva.cliente_nombre,
        telefono: reserva.cliente_telefono,
        notas: reserva.cliente_notas
      },

      servicio: {
        id: reserva.servicio_id,
        nombre: reserva.servicio_nombre,
        duracion: reserva.duracion,
        precio: reserva.precio
      },

      // 🔥 NUEVO BLOQUE
      venta: reserva.venta_id ? {
        id: reserva.venta_id,
        monto: Number(reserva.monto),
        monto_original: Number(reserva.monto_original),
        descuento: Number(reserva.descuento),
        promocion_id: reserva.promocion_id
      } : null
    }
  })
  
  return {
    horarios: slots
  }
}

exports.getAgendaPublic = async ({slug, fecha}) => {
  
  // 🔥 1. Buscar negocio
  const negocioResult = await pool.query(
    `
    SELECT id, nombre
    FROM negocios
    WHERE slug = $1
    LIMIT 1
    `,
    [slug]
  )

  if (negocioResult.rows.length === 0) {
    throw new Error('Negocio no encontrado')
  }

  const negocio = negocioResult.rows[0]

  const [year,month,day] = fecha.split('-').map(Number)
  const fechaObj = new Date(year, month - 1, day)

  let diaSemana = fechaObj.getDay()

  if (diaSemana === 0) {
    diaSemana = 7
  }
  
  // horarios
  const horariosResult = await pool.query(
    `
    SELECT hora_inicio,hora_fin
    FROM horarios
    WHERE negocio_id=$1
    AND dia_semana=$2
    ORDER BY hora_inicio
  `,
    [negocio.id, diaSemana]
  )
  // configuración
  const configuracionResult = await pool.query(
    `
    SELECT intervalo_citas
    FROM configuracion_negocio
    WHERE negocio_id=$1
    `,
    [negocio.id]
  )

  const intervalo = configuracionResult.rows[0]?.intervalo_citas || 30

  // bloqueos
  const bloqueosResult = await pool.query(
    `
    SELECT id,hora_inicio,hora_fin,motivo,tipo
    FROM bloqueos
    WHERE negocio_id=$1
    AND fecha=$2
    `,
    [negocio.id, fecha]
  )

  // reservas + cliente + servicio
  const reservasResult = await pool.query(
    `
    SELECT

      r.id as reserva_id,
      r.fecha,
      r.hora_inicio,
      r.hora_fin,
      r.estado,
      r.notas,
      r.created_at,

      c.id as cliente_id,
      c.nombre as cliente_nombre,
      c.telefono as cliente_telefono,
      c.notas as cliente_notas,

      s.id as servicio_id,
      s.nombre as servicio_nombre,
      s.duracion,
      s.precio,

      -- 🔥 NUEVO: datos de venta
      v.id as venta_id,
      v.monto,
      v.monto_original,
      v.descuento,
      v.promocion_id

    FROM reservas r

    JOIN clientes c ON c.id = r.cliente_id
    JOIN servicios s ON s.id = r.servicio_id

    LEFT JOIN ventas v ON v.reserva_id = r.id  -- 🔥 CLAVE

    WHERE r.negocio_id = $1
    AND r.fecha = $2

    AND r.estado NOT IN ('cancelada','no_asistio')
   `,
    [negocio.id, fecha]
  )




  // generar slots
  let slots = []

  for (const bloque of horariosResult.rows) {

    let actual = bloque.hora_inicio.slice(0, 5)

    while (actual < bloque.hora_fin.slice(0, 5)) {

      let finSlot = sumarMinutos(
        actual,
        intervalo
      )
      if (
        finSlot <= bloque.hora_fin.slice(0, 5)
      ) {
        slots.push({          
          inicio: actual,
          fin: finSlot,
          estado: 'libre',
          bloqueo: null,
          reserva: null,
          cliente: null,
          servicio: null
        })
      }
      actual = finSlot
    }
  }

  // aplicar bloqueos
  slots = slots.map(slot => {
    
    for (const b of bloqueosResult.rows) {
      const ini = b.hora_inicio?.slice(0, 5)
      const fin = b.hora_fin?.slice(0, 5)

      if (
        ini &&
        slot.inicio >= ini &&
        slot.inicio < fin
      ) {
        return {
          ...slot,
          estado:'bloqueado',
          bloqueo:{
            id:b.id,
            motivo:b.motivo,
            tipo:b.tipo
          }
        }
      }
    }

    return slot

  })



  // inyectar reserva completa
  slots = slots.map(slot => {

    const reserva = reservasResult.rows.find(
      r => r.hora_inicio.slice(0, 5) === slot.inicio
    )

    if (!reserva) {
      return slot
    }


    return {
      ...slot,

      estado: reserva.estado,

      reserva: {
        id: reserva.reserva_id,
        fecha: reserva.fecha,
        notas: reserva.notas,
        created_at: reserva.created_at
      },

      cliente: {
        id: reserva.cliente_id,
        nombre: reserva.cliente_nombre,
        telefono: reserva.cliente_telefono,
        notas: reserva.cliente_notas
      },

      servicio: {
        id: reserva.servicio_id,
        nombre: reserva.servicio_nombre,
        duracion: reserva.duracion,
        precio: reserva.precio
      },

      // 🔥 NUEVO BLOQUE
      venta: reserva.venta_id ? {
        id: reserva.venta_id,
        monto: Number(reserva.monto),
        monto_original: Number(reserva.monto_original),
        descuento: Number(reserva.descuento),
        promocion_id: reserva.promocion_id
      } : null
    }
  })
  
  return {
    horarios: slots
  }
}