import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../api'

export default function Login() {
  const [form, setForm] = useState({ email: '', senha: '' })
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  const nav = useNavigate()

  const entrar = async e => {
    e.preventDefault()
    setErro('')
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', form)
      localStorage.setItem('token', data.token)
      localStorage.setItem('usuario', JSON.stringify(data.usuario))
      localStorage.setItem('escritorio', JSON.stringify(data.escritorio))
      nav('/')
    } catch (e) {
      setErro(e.response?.data?.erro || 'Erro ao entrar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={s.bg}>
      <div style={s.card}>
        <div style={s.logo}>
          <span style={s.logoIcon}>⚖</span>
          <h1 style={s.titulo}>Contábil IA</h1>
          <p style={s.sub}>Sistema de lançamentos contábeis</p>
        </div>

        <form onSubmit={entrar}>
          <div style={s.field}>
            <label style={s.label}>E-mail</label>
            <input
              style={s.input}
              type="email"
              placeholder="contador@escritorio.com"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div style={s.field}>
            <label style={s.label}>Senha</label>
            <input
              style={s.input}
              type="password"
              placeholder="••••••••"
              value={form.senha}
              onChange={e => setForm({ ...form, senha: e.target.value })}
              required
            />
          </div>

          {erro && <p style={s.erro}>{erro}</p>}

          <button style={s.btn} type="submit" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p style={s.footer}>
          Primeiro acesso?{' '}
          <Link to="/registro" style={s.link}>Criar conta do escritório</Link>
        </p>
      </div>
    </div>
  )
}

const s = {
  bg: { minHeight: '100vh', background: '#f5f5f3', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' },
  card: { background: '#fff', border: '0.5px solid #e0dfd8', borderRadius: 12, padding: '2rem', width: '100%', maxWidth: 380 },
  logo: { textAlign: 'center', marginBottom: '1.5rem' },
  logoIcon: { fontSize: 32 },
  titulo: { fontSize: 22, fontWeight: 500, margin: '8px 0 4px', color: '#1a1a18' },
  sub: { fontSize: 13, color: '#888', margin: 0 },
  field: { marginBottom: '1rem' },
  label: { display: 'block', fontSize: 13, color: '#555', marginBottom: 6, fontWeight: 500 },
  input: { width: '100%', padding: '10px 12px', border: '0.5px solid #ddd', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', outline: 'none' },
  erro: { background: '#fff3f3', border: '0.5px solid #f0c', color: '#c00', borderRadius: 6, padding: '8px 12px', fontSize: 13, margin: '0 0 1rem' },
  btn: { width: '100%', padding: '11px', background: '#1a1a18', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer', marginTop: 4 },
  footer: { textAlign: 'center', marginTop: '1.25rem', fontSize: 13, color: '#888' },
  link: { color: '#1a1a18', fontWeight: 500 }
}
