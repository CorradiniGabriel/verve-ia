const pdfParse = require('pdf-parse')

// ── Utilitários ───────────────────────────────────────────────────────────────

function normalizar(texto) {
  return texto.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(pix|deb|cred|doc|ted|ib|pgto|transferencia|debito|credito)\b/g, '')
    .replace(/\s+/g, ' ').trim()
}

function lv(v) {
  if (!v) return null
  v = String(v).replace(/\xa0/g, ' ')
  const neg = v.includes('-') || (v.trim().startsWith('(') && v.trim().endsWith(')'))
  const n = parseFloat(v.replace(/[R$\s\-\(\)]/g, '').replace(/\./g, '').replace(',', '.'))
  return isNaN(n) ? null : (neg ? -n : n)
}

function limparHist(h) {
  return h.replace(/\(\s*Doc\.:.*?\)/gis, '').replace(/\s+/g, ' ').trim().replace(/^[\s\-\/]+|[\s\-\/]+$/g, '')
}

function extrairLinhasBrutas(texto) {
  return texto.split('\n').map(l => l.trim()).filter(l => l.length > 5 && /\d/.test(l)).slice(0, 80)
}

const DATA_RE  = /^\d{2}\/\d{2}\/\d{4}$/
const VALOR_RE = /^(-\s*)?R\$\s*[\d.,]+$/

// ── Detecção de banco ─────────────────────────────────────────────────────────

function detectarBanco(texto) {
  if (/unicred/i.test(texto))                return 'unicred'
  if (/btg\s*pactual/i.test(texto))          return 'btg'
  if (/bdigital|b\s*digital/i.test(texto))   return 'bdigital'
  if (/money\s*plus|274-money/i.test(texto)) return 'bmp'
  if (/cora\s*scfi/i.test(texto))            return 'cora'
  if (/nubank|nu\s+financeira|nu\s+pagamentos/i.test(texto)) return 'nubank'
  if (/itau|itaú/i.test(texto))              return 'itau'
  if (/bradesco/i.test(texto))               return 'bradesco'
  if (/banco do brasil|bb\.com/i.test(texto)) return 'bb'
  if (/santander/i.test(texto))              return 'santander'
  if (/caixa/i.test(texto))                  return 'caixa'
  if (/sicoob|sicredi/i.test(texto))         return 'cooperativa'
  if (/tech\.iob\.com\.br|extrato de cr[eé]dito e d[eé]bito/i.test(texto)) return 'iob'
  return 'desconhecido'
}

// ── Parser Unicred / BSP ──────────────────────────────────────────────────────
function parseUnicred(texto) {
  const periodoM = texto.match(/Per[íi]odo de (\d{2}\/\d{2}\/\d{4}) a (\d{2}\/\d{2}\/\d{4})/)
  const periodo  = periodoM ? { inicio: periodoM[1], fim: periodoM[2] } : null
  const saldoM   = texto.match(/Saldo em \d{2}\/\d{2}\/\d{4}:\s*R\$\s*([\d.,]+)/)
  const saldoInicial = saldoM ? parseFloat(saldoM[1].replace(/\./g,'').replace(',','.')) : null
  const contaM   = texto.match(/Conta:\s*(\d+)/)
  const conta    = contaM ? contaM[1] : null

  let linhas = texto.split('\n').map(l => l.trim()).filter(l => l)
  const hi = linhas.findIndex(l => l.includes('Saldo (R$)'))
  if (hi !== -1) linhas = linhas.slice(hi + 1)
  const ri = linhas.findIndex(l => ['CENTRAL DE RELACIONAMENTO','Saldo no final','Lançamentos futuros'].some(m => l.includes(m)))
  if (ri !== -1) linhas = linhas.slice(0, ri)

  const tokens = linhas.map(l => DATA_RE.test(l) ? ['DATA',l] : VALOR_RE.test(l) ? ['VALOR',l] : ['TEXTO',l])
  const allDatas   = tokens.filter(t => t[0]==='DATA').map(t => t[1])
  const allValores = tokens.filter(t => t[0]==='VALOR').map(t => t[1])
  const allTextos  = []
  let buf = []
  for (const [tipo,val] of tokens) {
    if (tipo==='TEXTO') { buf.push(val); if (buf.join(' ').trimEnd().endsWith(')')) { allTextos.push(buf.join(' ')); buf=[] } }
    else if (buf.length) { allTextos.push(buf.join(' ')); buf=[] }
  }
  if (buf.length) allTextos.push(buf.join(' '))

  const pares = []
  for (let i=0; i<allValores.length-1; i+=2) pares.push([allValores[i],allValores[i+1]])

  const n = Math.min(allDatas.length, allTextos.length, pares.length)
  const lancamentos = []
  for (let i=0; i<n; i++) {
    const valor = lv(pares[i][0]); const saldo = lv(pares[i][1])
    const hist  = limparHist(allTextos[i])
    if (valor===null||saldo===null||!hist) continue
    lancamentos.push({ data:allDatas[i], historico_bruto:hist, historico_normalizado:normalizar(hist), valor:Math.abs(valor), tipo:valor<0?'debito':'credito', saldo_apos:saldo })
  }
  return { banco:'unicred', periodo, saldoInicial, conta, lancamentos }
}

// ── Parser IOB ────────────────────────────────────────────────────────────────
function parseIob(texto) {
  const linhas   = texto.split('\n').map(l => l.trim()).filter(l => l)
  const VALOR_IOB = /^\([\d.,]+\)$|^\d{1,3}(?:\.\d{3})*,\d{2}$|^\d+,\d{2}$/
  const idxCd    = linhas.findIndex(l => l==='C/D')
  const idxSep   = linhas.findIndex(l => l.includes('Resumo Geral'))
  const idxTotal = linhas.findIndex(l => l.includes('Total de Créditos'))
  const parte1   = linhas.slice(idxCd+1, idxSep>=0?idxSep:undefined)
  const parte2   = idxSep>=0 ? linhas.slice(idxSep+2, idxTotal>=0?idxTotal:undefined) : []

  const IGNORAR  = new Set(['Conta:','C','D'])
  const datas      = parte1.filter(l => DATA_RE.test(l))
  const historicos = parte1.filter(l => !DATA_RE.test(l) && !l.startsWith('Saldo em') && !IGNORAR.has(l) && !/^BVE|^Conta:/.test(l))
  const n          = datas.length
  const favorecidos= parte2.filter(l => !VALOR_IOB.test(l) && l!=='C' && l!=='D' && !l.includes('Total') && !l.includes('Resumo')).slice(0,n)
  const valoresRaw = parte2.filter(l => VALOR_IOB.test(l))

  const naoParent = valoresRaw.filter(l => !l.startsWith('('))
  const nCreds    = naoParent.length - n - 1
  const saldoIniStr = naoParent[nCreds] || '0'
  const saldoIni  = parseFloat(saldoIniStr.replace(/\./g,'').replace(',','.'))
  const saldos    = naoParent.slice(nCreds+1)
  const saldoSeq  = [saldoIni, ...saldos.map(s => parseFloat(s.replace(/\./g,'').replace(',','.')))]

  const periodoM  = texto.match(/Período: de (\d{2}\/\d{2}\/\d{4}) até (\d{2}\/\d{2}\/\d{4})/)
  const periodo   = periodoM ? { inicio:periodoM[1], fim:periodoM[2] } : null
  const contaM    = texto.match(/Conta:\s*(.+)/)
  const conta     = contaM ? contaM[1].trim() : null

  const lancamentos = []
  for (let i=0; i<n; i++) {
    const sCurr = saldoSeq[i+1]; if (sCurr===undefined||isNaN(sCurr)) continue
    const dif   = Math.round((sCurr-saldoSeq[i])*100)/100
    const hist  = (historicos[i]||'').trim()
    const fav   = (favorecidos[i]||'').trim()
    const desc  = fav ? `${hist} - ${fav}`.replace(/\s+-\s*$/,'') : hist
    if (!desc) continue
    lancamentos.push({ data:datas[i], historico_bruto:desc, historico_normalizado:normalizar(desc), valor:Math.abs(dif), tipo:dif<0?'debito':'credito', saldo_apos:sCurr })
  }
  return { banco:'iob', periodo, saldoInicial:saldoIni, conta, lancamentos }
}

// ── Parser BDigital ───────────────────────────────────────────────────────────
function parseBdigital(texto) {
  const linhas   = texto.split('\n').map(l => l.trim()).filter(l => l)
  const VALOR_BD = /^-?R\$\s*[\d.,]+$/
  const hi       = linhas.findIndex(l => l.includes('Lançamento (R$)'))
  const fi       = linhas.findIndex(l => l.includes('Totais do Período'))
  const bloco    = linhas.slice(hi+1, fi>=0?fi:undefined)

  const saldoAntM = texto.match(/Saldo Anterior\s*R\$\s*([\d.,]+)/)
  const saldoInicial = saldoAntM ? parseFloat(saldoAntM[1].replace(/\./g,'').replace(',','.')) : null
  const periodoM = texto.match(/Data Inicial:\s*(\d{2}\/\d{2}\/\d{4}).*?Data Final:\s*(\d{2}\/\d{2}\/\d{4})/s)
  const periodo  = periodoM ? { inicio:periodoM[1], fim:periodoM[2] } : null
  const contaM   = texto.match(/Conta ESCROW:\s*([\d-]+)/)
  const conta    = contaM ? contaM[1] : null

  const NDOC_RE  = /^[\d-]{6,}$|^[A-Z]{2,}\s+[A-Z]{2,}$/
  const lancamentos = []
  let i = 0
  while (i < bloco.length) {
    if (!DATA_RE.test(bloco[i])) { i++; continue }
    const data = bloco[i]; i++
    if (i < bloco.length && NDOC_RE.test(bloco[i])) i++
    const histParts = []
    while (i < bloco.length && !VALOR_BD.test(bloco[i]) && !DATA_RE.test(bloco[i])) { histParts.push(bloco[i]); i++ }
    const lancStr = bloco[i]; i++; const saldoStr = bloco[i]; i++
    const valor = lv(lancStr); const saldo = lv(saldoStr)
    const hist  = histParts.join(' ').trim()
    if (valor===null||!hist) continue
    lancamentos.push({ data, historico_bruto:hist, historico_normalizado:normalizar(hist), valor:Math.abs(valor), tipo:valor<0?'debito':'credito', saldo_apos:saldo })
  }
  return { banco:'bdigital', periodo, saldoInicial, conta, lancamentos }
}

// ── Parser BMP (Money Plus) ───────────────────────────────────────────────────
function parseBmp(texto) {
  const linhas   = texto.split('\n').map(l => l.trim()).filter(l => l)
  const VALOR_BMP = /^R\$\s*[\d.,]+$/
  const hi       = linhas.findIndex(l => l==='Crédito' && linhas[linhas.indexOf(l)+1]==='Débito')
  const fi       = linhas.findIndex(l => l.includes('Saldo atual'))
  const bloco    = linhas.slice(hi+2, fi>=0?fi:undefined)

  const periodoM = texto.match(/Período:\s*(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/)
  const periodo  = periodoM ? { inicio:periodoM[1], fim:periodoM[2] } : null
  const contaM   = texto.match(/Conta:\s*([\d-]+)/)
  const conta    = contaM ? contaM[1] : null

  const DATA_BMP = /^\d{2}\/\d{2}\/\d{4}$/
  const DASH_RE  = /^-$/
  const lancamentos = []
  let i = 0
  while (i < bloco.length) {
    if (!DATA_BMP.test(bloco[i])) { i++; continue }
    const data = bloco[i]; i++
    const desc = bloco[i]; i++
    const compParts = []
    while (i < bloco.length && !VALOR_BMP.test(bloco[i]) && !DASH_RE.test(bloco[i]) && !DATA_BMP.test(bloco[i])) { compParts.push(bloco[i]); i++ }
    const credStr = bloco[i]; i++; const debStr = bloco[i]; i++
    const isCredito = VALOR_BMP.test(credStr) && DASH_RE.test(debStr)
    const valorStr  = isCredito ? credStr : debStr
    const valor = lv(valorStr.replace('R$','').trim())
    if (valor===null) continue
    const hist = `${desc} ${compParts.join(' ')}`.trim()
    lancamentos.push({ data, historico_bruto:hist, historico_normalizado:normalizar(hist), valor:Math.abs(valor), tipo:isCredito?'credito':'debito', saldo_apos:null })
  }
  return { banco:'bmp', periodo, saldoInicial:null, conta, lancamentos }
}

// ── Parser Cora ───────────────────────────────────────────────────────────────
function parseCora(texto) {
  const linhas   = texto.split('\n').map(l => l.trim()).filter(l => l)
  const SALDO_DIA = /^Saldo do dia R\$/
  const periodoM = texto.match(/(\d{2}\/\d{2}\/\d{4})\s*a\s*(\d{2}\/\d{2}\/\d{4})/)
  const periodo  = periodoM ? { inicio:periodoM[1], fim:periodoM[2] } : null
  const saldoIniM = texto.match(/Saldo inicial disponível\s*R\$\s*([\d.,]+)/)
  const saldoInicial = saldoIniM ? parseFloat(saldoIniM[1].replace(/\./g,'').replace(',','.')) : null
  const contaM   = texto.match(/Conta:\s*([\d-]+)/)
  const conta    = contaM ? contaM[1] : null

  const lancamentos = []
  let dataAtual = null
  let i = 0
  while (i < linhas.length) {
    const l = linhas[i]
    if (DATA_RE.test(l)) { dataAtual = l; i++; continue }
    if (SALDO_DIA.test(l)) { i++; continue }
    const cnpj = linhas[i+1] || ''
    const valorLinha = linhas[i+2] || ''
    const m = valorLinha.match(/^([+\-])\s*R\$\s*([\d.,]+)$/)
    if (m && dataAtual && !SALDO_DIA.test(l) && !DATA_RE.test(l) && !/^(Saldo|Total|Extrato|Andrade|CNPJ|Agência|Cora|Ouvidoria|pág)/.test(l)) {
      const valor = parseFloat(m[2].replace(/\./g,'').replace(',','.'))
      const hist  = `${l} ${cnpj}`.trim()
      lancamentos.push({ data:dataAtual, historico_bruto:hist, historico_normalizado:normalizar(hist), valor, tipo:m[1]==='+'?'credito':'debito', saldo_apos:null })
      i+=3; continue
    }
    i++
  }
  return { banco:'cora', periodo, saldoInicial, conta, lancamentos }
}

// ── Parser Nubank ─────────────────────────────────────────────────────────────
function parseNubank(texto) {
  const MESES = {JAN:1,FEV:2,MAR:3,ABR:4,MAI:5,JUN:6,JUL:7,AGO:8,SET:9,OUT:10,NOV:11,DEZ:12}
  const linhas = texto.split('\n').map(l => l.trim()).filter(l => l)
  const DATA_NU  = /^(\d{2}) ([A-Z]{3}) (\d{4})$/
  const VALOR_PU = /^\d{1,3}(?:\.\d{3})*,\d{2}$|\d+,\d{2}$/
  const VALOR_AS = /^[+\-]\s*[\d.,]+$/
  const STOP     = new Set(['Saldo do dia','Total de saídas','Total de entradas','Movimentações','Saldo inicial','Rendimento líquido','Saldo final do período','VALORES EM R$'])

  const hi = linhas.findIndex(l => l==='Movimentações'); const fi = linhas.findIndex(l => l.includes('Tem alguma dúvida'))
  const bloco = linhas.slice(hi+1, fi>=0?fi:undefined)
  const periodoM = texto.match(/(\d{2} [A-Z]{3} \d{4})\s*a\s*(\d{2} [A-Z]{3} \d{4})/)
  const saldoIniM = texto.match(/Saldo inicial\s+([\d.,]+)/)
  const saldoInicial = saldoIniM ? parseFloat(saldoIniM[1].replace(/\./g,'').replace(',','.')) : null

  const lancamentos = []
  let dataAtual = null
  let i = 0
  while (i < bloco.length) {
    const l = bloco[i]
    const mData = l.match(DATA_NU)
    if (mData) { const mes=MESES[mData[2]]||1; dataAtual=`${mData[1]}/${String(mes).padStart(2,'0')}/${mData[3]}`; i++; continue }

    if (/^Transferência (enviada|recebida)/.test(l) && dataAtual) {
      const tipo = l.includes('enviada') ? 'debito' : 'credito'
      const descParts = [l]
      let j = i+1
      while (j < bloco.length && !STOP.has(bloco[j]) && !DATA_NU.test(bloco[j]) && !VALOR_PU.test(bloco[j]) && !VALOR_AS.test(bloco[j])) {
        descParts.push(bloco[j]); j++
      }
      // Tenta valor puro imediato
      let valor = null
      if (j < bloco.length && VALOR_PU.test(bloco[j])) { valor = parseFloat(bloco[j].replace(/\./g,'').replace(',','.')); j++ }
      // Fallback: busca total assinado próximo
      if (valor === null) {
        for (let k=j; k<Math.min(j+8,bloco.length); k++) {
          if (VALOR_AS.test(bloco[k])) { valor = Math.abs(parseFloat(bloco[k].replace(/[\s+\-]/g,'').replace(/\./g,'').replace(',','.'))); break }
        }
      }
      if (valor !== null) {
        const hist = descParts.join(' ')
        lancamentos.push({ data:dataAtual, historico_bruto:hist, historico_normalizado:normalizar(hist), valor, tipo, saldo_apos:null })
      }
      i=j; continue
    }
    i++
  }

  const contaM = texto.match(/Conta\s+([\d-]+)/)
  return { banco:'nubank', periodo:null, saldoInicial, conta:contaM?contaM[1]:null, lancamentos }
}

// ── Parser Itaú (todos os formatos) ──────────────────────────────────────────
// Cobre 3 layouts: (1) tabela online com SALDO TOTAL DISPONÍVEL DIA
//                  (2) extrato mensal papel com datas "DD/MM" e "XXX-"
//                  (3) extrato Empresas com datas "DD / jul"
function parseItau(texto) {
  texto = texto.replace(/\xa0/g, ' ')
  const linhas = texto.split('\n').map(l => l.trim()).filter(l => l)
  const VALOR_IT = /^-?[\d]{1,3}(?:\.[\d]{3})*,[\d]{2}$|^-?\d+,\d{2}$/
  const DATA_FULL = /^\d{2}\/\d{2}\/\d{4}$/
  const DATA_SHORT = /^\d{2}\/\d{2}$/           // extrato mensal papel
  const DATA_SLASH = /^\d{2}\s*\/\s*\w{3}$/     // extrato Empresas "02 / jul"

  const periodoM = texto.match(/(\d{2}\/\d{2}\/\d{4})\s*(?:até|a)\s*(\d{2}\/\d{2}\/\d{4})/) ||
                   texto.match(/Lançamentos do período:\s*(\d{2}\/\d{2}\/\d{4})\s*até\s*(\d{2}\/\d{2}\/\d{4})/)
  const periodo  = periodoM ? { inicio:periodoM[1], fim:periodoM[2] } : null
  const contaM   = texto.match(/[Cc]onta\s+(?:corrente\s+)?([\d-]+)/)
  const conta    = contaM ? contaM[1] : null

  const SALDO_DIA = /^SALDO TOTAL DISPONÍVEL DIA$/
  const IGNORAR   = new Set(['SALDO ANTERIOR','SALDO TOTAL DISPONÍVEL DIA','Data','Lançamentos',
    'Razão Social','CNPJ/CPF','Valor (R$)','Saldo (R$)','aviso:','atualizado em',
    'Saldo total','Limite da conta','Utilizado','Disponível','Lançamentos do período',
    'data','descrição','entradas R$','(créditos)','saídas R$','(débitos)','saldo  R$',
    'Saldo anterior','Saldo em C/C','Saldo final','Conta Corrente | Movimentação'])

  // Layout 1: tabela online (SALDO TOTAL DISPONÍVEL DIA)
  if (/SALDO TOTAL DISPONÍVEL DIA/.test(texto)) {
    const idxIni = linhas.findIndex(l => l==='Data')
    const idxFim = linhas.findIndex(l => l.includes('Os saldos acima') || l==='aviso:')
    const bloco  = linhas.slice(idxIni, idxFim>=0?idxFim:undefined)

    const idxRazao = bloco.findIndex(l => l==='Razão Social')
    const idxTotal = bloco.findIndex(l => l.includes('Total de Créditos') || l.includes('Resumo Geral'))

    const parte1 = bloco.slice(0, idxRazao>=0?idxRazao:undefined)
    const parte2 = bloco.slice(idxRazao>=0?idxRazao:0, idxTotal>=0?idxTotal:undefined)

    const datas      = parte1.filter(l => DATA_FULL.test(l))
    const historicos = parte1.filter(l => !DATA_FULL.test(l) && !IGNORAR.has(l) && !l.startsWith('Saldo em') && !/^R\$/.test(l))
    const n          = datas.length
    const CNPJ_RE    = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$|^\d{3}\.\d{3}\.\d{3}-\d{2}$/
    const favorecidos= parte2.filter(l => !VALOR_IT.test(l) && l!=='C' && l!=='D' && !IGNORAR.has(l) && !CNPJ_RE.test(l)).slice(0,n)
    const valores    = parte2.filter(l => VALOR_IT.test(l))
    const naoNeg     = valores.filter(l => !l.startsWith('-'))
    const nCreds     = naoNeg.length - n - 1
    const saldoIniStr = naoNeg[nCreds] || '0'
    const saldoIni   = parseFloat(saldoIniStr.replace(/\./g,'').replace(',','.'))
    const saldos     = naoNeg.slice(nCreds+1)
    const saldoSeq   = [saldoIni, ...saldos.map(s => parseFloat(s.replace(/\./g,'').replace(',','.')))]

    const lancamentos = []
    for (let i=0; i<Math.min(n,saldoSeq.length-1); i++) {
      const dif  = Math.round((saldoSeq[i+1]-saldoSeq[i])*100)/100
      const hist = (historicos[i]||'').trim()
      const fav  = (favorecidos[i]||'').trim()
      const desc = fav ? `${hist} ${fav}`.trim() : hist
      if (!desc||Math.abs(dif)<0.001) continue
      lancamentos.push({ data:datas[i], historico_bruto:desc, historico_normalizado:normalizar(desc), valor:Math.abs(dif), tipo:dif<0?'debito':'credito', saldo_apos:saldoSeq[i+1] })
    }

    const saldoIniM = texto.match(/SALDO ANTERIOR\s+([\d.,]+)/)
    const saldoInicial = saldoIniM ? parseFloat(saldoIniM[1].replace(/\./g,'').replace(',','.')) : saldoIni
    return { banco:'itau', periodo, saldoInicial, conta, lancamentos }
  }

  // Layout 2: extrato mensal papel (datas DD/MM, valores com "-" no final)
  if (/extrato mensal/i.test(texto)) {
    const hi = linhas.findIndex(l => l==='Conta Corrente | Movimentação')
    const fi = linhas.findIndex(l => l.includes('Este material'))
    const bloco = linhas.slice(hi>=0?hi+1:0, fi>=0?fi:undefined)

    const anoM = texto.match(/(\w{3}) (\d{4})/)
    const MESES2 = {jan:1,fev:2,mar:3,abr:4,mai:5,jun:6,jul:7,ago:8,set:9,out:10,nov:11,dez:12}
    const ano = anoM ? parseInt(anoM[2]) : new Date().getFullYear()
    const mes = anoM ? (MESES2[anoM[1].toLowerCase()]||1) : 1

    const datas  = bloco.filter(l => DATA_SHORT.test(l) && l!=='30/12')
    const descs  = bloco.filter(l => !DATA_SHORT.test(l) && !VALOR_IT.test(l) && !/^[\d.,]+-$/.test(l) && !IGNORAR.has(l) && !/^\d+$/.test(l) && !/^[A-Z] =/.test(l) && !l.startsWith('Para demais') && !l.startsWith('Explicativas'))
    const vals   = bloco.filter(l => /^[\d.,]+-$/.test(l) || (VALOR_IT.test(l) && l!=='0,00'))

    const lancamentos = []
    for (let i=0; i<Math.min(datas.length,descs.length,vals.length); i++) {
      const vStr = vals[i]; const neg = vStr.endsWith('-')
      const v = parseFloat(vStr.replace('-','').replace(/\./g,'').replace(',','.'))
      if (isNaN(v)) continue
      const data = `${datas[i]}/${ano}`
      lancamentos.push({ data, historico_bruto:descs[i], historico_normalizado:normalizar(descs[i]), valor:v, tipo:neg?'debito':'credito', saldo_apos:null })
    }
    const saldoIniM = texto.match(/saldo em \d{2}\/\d{2}\/\d{2}\s*R\$\s*([\d.,]+)/i)
    const saldoInicial = saldoIniM ? parseFloat(saldoIniM[1].replace(/\./g,'').replace(',','.')) : null
    return { banco:'itau', periodo, saldoInicial, conta, lancamentos }
  }

  // Layout 3: Itaú Empresas online (datas "DD / jul", valores sem sinal visível)
  const MESES3 = {jan:1,fev:2,mar:3,abr:4,mai:5,jun:6,jul:7,ago:8,set:9,out:10,nov:11,dez:12}
  const hi = linhas.findIndex(l => /lançamentos/i.test(l) && /período/i.test(l))
  const fi = linhas.findIndex(l => /saldo da conta/i.test(l))
  const bloco = linhas.slice(hi>=0?hi+1:0, fi>=0?fi:undefined)
  const anoAtual = new Date().getFullYear()
  const HEADER_MES = /^(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+(\d{4})$/i
  let anoLoop = anoAtual; let mesLoop = 1

  const lancamentos = []
  for (let i=0; i<bloco.length; i++) {
    const l = bloco[i]
    const hm = l.match(HEADER_MES)
    if (hm) { anoLoop=parseInt(hm[2]); mesLoop=MESES3[hm[1].toLowerCase().substring(0,3)]||1; continue }
    const mData = l.match(/^(\d{2})\s*\/\s*(\w{3})$/)
    if (mData) {
      const dia = mData[1]; const mesStr = mData[2].toLowerCase().substring(0,3)
      const mes = MESES3[mesStr]||mesLoop
      const data = `${dia}/${String(mes).padStart(2,'0')}/${anoLoop}`
      const hist = bloco[i+1]||''
      if (/SALDO TOTAL DISPONÍVEL/i.test(hist)||hist==='SALDO ANTERIOR') continue
      let j = i+2
      if (/^\d{4}$/.test(bloco[j]||'')) j++ // pula ag/origem
      const valorStr = bloco[j]||''
      const valor = parseFloat(valorStr.replace(/\./g,'').replace(',','.'))
      if (isNaN(valor)||!hist) continue
      lancamentos.push({ data, historico_bruto:hist, historico_normalizado:normalizar(hist), valor:Math.abs(valor), tipo:valor<0?'debito':'credito', saldo_apos:null })
      i=j
    }
  }
  const saldoAntM = texto.match(/SALDO ANTERIOR\s+([\d.,]+)/i) || texto.match(/saldo em.*?(\d{1,3}(?:\.\d{3})*,\d{2})/i)
  const saldoInicial = saldoAntM ? parseFloat(saldoAntM[1].replace(/\./g,'').replace(',','.')) : null
  return { banco:'itau', periodo, saldoInicial, conta, lancamentos }
}

// ── Parser Bradesco Net Empresa ───────────────────────────────────────────────
function parseBradesco(texto) {
  const linhas  = texto.split('\n').map(l => l.trim()).filter(l => l)
  const VALOR_BR = /^-?[\d]{1,3}(?:\.[\d]{3})*,[\d]{2}$|^-?\d+,\d{2}$/
  const DCTO_RE  = /^\d{6,8}$/
  const DATA_RE2 = /^\d{2}\/\d{2}\/\d{4}$/
  const periodoM = texto.match(/Entre\s+(\d{2}\/\d{2}\/\d{4})\s+e\s+(\d{2}\/\d{2}\/\d{4})/)
  const periodo  = periodoM ? { inicio:periodoM[1], fim:periodoM[2] } : null
  const contaM   = texto.match(/CC:\s*([\d-]+)/)
  const conta    = contaM ? contaM[1] : null

  function processarFolha(bloco, saldoIniStr) {
    const datas   = bloco.filter(l => DATA_RE2.test(l))
    const textos  = bloco.filter(l => !DATA_RE2.test(l) && !VALOR_BR.test(l) && !DCTO_RE.test(l) && !/^(Folha|Total|Os dados|Últimos|Data|Lançamento|Dcto|Crédito|Débito|Saldo|SALDO ANTERIOR|Extrato|Saldos Invest|Histórico|Valor)/.test(l))
    const valores = bloco.filter(l => VALOR_BR.test(l))
    const positivos = valores.filter(l => !l.startsWith('-'))
    const n = datas.length
    const nCreds = positivos.length - n - 1
    const saldoIni = parseFloat((saldoIniStr||positivos[nCreds]||'0').replace(/\./g,'').replace(',','.'))
    const saldos  = positivos.slice(nCreds+1)
    const saldoSeq = [saldoIni, ...saldos.map(s => parseFloat(s.replace(/\./g,'').replace(',','.')))]
    const descs = []
    for (let i=0; i<textos.length-1; i+=2) descs.push(`${textos[i]} ${textos[i+1]}`.trim())
    if (textos.length%2!==0) descs.push(textos[textos.length-1])
    const lans = []
    for (let i=0; i<Math.min(n,saldoSeq.length-1); i++) {
      const dif = Math.round((saldoSeq[i+1]-saldoSeq[i])*100)/100
      const hist = descs[i]||''
      if (!hist||Math.abs(dif)<0.001) continue
      lans.push({ data:datas[i], historico_bruto:hist, historico_normalizado:normalizar(hist), valor:Math.abs(dif), tipo:dif<0?'debito':'credito', saldo_apos:saldoSeq[i+1] })
    }
    return lans
  }

  const idxF1 = linhas.findIndex(l => l==='Folha 1/2')
  const idxSep = linhas.findIndex(l => l==='Últimos Lançamentos')
  const idxFim1 = linhas.findIndex((l,i) => i>idxF1 && l.startsWith('Total') && VALOR_BR.test(linhas[i+1]||''))
  const bloco1 = linhas.slice(idxF1>=0?idxF1+1:0, idxFim1>=0?idxFim1:undefined)
  const saldoAntM = texto.match(/SALDO ANTERIOR.*?([\d.,]+)/s)
  const lancamentos = processarFolha(bloco1, null)

  if (idxSep >= 0) {
    const idxFim2 = linhas.findIndex((l,i) => i>idxSep && l.startsWith('Total') && VALOR_BR.test(linhas[i+1]||''))
    const bloco2 = linhas.slice(idxSep+1, idxFim2>=0?idxFim2:undefined)
    const sIni2 = lancamentos.length ? lancamentos[lancamentos.length-1].saldo_apos : null
    lancamentos.push(...processarFolha(bloco2, sIni2?String(sIni2).replace('.',','):null))
  }

  const saldoIniM = texto.match(/SALDO ANTERIOR.*?\n.*?([\d.,]+)/s)
  const saldoInicial = saldoIniM ? parseFloat(saldoIniM[1].replace(/\./g,'').replace(',','.')) : null
  return { banco:'bradesco', periodo, saldoInicial, conta, lancamentos }
}

// ── Parser BTG Pactual ────────────────────────────────────────────────────────
function parseBtg(texto) {
  const linhas  = texto.split('\n').map(l => l.trim()).filter(l => l)
  const VALOR_BT = /^-?[\d.,]+$/
  const periodoM = texto.match(/Período do extrato:\s*(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/)
  const periodo  = periodoM ? { inicio:periodoM[1], fim:periodoM[2] } : null
  const saldoAntM = texto.match(/Saldo de abertura em[^R]*R\$\s*([\d.,]+)/)
  const saldoInicial = saldoAntM ? parseFloat(saldoAntM[1].replace(/\./g,'').replace(',','.')) : null
  const contaM   = texto.match(/Conta\s+([\d]+)/)
  const conta    = contaM ? contaM[1] : null
  const IGNORAR_BT = new Set(['Data lançamento','Descrição do lançamento','Entradas / Saídas (R$)','Saldo (R$)','Saldo de fechamento','Saldo de abertura'])

  const hi = linhas.findIndex(l => l.includes('02. Lançamentos')||l==='Lançamentos')
  const fi = linhas.findIndex(l => l.includes('Fale com nossa central')||l.includes('Total de entradas'))
  const bloco = linhas.slice(hi>=0?hi+1:0, fi>=0?fi:undefined).filter(l => !IGNORAR_BT.has(l))

  const lancamentos = []
  let i = 0
  while (i < bloco.length) {
    if (!DATA_RE.test(bloco[i])) { i++; continue }
    const data = bloco[i]; i++
    const histParts = []
    while (i < bloco.length && !VALOR_BT.test(bloco[i]) && !DATA_RE.test(bloco[i])) { histParts.push(bloco[i]); i++ }
    const valorStr = bloco[i]; i++; const saldoStr = bloco[i]; i++
    const valor = parseFloat((valorStr||'').replace(/\./g,'').replace(',','.'))
    const saldo = parseFloat((saldoStr||'').replace(/\./g,'').replace(',','.'))
    const hist  = histParts.join(' ').trim()
    if (isNaN(valor)||!hist) continue
    lancamentos.push({ data, historico_bruto:hist, historico_normalizado:normalizar(hist), valor:Math.abs(valor), tipo:valor<0?'debito':'credito', saldo_apos:isNaN(saldo)?null:saldo })
  }
  return { banco:'btg', periodo, saldoInicial, conta, lancamentos }
}

// ── Parser genérico melhorado ─────────────────────────────────────────────────
// Tenta 3 estratégias em cascata e usa a que extrair mais lançamentos válidos.
// Cobre bancos sem parser dedicado: Inter, C6, Sicoob, BB, Caixa, Santander, etc.
//
// Estratégia 1 (seq)      — DATA sozinha → descrição(1-8 linhas) → VALOR
// Estratégia 2 (inline)   — DATA + DESCRIÇÃO + VALOR na mesma linha
// Estratégia 3 (assinado) — valores +/- com data anterior mais próxima
function parseGenerico(texto) {
  texto = texto.replace(/\xa0/g, ' ')
  const linhas = texto.split('\n').map(l => l.trim()).filter(l => l)

  const DATA_RE    = /^\d{2}\/\d{2}\/\d{4}$/
  const VALOR_RE   = /^-?\s*R?\$?\s*[\d]{1,3}(?:\.[\d]{3})*,[\d]{2}$|^-?\s*\d+,\d{2}$/
  const VALOR_AS   = /^[+\-]\s*R?\$?\s*[\d.,]+$/
  const SALDO_LN   = /^R\$\s*[\d.,]+$|^[\d]{1,3}\.[\d]{3},[\d]{2}$/
  const SALDO_CONT = /\b(saldo|limite|disponível|bloqueado|aplicação|rendimento|fechamento|abertura)\b/i
  const CABEC_RE   = /^(Data|Lançamento|Histórico|Saldo|Total|Conta|Período|Agência|CNPJ|Crédito|Débito|Valor|Favorecido|Razão Social|Doc\.|Folha|Extrato gerado|Pág|Page|atualizado|aviso:|Em caso|Este material)/i
  const RODAPE_RE  = /central de relacionamento|sac:|ouvidoria|0800|em caso de dúvidas|fale conosco|www\./i
  const CNPJ_RE    = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$|^\d{3}\.\d{3}\.\d{3}-\d{2}$/

  function fv(v) {
    v = String(v).trim()
    const neg = v.includes('-') || (v.startsWith('(') && v.endsWith(')'))
    v = v.replace(/[R$\s+\-()\u00a0]/g, '').replace(/\./g, '').replace(',', '.')
    const n = parseFloat(v)
    return isNaN(n) ? null : (neg ? -n : n)
  }

  function ehLixo(s) {
    return (!s || s.length < 3 || SALDO_LN.test(s) || SALDO_CONT.test(s) ||
            CABEC_RE.test(s) || RODAPE_RE.test(s) || CNPJ_RE.test(s) ||
            DATA_RE.test(s) || /^\d+$/.test(s) || /^\d{2}\/\d{2}$/.test(s))
  }

  function filtrar(lans) {
    const vistos = new Set(); const unicos = []
    for (const l of lans) {
      if (l.valor <= 0.005 || ehLixo(l.historico_bruto)) continue
      const ch = `${l.data}|${l.valor.toFixed(2)}|${l.tipo}`
      if (!vistos.has(ch)) { vistos.add(ch); unicos.push(l) }
    }
    return unicos
  }

  // Localiza início/fim do bloco de lançamentos
  let idxIni = 0
  for (let i = 0; i < linhas.length; i++) { if (DATA_RE.test(linhas[i])) { idxIni = i; break } }
  let idxFim = linhas.length
  for (let i = linhas.length - 1; i > idxIni; i--) { if (RODAPE_RE.test(linhas[i])) { idxFim = i; break } }
  const bloco = linhas.slice(idxIni, idxFim)

  // ── Estratégia 1: DATA → texto(s) → VALOR ──────────────────────────────
  const t1 = []
  for (let i = 0; i < bloco.length; i++) {
    if (!DATA_RE.test(bloco[i])) continue
    const data = bloco[i]; const descParts = []
    for (let j = i + 1; j < Math.min(i + 10, bloco.length); j++) {
      const l = bloco[j]
      if (DATA_RE.test(l)) break
      if (VALOR_RE.test(l)) {
        const v = fv(l)
        if (v !== null && Math.abs(v) > 0.005) {
          const hist = descParts.filter(p => !ehLixo(p)).join(' ')
          if (hist) t1.push({ data, historico_bruto: hist, historico_normalizado: normalizar(hist), valor: Math.abs(v), tipo: v < 0 ? 'debito' : 'credito', saldo_apos: null })
        }
        break
      }
      if (!CABEC_RE.test(l) && !RODAPE_RE.test(l) && !SALDO_LN.test(l)) descParts.push(l)
    }
  }

  // ── Estratégia 2: linha única DATA DESCRIÇÃO VALOR ──────────────────────
  const t2 = []
  const re2 = /(\d{2}\/\d{2}\/\d{4})\s+(.{5,80}?)\s+(-?\s*R?\$?\s*[\d]+\.[\d]{3},[\d]{2}|-?\s*R?\$?\s*[\d]+,[\d]{2})(?:\s+[-R$\d.,]+)?$/gm
  let m
  while ((m = re2.exec(texto)) !== null) {
    const hist = m[2].trim()
    if (ehLixo(hist)) continue
    const v = fv(m[3])
    if (v === null || Math.abs(v) < 0.005) continue
    t2.push({ data: m[1], historico_bruto: hist, historico_normalizado: normalizar(hist), valor: Math.abs(v), tipo: v < 0 ? 'debito' : 'credito', saldo_apos: null })
  }

  // ── Estratégia 3: valores assinados (+/-) com data anterior ─────────────
  const t3 = []
  let dataAtual = null; let descBuf = []
  for (const l of bloco) {
    if (DATA_RE.test(l)) { dataAtual = l; descBuf = [] }
    else if (VALOR_AS.test(l) && dataAtual) {
      const v = fv(l)
      if (v !== null && Math.abs(v) > 0.005) {
        const histParts = descBuf.filter(p => !ehLixo(p))
        if (histParts.length) {
          const hist = histParts.slice(-2).join(' ')
          t3.push({ data: dataAtual, historico_bruto: hist, historico_normalizado: normalizar(hist), valor: Math.abs(v), tipo: v < 0 ? 'debito' : 'credito', saldo_apos: null })
        }
      }
      descBuf = []
    } else if (!CABEC_RE.test(l) && !SALDO_LN.test(l)) descBuf.push(l)
  }

  // Usa o resultado com mais lançamentos válidos
  const candidatos = [filtrar(t1), filtrar(t2), filtrar(t3)]
  const melhor = candidatos.reduce((a, b) => b.length > a.length ? b : a)
  return { banco: 'desconhecido', periodo: null, saldoInicial: null, conta: null, lancamentos: melhor }
}

// ── Entry point ───────────────────────────────────────────────────────────────
async function parsearExtrato(buffer, opcoes = {}) {
  const data  = await pdfParse(buffer)
  const texto = data.text
  const banco = opcoes.forcarBanco || detectarBanco(texto)

  let resultado
  switch (banco) {
    case 'unicred':  resultado = parseUnicred(texto);  break
    case 'iob':      resultado = parseIob(texto);      break
    case 'bdigital': resultado = parseBdigital(texto); break
    case 'bmp':      resultado = parseBmp(texto);      break
    case 'cora':     resultado = parseCora(texto);     break
    case 'nubank':   resultado = parseNubank(texto);   break
    case 'itau':     resultado = parseItau(texto);     break
    case 'bradesco': resultado = parseBradesco(texto); break
    case 'btg':      resultado = parseBtg(texto);      break
    default:         resultado = parseGenerico(texto)
  }

  if (!resultado.lancamentos.length) {
    return {
      banco, bancoDetectado: banco !== 'desconhecido',
      requer_revisao_manual: true,
      texto_bruto_preview: texto.substring(0, 2000),
      linhas_brutas: extrairLinhasBrutas(texto),
      periodo: null, saldoInicial: null, conta: null, lancamentos: []
    }
  }
  return { ...resultado, requer_revisao_manual: false, bancoDetectado: true }
}

module.exports = { parsearExtrato, normalizar }
