import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'

export default function Dashboard() {
  const [extratos, setExtratos] = useState([])
  const [loading, setLoading] = useState(true)
  const nav = useNavigate()

  useEffect(() => {
    api.get('/extratos').then(r => setExtratos(r.data)).finally(() => setLoading(false))
  }, [])

  const pendentes = extratos.filter(e => Number(e.pendentes) > 0)
  const concluidos = extratos.filter(e => Number(e.pendentes) === 0)

  return (
    <div>
      <h2 style={s.titulo}>Painel</h2>

      <div style={s.stats}>
        <div style={s.stat}>
          <p style={s.statLabel}>Extratos importados</p>
          <p style={s.statVal}>{extratos.length}</p>
        </div>
        <div style={s.stat}>
          <p style={s.statLabel}>Com revisão pendente</p>
          <p style={{ ...s.statVal, color: pendentes.length ? '#BA7517' : '#1D9E75' }}>{pendentes.length}</p>
        </div>
        <div style={s.stat}>
          <p style={s.statLabel}>Concluídos</p>
          <p style={{ ...s.statVal, color: '#1D9E75' }}>{concluidos.length}</p>
        </div>
      </div>

      {loading ? <p style={s.loading}>Carregando...</p> : (
        <>
          {pendentes.length > 0 && (
            <>
              <h3 style={s.secTitle}>⚠ Aguardando revisão</h3>
              {pendentes.map(e => <ExtratoCard key={e.id} e={e} nav={nav} urgente />)}
            </>
          )}

          {concluidos.length > 0 && (
            <>
              <h3 style={s.secTitle}>✓ Concluídos</h3>
              {concluidos.map(e => <ExtratoCard key={e.id} e={e} nav={nav} />)}
            </>
          )}

          {extratos.length === 0 && (
            <div style={s.empty}>
              <p style={{ fontSize: 15, fontWeight: 500, margin: '0 0 8px' }}>Nenhum extrato importado ainda</p>
              <p style={{ fontSize: 13, color: '#888', margin: '0 0 16px' }}>Importe o primeiro extrato para começar</p>
              <button style={s.btn} onClick={() => nav('/importar')}>Importar extrato</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ExtratoCard({ e, nav, urgente }) {
  return (
    <div style={{ ...s.card, borderColor: urgente ? '#f0c54b' : '#e0dfd8' }}
      onClick={() => nav(`/revisao/${e.id}`)}
    >
      <div style={{ flex: 1 }}>
        <p style={s.cardTitle}>{e.cliente_nome}</p>
        <p style={s.cardSub}>{e.nome_arquivo} · importado por {e.importado_por}</p>
      </div>
      <div style={s.cardMeta}>
        <span style={{ ...s.badge, background: urgente ? '#FAEEDA' : '#E1F5EE', color: urgente ? '#854F0B' : '#085041' }}>
          {urgente ? `${e.pendentes} pendente${e.pendentes > 1 ? 's' : ''}` : 'Concluído'}
        </span>
        <span style={s.total}>{e.total_lancamentos} lançamentos</span>
      </div>
    </div>
  )
}

const s = {
  titulo: { fontSize: 20, fontWeight: 500, margin: '0 0 1.25rem', color: '#1a1a18' },
  stats: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: '1.5rem' },
  stat: { background: '#f5f5f3', borderRadius: 8, padding: '14px 16px' },
  statLabel: { fontSize: 12, color: '#888', margin: '0 0 4px' },
  statVal: { fontSize: 24, fontWeight: 500, margin: 0, color: '#1a1a18' },
  secTitle: { fontSize: 14, fontWeight: 500, color: '#555', margin: '1.5rem 0 8px' },
  card: { background: '#fff', border: '0.5px solid #e0dfd8', borderRadius: 10, padding: '14px 16px', marginBottom: 8, display: 'flex', alignItems: 'center', cursor: 'pointer', gap: 12 },
  cardTitle: { fontSize: 14, fontWeight: 500, margin: '0 0 3px', color: '#1a1a18' },
  cardSub: { fontSize: 12, color: '#888', margin: 0 },
  cardMeta: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 },
  badge: { fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 5 },
  total: { fontSize: 11, color: '#aaa' },
  loading: { color: '#888', fontSize: 14 },
  empty: { textAlign: 'center', padding: '3rem', background: '#fff', borderRadius: 10, border: '0.5px solid #e0dfd8' },
  btn: { padding: '10px 20px', background: '#1a1a18', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer' }
}
