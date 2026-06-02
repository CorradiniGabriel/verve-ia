// routes/regras.js
const rRouter = require('express').Router()
const db = require('../db')
const auth = require('../middleware/auth')

rRouter.get('/', auth, async (req, res) => {
  const r = await db.query(
    `SELECT r.*, u.nome as criado_por_nome FROM regras r
     LEFT JOIN usuarios u ON u.id = r.criado_por
     WHERE r.escritorio_id = $1 ORDER BY r.score DESC, r.usos DESC`,
    [req.usuario.escritorioId]
  )
  res.json(r.rows)
})

rRouter.post('/', auth, async (req, res) => {
  const { padrao, tipoMatch, contaDebito, contaCredito, valorMin, valorMax, tipoLancamento } = req.body
  if (!padrao || !contaDebito || !contaCredito)
    return res.status(400).json({ erro: 'Campos obrigatórios' })

  const r = await db.query(
    `INSERT INTO regras (escritorio_id, padrao, tipo_match, conta_debito, conta_credito, valor_min, valor_max, tipo_lancamento, criado_por)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [req.usuario.escritorioId, padrao, tipoMatch||'fuzzy', contaDebito, contaCredito, valorMin||null, valorMax||null, tipoLancamento||'ambos', req.usuario.id]
  )
  res.status(201).json(r.rows[0])
})

rRouter.put('/:id', auth, async (req, res) => {
  if (req.usuario.role !== 'admin') return res.status(403).json({ erro: 'Apenas admins' })
  const { padrao, contaDebito, contaCredito } = req.body
  const r = await db.query(
    `UPDATE regras SET padrao=$1, conta_debito=$2, conta_credito=$3, atualizado_em=NOW()
     WHERE id=$4 AND escritorio_id=$5 RETURNING *`,
    [padrao, contaDebito, contaCredito, req.params.id, req.usuario.escritorioId]
  )
  res.json(r.rows[0])
})

rRouter.delete('/:id', auth, async (req, res) => {
  if (req.usuario.role !== 'admin') return res.status(403).json({ erro: 'Apenas admins' })
  await db.query('DELETE FROM regras WHERE id=$1 AND escritorio_id=$2', [req.params.id, req.usuario.escritorioId])
  res.json({ ok: true })
})

module.exports = rRouter

// ─────────────────────────────────────────────

// routes/clientes.js
const cRouter = require('express').Router()

cRouter.get('/', auth, async (req, res) => {
  const r = await db.query(
    'SELECT * FROM clientes WHERE escritorio_id=$1 ORDER BY nome',
    [req.usuario.escritorioId]
  )
  res.json(r.rows)
})

cRouter.post('/', auth, async (req, res) => {
  const { nome, banco, conta, observacoes } = req.body
  if (!nome) return res.status(400).json({ erro: 'Nome obrigatório' })
  const r = await db.query(
    'INSERT INTO clientes (escritorio_id, nome, banco, conta, observacoes) VALUES ($1,$2,$3,$4,$5) RETURNING *',
    [req.usuario.escritorioId, nome, banco, conta, observacoes]
  )
  res.status(201).json(r.rows[0])
})

cRouter.delete('/:id', auth, async (req, res) => {
  if (req.usuario.role !== 'admin') return res.status(403).json({ erro: 'Apenas admins' })
  await db.query('DELETE FROM clientes WHERE id=$1 AND escritorio_id=$2', [req.params.id, req.usuario.escritorioId])
  res.json({ ok: true })
})

module.exports = { regrasRouter: rRouter, clientesRouter: cRouter }
