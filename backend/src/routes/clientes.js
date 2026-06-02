const router = require('express').Router()
const db = require('../db')
const auth = require('../middleware/auth')

router.get('/', auth, async (req, res) => {
  const r = await db.query(
    'SELECT * FROM clientes WHERE escritorio_id=$1 ORDER BY nome',
    [req.usuario.escritorioId]
  )
  res.json(r.rows)
})

router.post('/', auth, async (req, res) => {
  const { nome, banco, conta, observacoes } = req.body
  if (!nome) return res.status(400).json({ erro: 'Nome obrigatório' })
  const r = await db.query(
    'INSERT INTO clientes (escritorio_id, nome, banco, conta, observacoes) VALUES ($1,$2,$3,$4,$5) RETURNING *',
    [req.usuario.escritorioId, nome, banco, conta, observacoes]
  )
  res.status(201).json(r.rows[0])
})

router.delete('/:id', auth, async (req, res) => {
  if (req.usuario.role !== 'admin') return res.status(403).json({ erro: 'Apenas admins' })
  await db.query('DELETE FROM clientes WHERE id=$1 AND escritorio_id=$2', [req.params.id, req.usuario.escritorioId])
  res.json({ ok: true })
})

module.exports = router
