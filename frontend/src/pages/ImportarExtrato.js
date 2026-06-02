import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'

export default function ImportarExtrato() {
  const [clientes, setClientes] = useState([])
  const [clienteId, setClienteId] = useState('')
  const [arquivo, setArquivo] = useState(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const nav = useNavigate()

  useEffect(() => {
    api.get('/clientes').then(r => setClientes(r.data))
  }, [])

  const importar = async e => {
    e.preventDefault()
    if (!arquivo || !clienteId) return setErro('Selecione o cliente e o arquivo')
    setErro('')
    setLoading(true)

    const form = new FormData()
    form.append('extrato', arquivo)
    form.append('clienteId', clienteId)

    try {
      const { data } = await api.post('/extratos/importar', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      nav(`/revisao/${data.extratoId}`)
    } catch (e) {
      setErro(e.response?.data?.erro || 'Erro ao processar extrato')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h2 style={s.titulo}>Importar extrato</h2>

      <div style={s.card}>
        <form onSubmit={importar}>
          <div style={s.field}>
            <label style={s.label}>Cliente</label>
            <select style={s.input} value={clienteId} onChange={e => setClienteId(e.target.value)} required>
              <option value="">Selecione o cliente...</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nome} {c.banco ? `· ${c.banco}` : ''}</option>)}
            </select>
            {clientes.length === 0 && (
              <p style={s.hint}>Nenhum cliente cadastrado. <span style={s.link} onClick={() => nav('/clientes')}>Cadastrar agora</span></p>
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
                  <p style={{ fontSize: 12, color: '#aaa', margin: 0 }}>Suporte: Unicred, BB, Bradesco, Itaú, Santander</p>
                </div>
              )}
            </div>
            <input id="file-input" type="file" accept=".pdf" style={{ display: 'none' }}
              onChange={e => setArquivo(e.target.files[0])} />
          </div>

          {erro && <p style={s.erro}>{erro}</p>}

          <button style={s.btn} type="submit" disabled={loading || !arquivo || !clienteId}>
            {loading ? '⏳ Processando extrato...' : '🚀 Importar e classificar'}
          </button>
        </form>

        {loading && (
          <div style={s.progress}>
            <p style={{ fontSize: 14, margin: '0 0 8px' }}>Processando...</p>
            <p style={{ fontSize: 12, color: '#888', margin: 0 }}>Lendo PDF → extraindo lançamentos → aplicando regras → consultando IA</p>
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
  field: { marginBottom: '1.25rem' },
  label: { display: 'block', fontSize: 13, fontWeight: 500, color: '#555', marginBottom: 6 },
  input: { width: '100%', padding: '10px 12px', border: '0.5px solid #ddd', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' },
  hint: { fontSize: 12, color: '#888', margin: '6px 0 0' },
  link: { color: '#1a1a18', cursor: 'pointer', fontWeight: 500, textDecoration: 'underline' },
  dropzone: { border: '1.5px dashed #ddd', borderRadius: 8, padding: '2rem', textAlign: 'center', cursor: 'pointer', background: '#fafafa' },
  erro: { background: '#fff3f3', border: '0.5px solid #fcc', color: '#c00', borderRadius: 6, padding: '8px 12px', fontSize: 13, marginBottom: '1rem' },
  btn: { width: '100%', padding: 12, background: '#1a1a18', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' },
  progress: { marginTop: '1rem', background: '#f5f5f3', borderRadius: 8, padding: '1rem', textAlign: 'center' },
  info: { background: '#f5f5f3', borderRadius: 10, padding: '1.25rem', maxWidth: 560 }
}
