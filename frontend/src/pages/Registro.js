import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../api'

export default function Registro() {
  const [form, setForm] = useState({ nomeEscritorio: '', nome: '', email: '', senha: '' })
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  const nav = useNavigate()

  const registrar = async e => {
    e.preventDefault()
    setErro('')
    setLoading(true)
    try {
      const { data } = await api.post('/auth/registro', form)
      localStorage.setItem('token', data.token)
      localStorage.setItem('usuario', JSON.stringify(data.usuario))
      nav('/')
    } catch (e) {
      setErro(e.response?.data?.erro || 'Erro ao criar conta')
    } finally {
      setLoading(false)
    }
  }

  const f = (k, v) => setForm({ ...form, [k]: v })

  return (
    <div style={s.bg}>
      <div style={s.card}>
        <div style={s.logo}>
          <span style={s.logoIcon}>⚖</span>
          <h1 style={s.titulo}>Criar conta do escritório</h1>
          <p style={s.sub}>Conta compartilhada para toda a equipe</p>
        </div>

        <form onSubmit={registrar}>
          <div style={s.field}>
            <label style={s.label}>Nome do escritório</label>
            <input style={s.input} placeholder="Ex: Contábil Silva & Associados"
              value={form.nomeEscritorio} onChange={e => f('nomeEscritorio', e.target.value)} required />
          </div>
          <div style={s.field}>
            <label style={s.label}>Seu nome (administrador)</label>
            <input style={s.input} placeholder="Nome completo"
              value={form.nome} onChange={e => f('nome', e.target.value)} required />
          </div>
          <div style={s.field}>
            <label style={s.label}>E-mail</label>
            <input style={s.input} type="email" placeholder="admin@escritorio.com"
              value={form.email} onChange={e => f('email', e.target.value)} required />
          </div>
          <div style={s.field}>
            <label style={s.label}>Senha</label>
            <input style={s.input} type="password" placeholder="Mínimo 8 caracteres"
              value={form.senha} onChange={e => f('senha', e.target.value)} minLength={8} required />
          </div>

          {erro && <p style={s.erro}>{erro}</p>}

          <button style={s.btn} type="submit" disabled={loading}>
            {loading ? 'Criando conta...' : 'Criar escritório'}
          </button>
        </form>

        <p style={s.footer}>
          Já tem conta? <Link to="/login" style={s.link}>Entrar</Link>
        </p>
      </div>
    </div>
  )
}

const s = {
  bg: { minHeight: '100vh', background: '#f5f5f3', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' },
  card: { background: '#fff', border: '0.5px solid #e0dfd8', borderRadius: 12, padding: '2rem', width: '100%', maxWidth: 420 },
  logo: { textAlign: 'center', marginBottom: '1.5rem' },
  logoIcon: { fontSize: 32 },
  titulo: { fontSize: 20, fontWeight: 500, margin: '8px 0 4px', color: '#1a1a18' },
  sub: { fontSize: 13, color: '#888', margin: 0 },
  field: { marginBottom: '1rem' },
  label: { display: 'block', fontSize: 13, color: '#555', marginBottom: 6, fontWeight: 500 },
  input: { width: '100%', padding: '10px 12px', border: '0.5px solid #ddd', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' },
  erro: { background: '#fff3f3', border: '0.5px solid #fcc', color: '#c00', borderRadius: 6, padding: '8px 12px', fontSize: 13, margin: '0 0 1rem' },
  btn: { width: '100%', padding: '11px', background: '#1a1a18', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' },
  footer: { textAlign: 'center', marginTop: '1.25rem', fontSize: 13, color: '#888' },
  link: { color: '#1a1a18', fontWeight: 500 }
}
