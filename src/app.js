const express = require('express')
const cors = require('cors')

const app = express()

const pool = require('./config/db')

app.use(cors())
app.use(express.json())

app.get('/db_test', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()')
    res.json({
      ok: true,
      time: result.rows[0]
    })
  } catch (error) {
    console.log(error)
    res.status(500).json({ error: 'BASE DATOS error'})
  }
})

// 🔥 RUTAS
app.use('/auth', require('./modules/auth/auth.routes'))
app.use('/usuarios', require('./modules/usuarios/usuarios.routes'))
app.use('/negocios', require('./modules/negocios/negocios.routes'))
app.use('/servicios', require('./modules/servicios/servicios.routes'))
app.use('/clientes', require('./modules/clientes/clientes.routes'))
app.use('/ventas', require('./modules/ventas/ventas.routes'))
app.use('/cajas', require('./modules/cajas/cajas.routes'))
// app.use('/horarios', require('./modules/horarios/horarios.routes'))
app.use('/bloqueos', require('./modules/bloqueos/bloqueos.routes'))
app.use('/membresias', require('./modules/membresias/membresias.routes'))
app.use('/onboarding', require('./modules/onboarding/onboarding.routes'))
app.use('/reservas', require('./modules/reservas/reservas.routes'))
app.use('/disponibilidad', require('./modules/disponibilidad/disponibilidad.routes'))
app.use('/agenda', require('./modules/agenda/agenda.routes'))
app.use('/reportes', require('./modules/reportes/reportes.routes'))
app.use('/promociones', require('./modules/promociones/promociones.routes'))
app.use('/pagos', require('./modules/pagos/pagos.routes'))


// 🔥 API IMAGES
app.use( '/images', require('./modules/images/images.routes'))

// 🔥 ARCHIVOS PUBLICOS
app.use( '/uploads', express.static('src/uploads'))

// health check
app.get('/', (req, res) => {
  res.json({ message: 'API Baberia funcionando 💈🔥'})
})

module.exports = app