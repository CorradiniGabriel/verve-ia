const pdfParse = require('pdf-parse')

// Normaliza texto para match de regras
function normalizar(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(pix|deb|cred|doc|ted|ib|pgto|transferencia|debito|credito)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Detecta banco pelo conteúdo do PDF
function detectarBanco(texto) {
  if (/unicred/i.test(texto)) return 'unicred'
  if (/banco do brasil|bb\.com/i.test(texto)) return 'bb'
  if (/bradesco/i.test(texto)) return 'bradesco'
  if (/itau/i.test(texto)) return 'itau'
  if (/santander/i.test(texto)) return 'santander'
  if (/caixa/i.test(texto)) return 'caixa'
  if (/sicoob|sicredi/i.test(texto)) return 'cooperativa'
  return 'generico'
}

// Parser Unicred — formato do extrato enviado
function parseUnicred(texto) {
  const lancamentos = []

  // Extrai período
  const periodoMatch = texto.match(/Per[íi]odo de (\d{2}\/\d{2}\/\d{4}) a (\d{2}\/\d{2}\/\d{4})/)
  const periodo = periodoMatch
    ? { inicio: periodoMatch[1], fim: periodoMatch[2] }
    : null

  // Extrai saldo inicial
  const saldoInicialMatch = texto.match(/Saldo em \d{2}\/\d{2}\/\d{4}:\s*R\$\s*([\d.,]+)/)
  const saldoInicial = saldoInicialMatch
    ? parseFloat(saldoInicialMatch[1].replace(/\./g, '').replace(',', '.'))
    : null

  // Extrai conta
  const contaMatch = texto.match(/Conta:\s*(\d+)/)
  const conta = contaMatch ? contaMatch[1] : null

  // Linhas de lançamento: data + descrição + valor + saldo
  // Formato: DD/MM/YYYY DESCRICAO - R$ X.XXX,XX R$ X.XXX,XX
  const linhaRegex = /(\d{2}\/\d{2}\/\d{4})\s+(.*?)\s+([-+]?\s*R\$\s*[\d.,]+)\s+R\$\s*([\d.,]+)/gm
  let match

  while ((match = linhaRegex.exec(texto)) !== null) {
    const [, data, historico, valorStr, saldoStr] = match

    const valorLimpo = valorStr.replace(/R\$|\s/g, '').replace(/\./g, '').replace(',', '.')
    const valor = parseFloat(valorLimpo)
    const saldo = parseFloat(saldoStr.replace(/\./g, '').replace(',', '.'))

    if (isNaN(valor) || isNaN(saldo)) continue

    // Limpa histórico removendo Doc: e partes desnecessárias
    const historicoLimpo = historico
      .replace(/\(\s*Doc\.?:.*?\)/gi, '')
      .replace(/\s+/g, ' ')
      .trim()

    lancamentos.push({
      data: data,
      historico_bruto: historicoLimpo,
      historico_normalizado: normalizar(historicoLimpo),
      valor: Math.abs(valor),
      tipo: valor < 0 ? 'debito' : 'credito',
      saldo_apos: saldo
    })
  }

  return { banco: 'unicred', periodo, saldoInicial, conta, lancamentos }
}

// Parser genérico — tenta extrair lançamentos de qualquer extrato
function parseGenerico(texto) {
  const lancamentos = []

  const linhaRegex = /(\d{2}\/\d{2}\/\d{4})\s+(.{10,100}?)\s+([-]?\s*[\d]+\.[\d]{3},[\d]{2}|[-]?\s*[\d]+,[\d]{2})/gm
  let match

  while ((match = linhaRegex.exec(texto)) !== null) {
    const [, data, historico, valorStr] = match
    const valor = parseFloat(valorStr.replace(/\s/g, '').replace(/\./g, '').replace(',', '.'))

    if (isNaN(valor)) continue

    lancamentos.push({
      data,
      historico_bruto: historico.trim(),
      historico_normalizado: normalizar(historico),
      valor: Math.abs(valor),
      tipo: valor < 0 ? 'debito' : 'credito',
      saldo_apos: null
    })
  }

  return { banco: 'generico', periodo: null, saldoInicial: null, conta: null, lancamentos }
}

async function parsearExtrato(buffer) {
  const data = await pdfParse(buffer)
  const texto = data.text

  const banco = detectarBanco(texto)

  let resultado
  switch (banco) {
    case 'unicred': resultado = parseUnicred(texto); break
    default: resultado = parseGenerico(texto)
  }

  if (!resultado.lancamentos.length) {
    throw new Error(`Nenhum lançamento encontrado. Banco detectado: ${banco}. Verifique se o PDF é um extrato bancário válido.`)
  }

  return resultado
}

module.exports = { parsearExtrato, normalizar }
