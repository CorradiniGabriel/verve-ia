const router = require('express').Router()
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const db = require('../db')
const auth = require('../middleware/auth')

// POST /api/auth/registro — cria escritório + primeiro admin
router.post('/registro', async (req, res) => {
  const { nomeEscritorio, nome, email, senha } = req.body
  if (!nomeEscritorio || !nome || !email || !senha)
    return res.status(400).json({ erro: 'Todos os campos são obrigatórios' })

  try {
    const existe = await db.query('SELECT id FROM usuarios WHERE email = $1', [email])
    if (existe.rows.length) return res.status(409).json({ erro: 'E-mail já cadastrado' })

    const escritorio = await db.query(
      'INSERT INTO escritorios (nome) VALUES ($1) RETURNING id', [nomeEscritorio]
    )
    const escritorioId = escritorio.rows[0].id
    const hash = await bcrypt.hash(senha, 10)

    const usuario = await db.query(
      `INSERT INTO usuarios (escritorio_id, nome, email, senha_hash, role)
       VALUES ($1,$2,$3,$4,'admin') RETURNING id, nome, email, role`,
      [escritorioId, nome, email, hash]
    )

    const token = jwt.sign(
      { id: usuario.rows[0].id, escritorioId, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    res.status(201).json({ token, usuario: usuario.rows[0], escritorioId })
  } catch (e) {
    console.error(e)
    res.status(500).json({ erro: 'Erro ao criar conta' })
  }
})

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, senha } = req.body
  if (!email || !senha) return res.status(400).json({ erro: 'E-mail e senha obrigatórios' })

  try {
    const r = await db.query(
      `SELECT u.*, e.nome as nome_escritorio 
       FROM usuarios u JOIN escritorios e ON e.id = u.escritorio_id
       WHERE u.email = $1 AND u.ativo = true`, [email]
    )
    if (!r.rows.length) return res.status(401).json({ erro: 'Credenciais inválidas' })

    const u = r.rows[0]
    const ok = await bcrypt.compare(senha, u.senha_hash)
    if (!ok) return res.status(401).json({ erro: 'Credenciais inválidas' })

    const token = jwt.sign(
      { id: u.id, escritorioId: u.escritorio_id, role: u.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    res.json({
      token,
      usuario: { id: u.id, nome: u.nome, email: u.email, role: u.role },
      escritorio: { id: u.escritorio_id, nome: u.nome_escritorio }
    })
  } catch (e) {
    res.status(500).json({ erro: 'Erro no login' })
  }
})

// GET /api/auth/me
router.get('/me', auth, async (req, res) => {
  const r = await db.query(
    `SELECT u.id, u.nome, u.email, u.role, e.nome as nome_escritorio
     FROM usuarios u JOIN escritorios e ON e.id = u.escritorio_id
     WHERE u.id = $1`, [req.usuario.id]
  )
  res.json(r.rows[0])
})

// POST /api/auth/usuarios — admin adiciona membro ao escritório
router.post('/usuarios', auth, async (req, res) => {
  if (req.usuario.role !== 'admin')
    return res.status(403).json({ erro: 'Apenas administradores podem adicionar usuários' })

  const { nome, email, senha, role } = req.body
  if (!nome || !email || !senha) return res.status(400).json({ erro: 'Campos obrigatórios' })

  try {
    const hash = await bcrypt.hash(senha, 10)
    const r = await db.query(
      `INSERT INTO usuarios (escritorio_id, nome, email, senha_hash, role)
       VALUES ($1,$2,$3,$4,$5) RETURNING id, nome, email, role`,
      [req.usuario.escritorioId, nome, email, hash, role || 'contador']
    )
    res.status(201).json(r.rows[0])
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ erro: 'E-mail já cadastrado' })
    res.status(500).json({ erro: 'Erro ao criar usuário' })
  }
})

// GET /api/auth/usuarios — lista membros do escritório
router.get('/usuarios', auth, async (req, res) => {
  const r = await db.query(
    `SELECT id, nome, email, role, ativo, criado_em 
     FROM usuarios WHERE escritorio_id = $1 ORDER BY nome`,
    [req.usuario.escritorioId]
  )
  res.json(r.rows)
})

module.exports = router
