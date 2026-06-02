const router = require('express').Router()
const db = require('../db')
const auth = require('../middleware/auth')

router.get('/', auth, async (req, res) => {
  const r = await db.query(
    `SELECT r.*, u.nome as criado_por_nome FROM regras r
     LEFT JOIN usuarios u ON u.id = r.criado_por
     WHERE r.escritorio_id = $1 ORDER BY r.score DESC, r.usos DESC`,
    [req.usuario.escritorioId]
  )
  res.json(r.rows)
})

router.post('/', auth, async (req, res) => {
  const { padrao, tipoMatch, contaDebito, contaCredito, valorMin, valorMax, tipoLancamento } = req.body
  if (!padrao || !contaDebito || !contaCredito)
    return res.status(400).json({ erro: 'Campos obrigatórios' })

  const r = await db.query(
    `INSERT INTO regras 
      (escritorio_id, padrao, tipo_match, conta_debito, conta_credito, valor_min, valor_max, tipo_lancamento, criado_por)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [req.usuario.escritorioId, padrao, tipoMatch||'fuzzy', contaDebito, contaCredito,
     valorMin||null, valorMax||null, tipoLancamento||'ambos', req.usuario.id]
  )
  res.status(201).json(r.rows[0])
})

router.put('/:id', auth, async (req, res) => {
  if (req.usuario.role !== 'admin') return res.status(403).json({ erro: 'Apenas admins' })
  const { padrao, contaDebito, contaCredito, tipoMatch } = req.body
  const r = await db.query(
    `UPDATE regras SET padrao=$1, conta_debito=$2, conta_credito=$3, tipo_match=$4, atualizado_em=NOW()
     WHERE id=$5 AND escritorio_id=$6 RETURNING *`,
    [padrao, contaDebito, contaCredito, tipoMatch||'fuzzy', req.params.id, req.usuario.escritorioId]
  )
  res.json(r.rows[0])
})

router.delete('/:id', auth, async (req, res) => {
  if (req.usuario.role !== 'admin') return res.status(403).json({ erro: 'Apenas admins' })
  await db.query('DELETE FROM regras WHERE id=$1 AND escritorio_id=$2', [req.params.id, req.usuario.escritorioId])
  res.json({ ok: true })
})

module.exports = router
