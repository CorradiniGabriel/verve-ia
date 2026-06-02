import React, { useState, useEffect } from 'react'
import api from '../api'

export function Clientes() {
  const [clientes, setClientes] = useState([])
  const [form, setForm] = useState({ nome: '', banco: '', conta: '', observacoes: '' })
  const [mostrando, setMostrando] = useState(false)

  const carregar = () => api.get('/clientes').then(r => setClientes(r.data))
  useEffect(() => { carregar() }, [])

  const salvar = async e => {
    e.preventDefault()
    await api.post('/clientes', form)
    setForm({ nome: '', banco: '', conta: '', observacoes: '' })
    setMostrando(false)
    carregar()
  }

  const excluir = async id => {
    if (!window.confirm('Excluir cliente?')) return
    await api.delete(`/clientes/${id}`)
    carregar()
  }

  return (
    <div>
      <div style={sC.header}>
        <h2 style={sC.titulo}>Clientes</h2>
        <button style={sC.btnAdd} onClick={() => setMostrando(!mostrando)}>
          {mostrando ? 'Cancelar' : '+ Novo cliente'}
        </button>
      </div>

      {mostrando && (
        <div style={sC.formCard}>
          <form onSubmit={salvar} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={sC.label}>Nome do cliente *</label>
              <input style={sC.input} value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} required placeholder="Razão social ou nome" />
            </div>
            <div>
              <label style={sC.label}>Banco</label>
              <select style={sC.input} value={form.banco} onChange={e => setForm({ ...form, banco: e.target.value })}>
                <option value="">Selecione...</option>
                {['Unicred','Banco do Brasil','Bradesco','Itaú','Santander','Caixa','Sicoob','Sicredi','Outro'].map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label style={sC.label}>Número da conta</label>
              <input style={sC.input} value={form.conta} onChange={e => setForm({ ...form, conta: e.target.value })} placeholder="Ex: 213977" />
            </div>
            <div style={{ gridColumn: '1/-1', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={sC.btnSalvar} type="submit">Salvar cliente</button>
            </div>
          </form>
        </div>
      )}

      <div style={sC.lista}>
        {clientes.length === 0 ? (
          <p style={{ color: '#888', fontSize: 14, padding: '1rem 0' }}>Nenhum cliente cadastrado</p>
        ) : clientes.map(c => (
          <div key={c.id} style={sC.item}>
            <div>
              <p style={sC.nome}>{c.nome}</p>
              <p style={sC.detalhe}>{c.banco ? `${c.banco}` : ''}{c.conta ? ` · Conta ${c.conta}` : ''}</p>
            </div>
            <button style={sC.btnExcluir} onClick={() => excluir(c.id)}>Excluir</button>
          </div>
        ))}
      </div>
    </div>
  )
}

export function Regras() {
  const [regras, setRegras] = useState([])
  const [form, setForm] = useState({ padrao: '', contaDebito: '', contaCredito: '', tipoMatch: 'fuzzy', tipoLancamento: 'ambos' })
  const [mostrando, setMostrando] = useState(false)

  const carregar = () => api.get('/regras').then(r => setRegras(r.data))
  useEffect(() => { carregar() }, [])

  const salvar = async e => {
    e.preventDefault()
    await api.post('/regras', form)
    setForm({ padrao: '', contaDebito: '', contaCredito: '', tipoMatch: 'fuzzy', tipoLancamento: 'ambos' })
    setMostrando(false)
    carregar()
  }

  const excluir = async id => {
    if (!window.confirm('Excluir regra?')) return
    await api.delete(`/regras/${id}`)
    carregar()
  }

  return (
    <div>
      <div style={sC.header}>
        <div>
          <h2 style={sC.titulo}>Regras de classificação</h2>
          <p style={{ fontSize: 13, color: '#888', margin: 0 }}>O sistema cria regras automaticamente ao confirmar lançamentos. Você também pode criar manualmente.</p>
        </div>
        <button style={sC.btnAdd} onClick={() => setMostrando(!mostrando)}>
          {mostrando ? 'Cancelar' : '+ Nova regra'}
        </button>
      </div>

      {mostrando && (
        <div style={sC.formCard}>
          <form onSubmit={salvar} style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={sC.label}>Padrão de histórico *</label>
              <input style={sC.input} value={form.padrao} onChange={e => setForm({ ...form, padrao: e.target.value })} required placeholder="Ex: hospital baia sul ou prefeitura*" />
              <p style={{ fontSize: 11, color: '#888', margin: '4px 0 0' }}>Use * como curinga. Escreva em minúsculas, sem acentos.</p>
            </div>
            <div>
              <label style={sC.label}>Conta débito (D) *</label>
              <input style={sC.input} value={form.contaDebito} onChange={e => setForm({ ...form, contaDebito: e.target.value })} required placeholder="Ex: 345" />
            </div>
            <div>
              <label style={sC.label}>Conta crédito (C) *</label>
              <input style={sC.input} value={form.contaCredito} onChange={e => setForm({ ...form, contaCredito: e.target.value })} required placeholder="Ex: 523" />
            </div>
            <div>
              <label style={sC.label}>Tipo de lançamento</label>
              <select style={sC.input} value={form.tipoLancamento} onChange={e => setForm({ ...form, tipoLancamento: e.target.value })}>
                <option value="ambos">Ambos</option>
                <option value="debito">Débito</option>
                <option value="credito">Crédito</option>
              </select>
            </div>
            <div style={{ gridColumn: '1/-1', display: 'flex', justifyContent: 'flex-end' }}>
              <button style={sC.btnSalvar} type="submit">Salvar regra</button>
            </div>
          </form>
        </div>
      )}

      <div style={sC.lista}>
        {regras.length === 0 ? (
          <p style={{ color: '#888', fontSize: 14, padding: '1rem 0' }}>Nenhuma regra cadastrada ainda. Elas serão criadas automaticamente ao aprovar lançamentos.</p>
        ) : regras.map(r => (
          <div key={r.id} style={sC.item}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontFamily: 'monospace', fontSize: 13, background: '#f5f5f3', padding: '2px 7px', borderRadius: 4 }}>{r.padrao}</span>
                <span style={{ fontSize: 11, color: '#888' }}>→</span>
                <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#085041' }}>D:{r.conta_debito}</span>
                <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#185FA5' }}>C:{r.conta_credito}</span>
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#aaa' }}>
                <span>Score: <strong style={{ color: r.score >= 90 ? '#085041' : '#854F0B' }}>{Math.round(r.score)}%</strong></span>
                <span>Usos: {r.usos}</span>
                {r.criado_por_nome && <span>Por: {r.criado_por_nome}</span>}
              </div>
            </div>
            <button style={sC.btnExcluir} onClick={() => excluir(r.id)}>Excluir</button>
          </div>
        ))}
      </div>
    </div>
  )
}

const sC = {
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem', gap: 12 },
  titulo: { fontSize: 20, fontWeight: 500, margin: '0 0 4px', color: '#1a1a18' },
  btnAdd: { padding: '9px 16px', background: '#1a1a18', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 500 },
  formCard: { background: '#fff', border: '0.5px solid #e0dfd8', borderRadius: 10, padding: '1.25rem', marginBottom: '1rem' },
  label: { display: 'block', fontSize: 12, fontWeight: 500, color: '#555', marginBottom: 5 },
  input: { width: '100%', padding: '9px 11px', border: '0.5px solid #ddd', borderRadius: 7, fontSize: 13, boxSizing: 'border-box' },
  btnSalvar: { padding: '9px 20px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500 },
  lista: { display: 'flex', flexDirection: 'column', gap: 6 },
  item: { background: '#fff', border: '0.5px solid #e0dfd8', borderRadius: 8, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between' },
  nome: { fontSize: 14, fontWeight: 500, margin: '0 0 3px', color: '#1a1a18' },
  detalhe: { fontSize: 12, color: '#888', margin: 0 },
  btnExcluir: { fontSize: 11, padding: '4px 10px', background: '#FCEBEB', color: '#791F1F', border: '0.5px solid #F7C1C1', borderRadius: 5, cursor: 'pointer', whiteSpace: 'nowrap' }
}

export default Clientes
