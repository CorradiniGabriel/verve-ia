-- ============================================================
-- CONTABIL-IA · Schema do banco de dados
-- ============================================================

-- Escritórios (cada instância pode ter um ou mais)
CREATE TABLE IF NOT EXISTS escritorios (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(200) NOT NULL,
  criado_em TIMESTAMP DEFAULT NOW()
);

-- Usuários do escritório
CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  escritorio_id INTEGER REFERENCES escritorios(id) ON DELETE CASCADE,
  nome VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  senha_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'contador' CHECK (role IN ('admin', 'contador')),
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMP DEFAULT NOW()
);

-- Clientes do escritório
CREATE TABLE IF NOT EXISTS clientes (
  id SERIAL PRIMARY KEY,
  escritorio_id INTEGER REFERENCES escritorios(id) ON DELETE CASCADE,
  nome VARCHAR(200) NOT NULL,
  banco VARCHAR(100),
  conta VARCHAR(50),
  observacoes TEXT,
  criado_em TIMESTAMP DEFAULT NOW()
);

-- Plano de contas (D e C disponíveis)
CREATE TABLE IF NOT EXISTS plano_contas (
  id SERIAL PRIMARY KEY,
  escritorio_id INTEGER REFERENCES escritorios(id) ON DELETE CASCADE,
  codigo VARCHAR(20) NOT NULL,
  descricao VARCHAR(200) NOT NULL,
  tipo VARCHAR(20) CHECK (tipo IN ('ativo','passivo','receita','despesa','patrimonio')),
  ativo BOOLEAN DEFAULT true
);

-- Regras de-para (o coração do sistema)
CREATE TABLE IF NOT EXISTS regras (
  id SERIAL PRIMARY KEY,
  escritorio_id INTEGER REFERENCES escritorios(id) ON DELETE CASCADE,
  padrao VARCHAR(300) NOT NULL,        -- texto normalizado para match
  tipo_match VARCHAR(20) DEFAULT 'fuzzy' CHECK (tipo_match IN ('exato','fuzzy','valor')),
  conta_debito VARCHAR(20) NOT NULL,
  conta_credito VARCHAR(20) NOT NULL,
  valor_min NUMERIC(15,2),             -- para regras por faixa de valor
  valor_max NUMERIC(15,2),
  tipo_lancamento VARCHAR(10) CHECK (tipo_lancamento IN ('debito','credito','ambos')) DEFAULT 'ambos',
  score NUMERIC(5,2) DEFAULT 70.00,    -- confiança 0-100
  usos INTEGER DEFAULT 0,
  criado_por INTEGER REFERENCES usuarios(id),
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW()
);

-- Extratos importados
CREATE TABLE IF NOT EXISTS extratos (
  id SERIAL PRIMARY KEY,
  cliente_id INTEGER REFERENCES clientes(id) ON DELETE CASCADE,
  usuario_id INTEGER REFERENCES usuarios(id),
  nome_arquivo VARCHAR(255),
  periodo_inicio DATE,
  periodo_fim DATE,
  saldo_inicial NUMERIC(15,2),
  saldo_final NUMERIC(15,2),
  status VARCHAR(20) DEFAULT 'pendente' CHECK (status IN ('pendente','em_revisao','concluido')),
  importado_em TIMESTAMP DEFAULT NOW()
);

-- Lançamentos extraídos do extrato
CREATE TABLE IF NOT EXISTS lancamentos (
  id SERIAL PRIMARY KEY,
  extrato_id INTEGER REFERENCES extratos(id) ON DELETE CASCADE,
  data_lancamento DATE NOT NULL,
  historico_bruto TEXT NOT NULL,       -- texto original do extrato
  historico_normalizado TEXT,          -- texto após normalização
  valor NUMERIC(15,2) NOT NULL,
  tipo VARCHAR(10) CHECK (tipo IN ('debito','credito')),
  saldo_apos NUMERIC(15,2),
  conta_debito VARCHAR(20),
  conta_credito VARCHAR(20),
  regra_id INTEGER REFERENCES regras(id),
  origem_classificacao VARCHAR(20) CHECK (origem_classificacao IN ('regra','ia','manual','pendente')) DEFAULT 'pendente',
  score_confianca NUMERIC(5,2),
  historico_contabil TEXT,             -- histórico para a planilha final
  status VARCHAR(20) DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','rejeitado')),
  classificado_por INTEGER REFERENCES usuarios(id),
  classificado_em TIMESTAMP,
  est INTEGER DEFAULT 2               -- coluna EST da planilha
);

-- Log de ações (auditoria)
CREATE TABLE IF NOT EXISTS log_acoes (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER REFERENCES usuarios(id),
  acao VARCHAR(100) NOT NULL,
  tabela_ref VARCHAR(50),
  registro_id INTEGER,
  detalhes JSONB,
  criado_em TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- Índices para performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_regras_escritorio ON regras(escritorio_id);
CREATE INDEX IF NOT EXISTS idx_regras_padrao ON regras(padrao);
CREATE INDEX IF NOT EXISTS idx_lancamentos_extrato ON lancamentos(extrato_id);
CREATE INDEX IF NOT EXISTS idx_lancamentos_status ON lancamentos(status);
CREATE INDEX IF NOT EXISTS idx_extratos_cliente ON extratos(cliente_id);

-- ============================================================
-- Dados iniciais de exemplo (escritório demo)
-- ============================================================
INSERT INTO escritorios (nome) VALUES ('Escritório Demo') ON CONFLICT DO NOTHING;
