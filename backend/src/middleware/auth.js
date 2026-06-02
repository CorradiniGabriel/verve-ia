const jwt = require('jsonwebtoken')

module.exports = (req, res, next) => {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer '))
    return res.status(401).json({ erro: 'Token não fornecido' })

  try {
    const decoded = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET)
    req.usuario = decoded
    next()
  } catch {
    res.status(401).json({ erro: 'Token inválido ou expirado' })
  }
}
