import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api'

const ORIGEM_LABEL = { regra: { txt: 'Regra', bg: '#E1F5EE', cor: '#085041' }, ia: { txt: 'IA', bg: '#E6F1FB', cor: '#185FA5' }, manual: { txt: 'Manual', bg: '#EEEDFE', cor: '#3C3489' }, pendente: { txt: 'Pendente', bg: '#FAEEDA', cor: '#854F0B' } }

export default function Revisao() {
  const { extratoId } = useParams()
  const nav = useNavigate()
  const [extrato, setExtrato] = useState(null)
  const [lancamentos, setLancamentos] = useState([])
  const [editando, setEditando] = useState(null)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(null)

  const carregar = async () => {
    const { data } = await api.get(`/extratos/${extratoId}`)
    setExtrato(data)
    setLancamentos(data.lancamentos)
    setLoading(false)
  }

  useEffect(() => { carregar() }, [extratoId])

  const aprovar = async (l) => {
    if (!l.conta_debito || !l.conta_credito) return alert('Defina as contas D e C antes de aprovar')
    setSalvando(l.id)
    await api.patch(`/lancamentos/${l.id}`, { contaDebito: l.conta_debito, contaCredito: l.conta_credito })
    setLancamentos(ls => ls.map(x => x.id === l.id ? { ...x, status: 'aprovado' } : x))
    setSalvando(null)
  }

  const aprovarTodos = async () => {
    const aptos = lancamentos.filter(l => l.status === 'pendente' && l.conta_debito && l.conta_credito)
    if (!aptos.length) return
    setSalvando('lote')
    await api.patch('/lancamentos/lote/aprovar', { ids: aptos.map(l => l.id) })
    setLancamentos(ls => ls.map(l => aptos.find(a => a.id === l.id) ? { ...l, status: 'aprovado' } : l))
    setSalvando(null)
  }

  const salvarEdicao = async () => {
    await aprovar(editando)
    setEditando(null)
  }

  const exportar = () => window.open(`${process.env.REACT_APP_API_URL}/export/${extratoId}?token=${localStorage.getItem('token')}`, '_blank')

  if (loading) return <p style={{ padding: '2rem', color: '#888' }}>Carregando...</p>

  const pendentes = lancamentos.filter(l => l.status === 'pendente')
  const aprovados = lancamentos.filter(l => l.status === 'aprovado')
  const comSugestao = pendentes.filter(l => l.conta_debito)

  return (
    <div>
      <button style={s.back} onClick={() => nav('/')}>← Voltar</button>
      <div style={s.header}>
        <div>
          <h2 style={s.titulo}>{extrato?.cliente_nome}</h2>
          <p style={s.sub}>{extrato?.nome_arquivo} · {extrato?.periodo_inicio ? `${fmtData(extrato.periodo_inicio)} a ${fmtData(extrato.periodo_fim)}` : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {comSugestao.length > 0 && (
            <button style={s.btnSecundario} onClick={aprovarTodos} disabled={salvando === 'lote'}>
              {salvando === 'lote' ? 'Aprovando...' : `✓ Aprovar ${comSugestao.length} sugestões`}
            </button>
          )}
          {aprovados.length > 0 && (
            <button style={s.btnPrimario} onClick={exportar}>⬇ Exportar CSV</button>
          )}
        </div>
      </div>

      <div style={s.stats}>
        {[
          { label: 'Total', val: lancamentos.length, cor: '#1a1a18' },
          { label: 'Automático (regra)', val: lancamentos.filter(l => l.origem_classificacao === 'regra').length, cor: '#085041' },
          { label: 'Sugestão IA', val: lancamentos.filter(l => l.origem_classificacao === 'ia').length, cor: '#185FA5' },
          { label: 'Pendente', val: pendentes.length, cor: pendentes.length ? '#854F0B' : '#1a1a18' },
          { label: 'Aprovados', val: aprovados.length, cor: '#085041' },
        ].map(st => (
          <div key={st.label} style={s.stat}>
            <p style={s.statLabel}>{st.label}</p>
            <p style={{ ...s.statVal, color: st.cor }}>{st.val}</p>
          </div>
        ))}
      </div>

      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr>
              {['Data','Histórico','Valor','D','C','Origem','Score','Status','Ação'].map(h => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lancamentos.map(l => {
              const orig = ORIGEM_LABEL[l.origem_classificacao] || ORIGEM_LABEL.pendente
              const isEdit = editando?.id === l.id
              return (
                <tr key={l.id} style={{ background: isEdit ? '#fffbf0' : l.status === 'aprovado' ? '#fafff8' : '#fff' }}>
                  <td style={s.td}>{fmtData(l.data_lancamento)}</td>
                  <td style={{ ...s.td, maxWidth: 200, fontSize: 12 }}>{l.historico_bruto}</td>
                  <td style={{ ...s.td, fontFamily: 'monospace', fontSize: 12, color: l.tipo === 'debito' ? '#c00' : '#085041', whiteSpace: 'nowrap' }}>
                    {l.tipo === 'debito' ? '-' : '+'} R$ {Number(l.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td style={s.td}>
                    {isEdit ? <input style={s.inputSmall} value={editando.conta_debito || ''} onChange={e => setEditando({ ...editando, conta_debito: e.target.value })} placeholder="D" /> : <span style={s.mono}>{l.conta_debito || '—'}</span>}
                  </td>
                  <td style={s.td}>
                    {isEdit ? <input style={s.inputSmall} value={editando.conta_credito || ''} onChange={e => setEditando({ ...editando, conta_credito: e.target.value })} placeholder="C" /> : <span style={s.mono}>{l.conta_credito || '—'}</span>}
                  </td>
                  <td style={s.td}><span style={{ ...s.badge, background: orig.bg, color: orig.cor }}>{orig.txt}</span></td>
                  <td style={s.td}>
                    {l.score_confianca ? <span style={{ fontSize: 11, fontWeight: 500, color: l.score_confianca >= 90 ? '#085041' : l.score_confianca >= 70 ? '#854F0B' : '#888' }}>{Math.round(l.score_confianca)}%</span> : <span style={{ fontSize: 11, color: '#ccc' }}>—</span>}
                  </td>
                  <td style={s.td}>
                    <span style={{ fontSize: 11, fontWeight: 500, color: l.status === 'aprovado' ? '#085041' : '#854F0B' }}>
                      {l.status === 'aprovado' ? '✓ Aprovado' : 'Pendente'}
                    </span>
                  </td>
                  <td style={{ ...s.td, whiteSpace: 'nowrap' }}>
                    {l.status !== 'aprovado' && (
                      isEdit ? (
                        <>
                          <button style={s.btnOk} onClick={salvarEdicao}>Salvar</button>
                          <button style={s.btnCancel} onClick={() => setEditando(null)}>✕</button>
                        </>
                      ) : (
                        <>
                          {l.conta_debito && <button style={s.btnOk} onClick={() => aprovar(l)} disabled={salvando === l.id}>{salvando === l.id ? '...' : '✓'}</button>}
                          <button style={s.btnEdit} onClick={() => setEditando({ ...l })}>✎</button>
                        </>
                      )
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function fmtData(d) {
  if (!d) return ''
  const dt = new Date(d)
  return `${String(dt.getUTCDate()).padStart(2,'0')}/${String(dt.getUTCMonth()+1).padStart(2,'0')}/${dt.getUTCFullYear()}`
}

const s = {
  back: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#888', marginBottom: '1rem', padding: 0 },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem', gap: 12, flexWrap: 'wrap' },
  titulo: { fontSize: 20, fontWeight: 500, margin: '0 0 4px', color: '#1a1a18' },
  sub: { fontSize: 13, color: '#888', margin: 0 },
  stats: { display: 'flex', gap: 8, marginBottom: '1rem', flexWrap: 'wrap' },
  stat: { background: '#f5f5f3', borderRadius: 8, padding: '10px 14px', minWidth: 90 },
  statLabel: { fontSize: 11, color: '#888', margin: '0 0 2px' },
  statVal: { fontSize: 20, fontWeight: 500, margin: 0 },
  tableWrap: { background: '#fff', border: '0.5px solid #e0dfd8', borderRadius: 10, overflow: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'left', padding: '9px 10px', borderBottom: '0.5px solid #e0dfd8', fontSize: 11, fontWeight: 500, color: '#888', background: '#f5f5f3', whiteSpace: 'nowrap' },
  td: { padding: '9px 10px', borderBottom: '0.5px solid #f0efe8', verticalAlign: 'middle', color: '#1a1a18' },
  mono: { fontFamily: 'monospace', fontSize: 12, background: '#f5f5f3', padding: '2px 5px', borderRadius: 4 },
  badge: { fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 5 },
  inputSmall: { width: 60, padding: '4px 6px', border: '0.5px solid #ccc', borderRadius: 5, fontSize: 12, fontFamily: 'monospace' },
  btnOk: { fontSize: 11, padding: '3px 8px', background: '#E1F5EE', color: '#085041', border: '0.5px solid #9FE1CB', borderRadius: 5, cursor: 'pointer', marginRight: 4 },
  btnEdit: { fontSize: 11, padding: '3px 8px', background: '#FAEEDA', color: '#854F0B', border: '0.5px solid #FAC775', borderRadius: 5, cursor: 'pointer' },
  btnCancel: { fontSize: 11, padding: '3px 8px', background: '#f5f5f3', color: '#888', border: '0.5px solid #ddd', borderRadius: 5, cursor: 'pointer' },
  btnPrimario: { padding: '9px 16px', background: '#1a1a18', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500 },
  btnSecundario: { padding: '9px 16px', background: '#E1F5EE', color: '#085041', border: '0.5px solid #9FE1CB', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500 }
}
