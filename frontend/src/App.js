import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Registro from './pages/Registro'
import Dashboard from './pages/Dashboard'
import ImportarExtrato from './pages/ImportarExtrato'
import Revisao from './pages/Revisao'
import Regras from './pages/Regras'
import Clientes from './pages/Clientes'
import Layout from './components/Layout'

const RotaProtegida = ({ children }) => {
  const token = localStorage.getItem('token')
  return token ? children : <Navigate to="/login" />
}

export default function App() {
  return (
    <BrowserRouter basename="/verve-ia">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/registro" element={<Registro />} />
        <Route path="/" element={<RotaProtegida><Layout /></RotaProtegida>}>
          <Route index element={<Dashboard />} />
          <Route path="importar" element={<ImportarExtrato />} />
          <Route path="revisao/:extratoId" element={<Revisao />} />
          <Route path="regras" element={<Regras />} />
          <Route path="clientes" element={<Clientes />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
