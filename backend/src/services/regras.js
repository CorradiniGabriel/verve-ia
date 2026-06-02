const stringSimilarity = require('string-similarity')
const db = require('../db')
const { normalizar } = require('./parser')

// Busca a melhor regra para um lançamento
async function buscarRegra(escritorioId, historicoNorm, valor, tipo) {
  const regras = await db.query(
    `SELECT * FROM regras 
     WHERE escritorio_id = $1 
     AND (tipo_lancamento = $2 OR tipo_lancamento = 'ambos')
     AND ativo = true
     ORDER BY score DESC, usos DESC`,
    [escritorioId, tipo]
  )

  if (!regras.rows.length) return null

  let melhorRegra = null
  let melhorScore = 0

  for (const regra of regras.rows) {
    let score = 0
    const padraoNorm = normalizar(regra.padrao)

    if (regra.tipo_match === 'exato') {
      // Match exato normalizado
      if (historicoNorm === padraoNorm) score = 100
    } else if (regra.tipo_match === 'fuzzy') {
      // Similaridade de string — aceita variações de nome
      const sim = stringSimilarity.compareTwoStrings(historicoNorm, padraoNorm)
      score = Math.round(sim * 100)

      // Boost se o padrão está contido no histórico (ex: "hospital" dentro de "hospital baia sul")
      if (historicoNorm.includes(padraoNorm) || padraoNorm.includes(historicoNorm.split(' ')[0])) {
        score = Math.min(100, score + 15)
      }
    } else if (regra.tipo_match === 'valor') {
      // Match por faixa de valor + similaridade mínima
      const sim = stringSimilarity.compareTwoStrings(historicoNorm, padraoNorm)
      const dentroFaixa = (!regra.valor_min || valor >= regra.valor_min) &&
                          (!regra.valor_max || valor <= regra.valor_max)
      if (dentroFaixa && sim > 0.3) score = Math.round(sim * 80)
    }

    // Aplica o score histórico da regra como peso
    const scoreAjustado = score * (regra.score / 100)

    if (scoreAjustado > melhorScore && score >= 55) {
      melhorScore = scoreAjustado
      melhorRegra = { ...regra, scoreMatch: Math.round(scoreAjustado) }
    }
  }

  return melhorRegra
}

// Classifica um lançamento: regra > IA > pendente
async function classificarLancamento(escritorioId, lancamento, usarIA = true) {
  const regra = await buscarRegra(
    escritorioId,
    lancamento.historico_normalizado,
    lancamento.valor,
    lancamento.tipo
  )

  if (regra && regra.scoreMatch >= 80) {
    return {
      conta_debito: regra.conta_debito,
      conta_credito: regra.conta_credito,
      regra_id: regra.id,
      origem: 'regra',
      score: regra.scoreMatch
    }
  }

  // Se há regra mas com score baixo, usa como base para a IA
  const contextoRegra = regra
    ? `Existe uma regra similar com score ${regra.scoreMatch}%: D:${regra.conta_debito} C:${regra.conta_credito}`
    : null

  if (usarIA && process.env.ANTHROPIC_API_KEY) {
    const sugestaoIA = await sugerirViaIA(escritorioId, lancamento, contextoRegra)
    if (sugestaoIA) return { ...sugestaoIA, regra_id: regra?.id || null }
  }

  return {
    conta_debito: null,
    conta_credito: null,
    regra_id: null,
    origem: 'pendente',
    score: 0
  }
}

// Sugestão via Claude API
async function sugerirViaIA(escritorioId, lancamento, contextoRegra) {
  try {
    const Anthropic = require('@anthropic-ai/sdk')
    const client = new Anthropic()

    // Busca exemplos de lançamentos similares já classificados
    const exemplos = await db.query(
      `SELECT l.historico_bruto, l.valor, l.tipo, l.conta_debito, l.conta_credito
       FROM lancamentos l
       JOIN extratos e ON e.id = l.extrato_id
       JOIN clientes c ON c.id = e.cliente_id
       WHERE c.escritorio_id = $1
       AND l.status = 'aprovado'
       AND l.conta_debito IS NOT NULL
       ORDER BY l.classificado_em DESC
       LIMIT 20`,
      [escritorioId]
    )

    const exemplosTexto = exemplos.rows
      .map(e => `- "${e.historico_bruto}" (${e.tipo}, R$${e.valor}) → D:${e.conta_debito} C:${e.conta_credito}`)
      .join('\n')

    const prompt = `Você é um assistente de contabilidade brasileiro. Baseado nos lançamentos anteriores classificados, sugira as contas contábeis para o novo lançamento.

LANÇAMENTOS ANTERIORES CLASSIFICADOS:
${exemplosTexto || 'Nenhum exemplo ainda disponível.'}

${contextoRegra ? `REGRA SIMILAR ENCONTRADA: ${contextoRegra}` : ''}

NOVO LANÇAMENTO:
- Histórico: "${lancamento.historico_bruto}"
- Valor: R$ ${lancamento.valor}
- Tipo: ${lancamento.tipo === 'debito' ? 'Débito (saída)' : 'Crédito (entrada)'}

Responda APENAS com JSON no formato:
{"conta_debito": "XXX", "conta_credito": "XXX", "score": 0-100, "motivo": "breve justificativa"}`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }]
    })

    const texto = response.content[0].text.trim()
    const json = JSON.parse(texto.replace(/```json?|```/g, ''))

    return {
      conta_debito: json.conta_debito,
      conta_credito: json.conta_credito,
      origem: 'ia',
      score: json.score || 60,
      motivo: json.motivo
    }
  } catch (e) {
    console.error('Erro na sugestão IA:', e.message)
    return null
  }
}

// Confirma classificação e atualiza score da regra
async function confirmarClassificacao(lancamentoId, contaDebito, contaCredito, usuarioId, escritorioId) {
  const lancamento = await db.query('SELECT * FROM lancamentos WHERE id = $1', [lancamentoId])
  if (!lancamento.rows.length) throw new Error('Lançamento não encontrado')

  const l = lancamento.rows[0]

  await db.query(
    `UPDATE lancamentos SET 
      conta_debito=$1, conta_credito=$2, status='aprovado',
      classificado_por=$3, classificado_em=NOW()
     WHERE id=$4`,
    [contaDebito, contaCredito, usuarioId, lancamentoId]
  )

  // Se tinha regra, incrementa usos e ajusta score
  if (l.regra_id) {
    await db.query(
      `UPDATE regras SET 
        usos = usos + 1,
        score = LEAST(99, score + 1),
        atualizado_em = NOW()
       WHERE id = $1`,
      [l.regra_id]
    )
  } else {
    // Cria nova regra a partir dessa classificação
    const historicoNorm = normalizar(l.historico_bruto)
    const palavrasChave = historicoNorm.split(' ').slice(0, 4).join(' ')

    await db.query(
      `INSERT INTO regras 
        (escritorio_id, padrao, tipo_match, conta_debito, conta_credito, tipo_lancamento, score, usos, criado_por)
       VALUES ($1,$2,'fuzzy',$3,$4,$5,70,1,$6)
       ON CONFLICT DO NOTHING`,
      [escritorioId, palavrasChave, contaDebito, contaCredito, l.tipo, usuarioId]
    )
  }
}

module.exports = { classificarLancamento, confirmarClassificacao, buscarRegra }
