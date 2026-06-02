require('dotenv').config()
const express = require('express')
const cors = require('cors')

const authRoutes = require('./routes/auth')
const extratosRoutes = require('./routes/extratos')
const lancamentosRoutes = require('./routes/lancamentos')
const regrasRoutes = require('./routes/regras')
const clientesRoutes = require('./routes/clientes')
const exportRoutes = require('./routes/export')

const app = express()

app.use(cors({ origin: process.env.FRONTEND_URL || '*' }))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.get('/health', (req, res) => res.json({ status: 'ok', version: '1.0.0' }))

app.use('/api/auth', authRoutes)
app.use('/api/extratos', extratosRoutes)
app.use('/api/lancamentos', lancamentosRoutes)
app.use('/api/regras', regrasRoutes)
app.use('/api/clientes', clientesRoutes)
app.use('/api/export', exportRoutes)

app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ erro: 'Erro interno do servidor' })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`))
