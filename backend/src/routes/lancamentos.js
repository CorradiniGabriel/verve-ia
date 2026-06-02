// routes/lancamentos.js
const router = require('express').Router()
const db = require('../db')
const auth = require('../middleware/auth')
const { confirmarClassificacao } = require('../services/regras')

// PATCH /api/lancamentos/:id — confirma ou edita classificação
router.patch('/:id', auth, async (req, res) => {
  const { contaDebito, contaCredito, historicoContabil, acao } = req.body
  const lancamentoId = req.params.id

  try {
    if (acao === 'rejeitar') {
      await db.query(
        `UPDATE lancamentos SET status='rejeitado', classificado_por=$1, classificado_em=NOW() WHERE id=$2`,
        [req.usuario.id, lancamentoId]
      )
      return res.json({ ok: true })
    }

    await confirmarClassificacao(
      lancamentoId, contaDebito, contaCredito,
      req.usuario.id, req.usuario.escritorioId
    )

    if (historicoContabil) {
      await db.query('UPDATE lancamentos SET historico_contabil=$1 WHERE id=$2', [historicoContabil, lancamentoId])
    }

    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ erro: e.message })
  }
})

// PATCH /api/lancamentos/lote — aprova vários de uma vez
router.patch('/lote/aprovar', auth, async (req, res) => {
  const { ids } = req.body
  if (!ids?.length) return res.status(400).json({ erro: 'IDs obrigatórios' })

  for (const id of ids) {
    const l = await db.query('SELECT * FROM lancamentos WHERE id=$1', [id])
    if (l.rows[0]?.conta_debito) {
      await confirmarClassificacao(
        id, l.rows[0].conta_debito, l.rows[0].conta_credito,
        req.usuario.id, req.usuario.escritorioId
      )
    }
  }

  res.json({ ok: true, aprovados: ids.length })
})

module.exports = router
