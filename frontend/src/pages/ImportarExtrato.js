import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'

const BANCOS_SUPORTADOS = [
  { value: 'unicred', label: 'Unicred' },
  { value: 'bb', label: 'Banco do Brasil' },
  { value: 'bradesco', label: 'Bradesco' },
  { value: 'itau', label: 'Itaú' },
  { value: 'santander', label: 'Santander' },
  { value: 'caixa', label: 'Caixa Econômica Federal' },
  { value: 'cooperativa', label: 'Sicoob / Sicredi' },
  { value: 'outro', label: 'Outro banco' },
]

export default function ImportarExtrato() {
  const [clientes, setClientes] = useState([])
  const [clienteId, setClienteId] = useState('')
  const [arquivo, setArquivo] = useState(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  // Estado do modo de revisão manual (banco não reconhecido)
  const [modoManual, setModoManual] = useState(false)
  const [resultadoParcial, setResultadoParcial] = useState(null)
  const [bancoManual, setBancoManual] = useState('')
  const [bancoManualTexto, setBancoManualTexto] = useState('')
  const [reprocessando, setReprocessando] = useState(false)

  const nav = useNavigate()

  useEffect(() => {
    api.get('/clientes').then(r => setClientes(r.data))
  }, [])

  const importar = async e => {
    e.preventDefault()
    if (!arquivo || !clienteId) return setErro('Selecione o cliente e o arquivo')
    setErro('')
    setLoading(true)
    setModoManual(false)
    setResultadoParcial(null)

    const form = new FormData()
    form.append('extrato', arquivo)
    form.append('clienteId', clienteId)

    try {
      const { data } = await api.post('/extratos/importar', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      // Sucesso normal — vai para revisão
      if (!data.requer_revisao_manual) {
        nav(`/revisao/${data.extratoId}`)
        return
      }

      // Banco não reconhecido ou zero lançamentos — modo revisão manual
      setResultadoParcial(data)
      setBancoManual(data.banco !== 'desconhecido' ? data.banco : '')
      setModoManual(true)

    } catch (e) {
      setErro(e.response?.data?.erro || 'Erro ao processar extrato')
    } finally {
      setLoading(false)
    }
  }

  // Usuário selecionou o banco manualmente — reprocessa forçando o parser correto
  const reprocessarComBanco = async () => {
    const bancoEscolhido = bancoManual === 'outro' ? bancoManualTexto : bancoManual
    if (!bancoEscolhido) return setErro('Selecione ou informe o banco para continuar')

    setErro('')
    setReprocessando(true)

    const form = new FormData()
    form.append('extrato', arquivo)
    form.append('clienteId', clienteId)
    form.append('forcarBanco', bancoEscolhido)

    try {
      const { data } = await api.post('/extratos/importar', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      if (data.requer_revisao_manual) {
        // Mesmo forçando o banco, não extraiu lançamentos
        // Mantém o modo manual mas mostra aviso mais específico
        setResultadoParcial(data)
        setErro(
          `O sistema ainda não consegue ler extratos do ${bancoEscolhido} automaticamente. ` +
          `Você pode continuar e lançar manualmente na tela de revisão.`
        )
        return
      }

      nav(`/revisao/${data.extratoId}`)
    } catch (e) {
      setErro(e.response?.data?.erro || 'Erro ao reprocessar extrato')
    } finally {
      setReprocessando(false)
    }
  }

  // Continua mesmo sem lançamentos — vai para revisão manual
  const continuarManualmente = async () => {
    const bancoEscolhido = bancoManual === 'outro'
      ? (bancoManualTexto || 'desconhecido')
      : (bancoManual || 'desconhecido')

    setErro('')
    setReprocessando(true)

    const form = new FormData()
    form.append('extrato', arquivo)
    form.append('clienteId', clienteId)
    form.append('forcarBanco', bancoEscolhido)
    form.append('modoManual', 'true')

    try {
      const { data } = await api.post('/extratos/importar', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      nav(`/revisao/${data.extratoId}`)
    } catch (e) {
      setErro(e.response?.data?.erro || 'Erro ao criar extrato manual')
    } finally {
      setReprocessando(false)
    }
  }

  // ── Modo revisão manual ───────────────────────────────────────────
  if (modoManual && resultadoParcial) {
    return (
      <div>
        <h2 style={s.titulo}>Importar extrato</h2>

        <div style={s.cardAviso}>
          <div style={s.avisoHeader}>
            <span style={s.avisoIcone}>🔍</span>
            <div>
              <p style={s.avisoTitulo}>Banco não reconhecido automaticamente</p>
              <p style={s.avisoSub}>
                O sistema não conseguiu identificar o banco deste extrato.
                Selecione o banco abaixo para tentarmos novamente com o parser correto.
              </p>
            </div>
          </div>

          <div style={s.field}>
            <label style={s.label}>Qual é o banco deste extrato?</label>
            <div style={s.bancosGrid}>
              {BANCOS_SUPORTADOS.map(b => (
                <button
                  key={b.value}
                  type="button"
                  style={{
                    ...s.bancoBtn,
                    ...(bancoManual === b.value ? s.bancoBtnAtivo : {})
                  }}
                  onClick={() => setBancoManual(b.value)}
                >
                  {b.label}
                </button>
              ))}
            </div>

            {bancoManual === 'outro' && (
              <input
                style={{ ...s.input, marginTop: 10 }}
                type="text"
                placeholder="Nome do banco (ex: Nubank, Inter, C6 Bank...)"
                value={bancoManualTexto}
                onChange={e => setBancoManualTexto(e.target.value)}
              />
            )}
          </div>

          {erro && <p style={s.erro}>{erro}</p>}

          <div style={s.botoesManual}>
            <button
              style={s.btnSecundario}
              type="button"
              onClick={() => { setModoManual(false); setErro('') }}
            >
              ← Voltar
            </button>

            <button
              style={s.btn}
              type="button"
              onClick={reprocessarComBanco}
              disabled={reprocessando || !bancoManual || (bancoManual === 'outro' && !bancoManualTexto)}
            >
              {reprocessando ? '⏳ Tentando...' : '🔄 Tentar com este banco'}
            </button>
          </div>

          <div style={s.divisor} />

          <p style={s.dicaManual}>
            <strong>O banco não está na lista ou ainda não funciona?</strong><br />
            Sem problema — você pode lançar manualmente na tela de revisão.
            O sistema vai aprender com seus lançamentos e ficará mais inteligente no próximo mês.
          </p>

          <button
            style={s.btnManual}
            type="button"
            onClick={continuarManualmente}
            disabled={reprocessando}
          >
            ✏️ Continuar e lançar manualmente
          </button>
        </div>
      </div>
    )
  }

  // ── Tela normal ───────────────────────────────────────────────────
  return (
    <div>
      <h2 style={s.titulo}>Importar extrato</h2>

      <div style={s.card}>
        <form onSubmit={importar}>
          <div style={s.field}>
            <label style={s.label}>Cliente</label>
            <select style={s.input} value={clienteId} onChange={e => setClienteId(e.target.value)} required>
              <option value="">Selecione o cliente...</option>
              {clientes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.nome}{c.banco ? ` · ${c.banco}` : ''}
                </option>
              ))}
            </select>
            {clientes.length === 0 && (
              <p style={s.hint}>
                Nenhum cliente cadastrado.{' '}
                <span style={s.link} onClick={() => nav('/clientes')}>Cadastrar agora</span>
              </p>
            )}
          </div>

          <div style={s.field}>
            <label style={s.label}>Arquivo do extrato (PDF)</label>
            <div style={s.dropzone} onClick={() => document.getElementById('file-input').click()}>
              {arquivo ? (
                <div>
                  <p style={{ fontSize: 14, fontWeight: 500, margin: '0 0 4px' }}>📄 {arquivo.name}</p>
                  <p style={{ fontSize: 12, color: '#888', margin: 0 }}>{(arquivo.size / 1024).toFixed(0)} KB</p>
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: 14, color: '#888', margin: '0 0 4px' }}>Clique para selecionar o PDF</p>
                  <p style={{ fontSize: 12, color: '#aaa', margin: 0 }}>Suporte: Unicred, BB, Bradesco, Itaú, Santander, Caixa</p>
                </div>
              )}
            </div>
            <input
              id="file-input"
              type="file"
              accept=".pdf"
              style={{ display: 'none' }}
              onChange={e => setArquivo(e.target.files[0])}
            />
          </div>

          {erro && <p style={s.erro}>{erro}</p>}

          <button style={s.btn} type="submit" disabled={loading || !arquivo || !clienteId}>
            {loading ? '⏳ Processando extrato...' : '🚀 Importar e classificar'}
          </button>
        </form>

        {loading && (
          <div style={s.progress}>
            <p style={{ fontSize: 14, margin: '0 0 8px' }}>Processando...</p>
            <p style={{ fontSize: 12, color: '#888', margin: 0 }}>
              Lendo PDF → extraindo lançamentos → aplicando regras → consultando IA
            </p>
          </div>
        )}
      </div>

      <div style={s.info}>
        <h3 style={{ fontSize: 14, fontWeight: 500, margin: '0 0 8px' }}>Como funciona</h3>
        <p style={{ fontSize: 13, color: '#666', margin: '0 0 6px', lineHeight: 1.5 }}>
          1. O sistema lê o PDF e extrai todos os lançamentos automaticamente
        </p>
        <p style={{ fontSize: 13, color: '#666', margin: '0 0 6px', lineHeight: 1.5 }}>
          2. Aplica as regras já cadastradas — lançamentos conhecidos são classificados na hora
        </p>
        <p style={{ fontSize: 13, color: '#666', margin: 0, lineHeight: 1.5 }}>
          3. Para lançamentos novos, a IA sugere as contas com base no histórico do escritório
        </p>
      </div>
    </div>
  )
}

const s = {
  titulo: { fontSize: 20, fontWeight: 500, margin: '0 0 1.25rem', color: '#1a1a18' },
  card: { background: '#fff', border: '0.5px solid #e0dfd8', borderRadius: 12, padding: '1.5rem', marginBottom: '1rem', maxWidth: 560 },
  cardAviso: { background: '#fff', border: '0.5px solid #e0dfd8', borderRadius: 12, padding: '1.5rem', marginBottom: '1rem', maxWidth: 560 },
  avisoHeader: { display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: '1.25rem', padding: '1rem', background: '#fffbf0', border: '0.5px solid #f5d87a', borderRadius: 8 },
  avisoIcone: { fontSize: 24, flexShrink: 0 },
  avisoTitulo: { fontSize: 14, fontWeight: 600, color: '#1a1a18', margin: '0 0 4px' },
  avisoSub: { fontSize: 13, color: '#666', margin: 0, lineHeight: 1.5 },
  field: { marginBottom: '1.25rem' },
  label: { display: 'block', fontSize: 13, fontWeight: 500, color: '#555', marginBottom: 8 },
  input: { width: '100%', padding: '10px 12px', border: '0.5px solid #ddd', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' },
  bancosGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 },
  bancoBtn: { padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 13, background: '#fafafa', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' },
  bancoBtnAtivo: { border: '1.5px solid #1a1a18', background: '#1a1a18', color: '#fff', fontWeight: 500 },
  hint: { fontSize: 12, color: '#888', margin: '6px 0 0' },
  link: { color: '#1a1a18', cursor: 'pointer', fontWeight: 500, textDecoration: 'underline' },
  dropzone: { border: '1.5px dashed #ddd', borderRadius: 8, padding: '2rem', textAlign: 'center', cursor: 'pointer', background: '#fafafa' },
  erro: { background: '#fff3f3', border: '0.5px solid #fcc', color: '#c00', borderRadius: 6, padding: '8px 12px', fontSize: 13, marginBottom: '1rem' },
  btn: { width: '100%', padding: 12, background: '#1a1a18', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' },
  btnSecundario: { padding: '10px 16px', background: '#fff', color: '#1a1a18', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, cursor: 'pointer' },
  btnManual: { width: '100%', padding: 12, background: '#fff', color: '#555', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, cursor: 'pointer', marginTop: 8 },
  botoesManual: { display: 'flex', gap: 8, marginBottom: '1rem' },
  divisor: { borderTop: '1px solid #eee', margin: '1.25rem 0' },
  dicaManual: { fontSize: 13, color: '#666', lineHeight: 1.6, marginBottom: '0.75rem' },
  progress: { marginTop: '1rem', background: '#f5f5f3', borderRadius: 8, padding: '1rem', textAlign: 'center' },
  info: { background: '#f5f5f3', borderRadius: 10, padding: '1.25rem', maxWidth: 560 }
}
