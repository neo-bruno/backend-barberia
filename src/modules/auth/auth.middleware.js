const jwt = require('jsonwebtoken')

// 🔐 VERIFICAR TOKEN
exports.verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization']

  if (!authHeader) {
    return res.status(401).json({ error: 'Token requerido' })
  }

  const token = authHeader.split(' ')[1]

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = decoded
    next()
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido' })
  }
}

// 🔥 CONTROL DE ROLES
exports.allowRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' })
    }

    if (!roles.includes(req.user.rol)) {
      return res.status(403).json({ error: 'Sin permisos' })
    }

    next()
  }
}

exports.isSuperAdmin = (req, res, next) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        ok: false,
        message: 'No autenticado'
      });
    }

    if (user.rol !== 'superadmin') {
      return res.status(403).json({
        ok: false,
        message: 'Acceso denegado: solo superadmin'
      });
    }

    next();

  } catch (error) {
    next(error);
  }
};