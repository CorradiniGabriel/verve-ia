import React from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'

export default function Layout() {
  const nav = useNavigate()
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}')
  const escritorio = JSON.parse(localStorage.getItem('escritorio') || '{}')

  const sair = () => {
    localStorage.clear()
    nav('/login')
  }

  const linkStyle = ({ isActive }) => ({
    display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px',
    borderRadius: 8, fontSize: 14, textDecoration: 'none', fontWeight: 500,
    color: isActive ? '#1a1a18' : '#666',
    background: isActive ? '#f0efe8' : 'transparent'
  })

  return (
    <div style={s.root}>
      <aside style={s.sidebar}>
        <div style={s.brand}>
          <span style={{ fontSize: 20 }}>⚖</span>
          <div>
            <p style={s.brandName}>Contábil IA</p>
            <p style={s.brandSub}>{escritorio.nome || 'Escritório'}</p>
          </div>
        </div>

        <nav style={s.nav}>
          <NavLink to="/" end style={linkStyle}>🏠 Painel</NavLink>
          <NavLink to="/importar" style={linkStyle}>📥 Importar extrato</NavLink>
          <NavLink to="/regras" style={linkStyle}>⚡ Regras</NavLink>
          <NavLink to="/clientes" style={linkStyle}>🏢 Clientes</NavLink>
        </nav>

        <div style={s.userBox}>
          <p style={s.userName}>{usuario.nome}</p>
          <p style={s.userRole}>{usuario.role === 'admin' ? 'Administrador' : 'Contador'}</p>
          <button style={s.sairBtn} onClick={sair}>Sair</button>
        </div>
      </aside>

      <main style={s.main}>
        <Outlet />
      </main>
    </div>
  )
}

const s = {
  root: { display: 'flex', minHeight: '100vh', background: '#f5f5f3' },
  sidebar: { width: 220, background: '#fff', borderRight: '0.5px solid #e0dfd8', display: 'flex', flexDirection: 'column', padding: '1.25rem 1rem' },
  brand: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '0.5px solid #eee' },
  brandName: { fontSize: 14, fontWeight: 500, margin: 0, color: '#1a1a18' },
  brandSub: { fontSize: 11, color: '#888', margin: 0 },
  nav: { display: 'flex', flexDirection: 'column', gap: 2, flex: 1 },
  userBox: { borderTop: '0.5px solid #eee', paddingTop: '1rem', marginTop: '1rem' },
  userName: { fontSize: 13, fontWeight: 500, color: '#1a1a18', margin: '0 0 2px' },
  userRole: { fontSize: 11, color: '#888', margin: '0 0 10px' },
  sairBtn: { fontSize: 12, color: '#888', background: 'none', border: 'none', cursor: 'pointer', padding: 0 },
  main: { flex: 1, padding: '2rem', maxWidth: 1100, margin: '0 auto', width: '100%' }
}
