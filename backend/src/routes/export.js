const router = require('express').Router()
const db = require('../db')
const auth = require('../middleware/auth')

// GET /api/export/:extratoId — gera CSV no formato data;D;C;valor;EST;HISTORICO
router.get('/:extratoId', auth, async (req, res) => {
  const extrato = await db.query(
    `SELECT e.*, c.nome as cliente_nome, c.escritorio_id FROM extratos e
     JOIN clientes c ON c.id = e.cliente_id
     WHERE e.id = $1`,
    [req.params.extratoId]
  )

  if (!extrato.rows.length) return res.status(404).json({ erro: 'Extrato não encontrado' })
  if (extrato.rows[0].escritorio_id !== req.usuario.escritorioId)
    return res.status(403).json({ erro: 'Acesso negado' })

  const lancamentos = await db.query(
    `SELECT * FROM lancamentos 
     WHERE extrato_id=$1 AND status='aprovado' AND conta_debito IS NOT NULL
     ORDER BY data_lancamento`,
    [req.params.extratoId]
  )

  if (!lancamentos.rows.length)
    return res.status(400).json({ erro: 'Nenhum lançamento aprovado para exportar' })

  // Monta CSV no formato exato da planilha
  const linhas = ['data;D;C; valor ;EST;HISTORICO']

  for (const l of lancamentos.rows) {
    const data = formatarData(l.data_lancamento)
    const valor = l.valor.toFixed(2).replace('.', ',')
    const historico = (l.historico_contabil || l.historico_bruto || '').replace(/;/g, ',')

    linhas.push(`${data};${l.conta_debito};${l.conta_credito};${valor};${l.est || 2};${historico}`)
  }

  const csv = linhas.join('\n')
  const nomeArquivo = `lancamentos_${extrato.rows[0].cliente_nome.replace(/\s/g,'_')}_${formatarData(new Date())}.csv`

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`)
  res.send('\uFEFF' + csv) // BOM para Excel abrir corretamente com acentos
})

function formatarData(d) {
  if (!d) return ''
  const dt = new Date(d)
  const dia = String(dt.getUTCDate()).padStart(2, '0')
  const mes = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const ano = dt.getUTCFullYear()
  return `${dia}/${mes}/${ano}`
}

module.exports = router
