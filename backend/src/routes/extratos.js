const router = require('express').Router()
const multer = require('multer')
const db = require('../db')
const auth = require('../middleware/auth')
const { parsearExtrato } = require('../services/parser')
const { classificarLancamento } = require('../services/regras')

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

// POST /api/extratos/importar
router.post('/importar', auth, upload.single('extrato'), async (req, res) => {
  if (!req.file) return res.status(400).json({ erro: 'Nenhum arquivo enviado' })

  const { clienteId } = req.body
  if (!clienteId) return res.status(400).json({ erro: 'Cliente não informado' })

  try {
    // Verifica se o cliente pertence ao escritório
    const cliente = await db.query(
      'SELECT id FROM clientes WHERE id=$1 AND escritorio_id=$2',
      [clienteId, req.usuario.escritorioId]
    )
    if (!cliente.rows.length) return res.status(403).json({ erro: 'Cliente não encontrado' })

    // Parseia o PDF
    const resultado = await parsearExtrato(req.file.buffer)

    // Salva o extrato
    const extrato = await db.query(
      `INSERT INTO extratos 
        (cliente_id, usuario_id, nome_arquivo, periodo_inicio, periodo_fim, saldo_inicial, status)
       VALUES ($1,$2,$3,$4,$5,$6,'em_revisao') RETURNING id`,
      [
        clienteId,
        req.usuario.id,
        req.file.originalname,
        resultado.periodo?.inicio ? converterData(resultado.periodo.inicio) : null,
        resultado.periodo?.fim ? converterData(resultado.periodo.fim) : null,
        resultado.saldoInicial
      ]
    )
    const extratoId = extrato.rows[0].id

    // Classifica e salva cada lançamento
    const lancamentosProcessados = []
    for (const l of resultado.lancamentos) {
      const classificacao = await classificarLancamento(
        req.usuario.escritorioId, l, true
      )

      const lancamento = await db.query(
        `INSERT INTO lancamentos
          (extrato_id, data_lancamento, historico_bruto, historico_normalizado,
           valor, tipo, saldo_apos, conta_debito, conta_credito,
           regra_id, origem_classificacao, score_confianca, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
        [
          extratoId,
          converterData(l.data),
          l.historico_bruto,
          l.historico_normalizado,
          l.valor,
          l.tipo,
          l.saldo_apos,
          classificacao.conta_debito,
          classificacao.conta_credito,
          classificacao.regra_id,
          classificacao.origem,
          classificacao.score,
          classificacao.origem === 'regra' && classificacao.score >= 95 ? 'aprovado' : 'pendente'
        ]
      )

      lancamentosProcessados.push({
        id: lancamento.rows[0].id,
        ...l,
        ...classificacao
      })
    }

    res.status(201).json({
      extratoId,
      banco: resultado.banco,
      periodo: resultado.periodo,
      totalLancamentos: lancamentosProcessados.length,
      automaticos: lancamentosProcessados.filter(l => l.status === 'aprovado').length,
      revisao: lancamentosProcessados.filter(l => l.status === 'pendente').length,
      lancamentos: lancamentosProcessados
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ erro: e.message || 'Erro ao processar extrato' })
  }
})

// GET /api/extratos — lista extratos do escritório
router.get('/', auth, async (req, res) => {
  const r = await db.query(
    `SELECT e.*, c.nome as cliente_nome, u.nome as importado_por,
      COUNT(l.id) as total_lancamentos,
      SUM(CASE WHEN l.status='aprovado' THEN 1 ELSE 0 END) as aprovados,
      SUM(CASE WHEN l.status='pendente' THEN 1 ELSE 0 END) as pendentes
     FROM extratos e
     JOIN clientes c ON c.id = e.cliente_id
     JOIN usuarios u ON u.id = e.usuario_id
     LEFT JOIN lancamentos l ON l.extrato_id = e.id
     WHERE c.escritorio_id = $1
     GROUP BY e.id, c.nome, u.nome
     ORDER BY e.importado_em DESC`,
    [req.usuario.escritorioId]
  )
  res.json(r.rows)
})

// GET /api/extratos/:id — detalhe com lançamentos
router.get('/:id', auth, async (req, res) => {
  const extrato = await db.query(
    `SELECT e.*, c.nome as cliente_nome FROM extratos e
     JOIN clientes c ON c.id = e.cliente_id
     WHERE e.id = $1 AND c.escritorio_id = $2`,
    [req.params.id, req.usuario.escritorioId]
  )
  if (!extrato.rows.length) return res.status(404).json({ erro: 'Extrato não encontrado' })

  const lancamentos = await db.query(
    `SELECT l.*, u.nome as classificado_por_nome FROM lancamentos l
     LEFT JOIN usuarios u ON u.id = l.classificado_por
     WHERE l.extrato_id = $1 ORDER BY l.data_lancamento`,
    [req.params.id]
  )

  res.json({ ...extrato.rows[0], lancamentos: lancamentos.rows })
})

function converterData(str) {
  if (!str) return null
  const [d, m, a] = str.split('/')
  return `${a}-${m}-${d}`
}

module.exports = router
