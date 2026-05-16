const pool = require('../../config/db')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const SALT_ROUNDS = 10
const crypto = require('crypto')
const token = crypto.randomBytes(32).toString('hex')

// REGISTRO
exports.register = async ({ nombre, telefono, email, password, rol, negocio_id }) => {
  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS)
  try {
    const result = await pool.query(`
      INSERT INTO public.usuarios(
      negocio_id, nombre, telefono, email, password, rol)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, nombre, telefono, email, rol;
      `, [negocio_id, nombre, telefono, email, hashedPassword, rol || 'barbero'])
    
    return result.rows[0]
  } catch (e) {
    if (e.code === '23505') {
      throw new Error('Teléfono o email ya registrado')
    }
    throw e
  }
}

// LOGIN
exports.login = async ({telefono, password}) => {
  
  // buscamos al usuario
  const userRes = await pool.query(
    `SELECT * FROM usuarios WHERE telefono = $1 AND activo = true`,
    [telefono]
  )

  // verificar si existe el usuario
  if(!userRes.rows.length){
    throw new Error('Usuario no encontrado')
  }

  // caso que exista el usuario
  const user = userRes.rows[0]

  const isValid = await bcrypt.compare(password, user.password)

  if(!isValid){
    throw new Error('Credenciales  incorrectas')
  }

  // actualizar el ultimo login
  await pool.query(`
    UPDATE usuarios SET ultimo_login = NOW() WHERE id=$1 `,
    [user.id]
  )

  // TOKEN
  const token = jwt.sign({
      id: user.id,
      rol: user.rol,
      negocio_id: user.negocio_id
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES}
  )

  return {
    token,
    usuario: {
      id: user.id,
      nombre: user.nombre,
      telefono: user.telefono,
      rol: user.rol,
      negocio_id: user.negocio_id
    }
  }
}

exports.resetPassword = async ({ token, newPassword }) => {

  const res = await pool.query(`
    SELECT * FROM password_resets
    WHERE token = $1 AND expires_at > NOW()
  `, [token])

  if (!res.rows.length) {
    throw new Error('Token inválido o expirado')
  }

  const { user_id } = res.rows[0]

  const hashed = await bcrypt.hash(newPassword, 10)

  await pool.query(
    `UPDATE usuarios SET password = $1 WHERE id = $2`,
    [hashed, user_id]
  )

  return { ok: true }
}

// 🔹 SOLICITAR RESET PASSWORD
exports.requestPasswordReset = async (email) => {

  // 1. buscar usuario por email
  const userRes = await pool.query(
    `SELECT id, email FROM usuarios WHERE email = $1 AND activo = true`,
    [email]
  )

  if (!userRes.rows.length) {
    // ⚠️ no revelamos si existe o no (seguridad)
    return { ok: true }
  }

  const user = userRes.rows[0]

  // 2. generar token seguro
  const token = crypto.randomBytes(32).toString('hex')

  // 3. guardar token con expiración
  await pool.query(`
    INSERT INTO password_resets (user_id, token, expires_at)
    VALUES ($1, $2, NOW() + INTERVAL '1 hour')
  `, [user.id, token])

  // 4. (SIMULACIÓN) link de recuperación
  const resetLink = `http://localhost:3000/reset-password?token=${token}`

  console.log('🔑 Reset link:', resetLink)

  // 🔥 luego aquí iría email real (nodemailer)

  return {
    ok: true,
    message: 'Si el correo existe, se enviaron instrucciones'
  }
}