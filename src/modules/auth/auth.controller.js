const service = require('./auth.service')

// 🔹 REGISTRO
exports.register = async (req, res) => {
  try {
    const { nombre, telefono, email, password, rol, negocio_id } = req.body

    if (!nombre || !telefono || !email || !password) {
      return res.status(400).json({ error: 'Faltan datos obligatorios' })
    }

    const user = await service.register({
      nombre,
      telefono,
      email,
      password,
      rol,
      negocio_id
    })

    res.json(user)
  } catch (error) {
    console.error(error)
    res.status(400).json({ error: error.message })
  }
}

// 🔹 LOGIN (POR TELÉFONO)
exports.login = async (req, res) => {
  try {
    const { telefono, password } = req.body

    if (!telefono || !password) {
      return res.status(400).json({ error: 'Telefono y password requeridos' })
    }

    const data = await service.login({ telefono, password })

    res.json(data)
  } catch (error) {
    console.error(error)
    res.status(400).json({ error: error.message })
  }
}

// 🔹 RECUPERAR PASSWORD (solicitud)
exports.requestReset = async (req, res) => {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({ error: 'Email requerido' })
    }

    const data = await service.requestPasswordReset(email)

    res.json(data)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
}

// 🔹 RESET PASSWORD
exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Datos incompletos' })
    }

    const data = await service.resetPassword({ token, newPassword })

    res.json(data)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
}