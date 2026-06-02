# Verve IA ⚖

Sistema de lançamentos contábeis com inteligência artificial. Faz upload do extrato bancário em PDF, classifica os lançamentos automaticamente e exporta a planilha no formato contábil.

## Como funciona

1. Importe o extrato bancário (PDF)
2. O sistema extrai todos os lançamentos automaticamente
3. Aplica regras já cadastradas — lançamentos conhecidos são classificados na hora
4. Para lançamentos novos, a IA sugere as contas D/C com base no histórico
5. Revise, aprove e exporte o CSV pronto

O sistema **aprende com cada confirmação**: toda vez que você aprova uma classificação, uma nova regra é criada automaticamente. No mês seguinte, aquele lançamento já sai classificado sozinho.

---

## Deploy em 30 minutos

### 1. Crie o repositório

```bash
git clone https://github.com/SEU_USUARIO/verve-ia
cd verve-ia
```

### 2. Backend — Railway (gratuito)

1. Acesse [railway.app](https://railway.app) e faça login com GitHub
2. Clique em **New Project → Deploy from GitHub repo**
3. Selecione este repositório e a pasta `backend`
4. Adicione um banco PostgreSQL: **New → Database → PostgreSQL**
5. Vá em **Variables** e adicione:

```
DATABASE_URL      → (copiado da aba do PostgreSQL → Connect)
JWT_SECRET        → (qualquer string longa, ex: gere em openssl rand -base64 32)
ANTHROPIC_API_KEY → sk-ant-... (opcional, para sugestões de IA)
FRONTEND_URL      → https://SEU_USUARIO.github.io
NODE_ENV          → production
```

6. No terminal do Railway, rode o schema:
```sql
-- Cole o conteúdo de db/schema.sql no Query Runner do Railway
```

7. Anote a URL do backend: `https://xxx.railway.app`

---

### 3. Frontend — GitHub Pages

**a) Edite o `frontend/package.json`:**
```json
"homepage": "https://SEU_USUARIO.github.io/verve-ia"
```

**b) Adicione o secret no GitHub:**
- Repositório → Settings → Secrets → Actions → New repository secret
- Nome: `REACT_APP_API_URL`
- Valor: `https://xxx.railway.app/api`

**c) Ative o GitHub Pages:**
- Settings → Pages → Source: **Deploy from a branch** → `gh-pages`

**d) Faça o primeiro push:**
```bash
git add .
git commit -m "primeiro deploy"
git push origin main
```

O GitHub Actions vai fazer o build e publicar automaticamente.
Aguarde ~2 minutos e acesse: `https://SEU_USUARIO.github.io/verve-ia`

---

### 4. Primeiro acesso

1. Acesse a URL do sistema
2. Clique em **Criar conta do escritório**
3. Preencha nome do escritório, seu nome, e-mail e senha
4. Você entra como **Administrador**
5. Cadastre os outros usuários em: tela lateral → (futuro: Configurações)

---

## Rodando localmente

```bash
# Backend
cd backend
cp .env.example .env        # edite com suas variáveis
npm install
npm run dev                 # roda em localhost:3001

# Frontend (outro terminal)
cd frontend
cp .env.example .env        # aponte REACT_APP_API_URL para localhost:3001/api
npm install
npm start                   # abre em localhost:3000
```

Banco local: instale PostgreSQL e rode `db/schema.sql` para criar as tabelas.

---

## Bancos suportados

| Banco | Status |
|-------|--------|
| Unicred | ✅ Suporte completo |
| BB / Bradesco / Itaú | ⚠ Parser genérico (pode precisar de ajuste) |
| Santander / Caixa | ⚠ Parser genérico |

Contribuições de parsers para novos bancos são bem-vindas via Pull Request.

---

## Feedback e bugs

Encontrou um problema ou tem sugestão? Abra uma [Issue](../../issues) descrevendo:
- O banco do extrato
- O que aconteceu
- O que era esperado

---

## Stack

- **Frontend**: React + React Router (GitHub Pages)
- **Backend**: Node.js + Express (Railway)
- **Banco**: PostgreSQL
- **IA**: Claude API (Anthropic) — opcional
- **Autenticação**: JWT

---

## Licença

MIT — use, modifique e distribua livremente.
