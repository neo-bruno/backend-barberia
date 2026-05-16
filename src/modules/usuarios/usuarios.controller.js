const service = require('./usuarios.service')

// 🔹 LISTAR
exports.list = async (req, res) => {
  try {
    const data = await service.list(req.user)
    res.json(data)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error obteniendo usuarios' })
  }
}

// 🔹 DETALLE
exports.getById = async (req, res) => {
  try {
    const data = await service.getById(req.params.id, req.user)
    res.json(data)
  } catch (e) {
    res.status(404).json({ error: e.message })
  }
}

// 🔹 ACTUALIZAR
exports.update = async (req, res) => {
  try {
    const data = await service.update(req.params.id, req.body, req.user)
    res.json(data)
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
}

// 🔹 ACTIVAR / DESACTIVAR
exports.toggleActivo = async (req, res) => {
  try {
    const data = await service.toggleActivo(req.params.id, req.user)
    res.json(data)
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
}