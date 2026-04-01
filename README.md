# EBD com Propósito
### "Organização a serviço do Reino"

O **EBD com Propósito** é um Micro SaaS moderno, responsivo e intuitivo, desenvolvido para transformar a gestão da Escola Bíblica Dominical (EBD). Focado em igrejas que buscam excelência na organização e acompanhamento do crescimento espiritual de seus membros.

![Dashboard Preview](https://github.com/luciano-developer/ebd-com-proposito/raw/main/public/preview.png)

## 🚀 Tech Stack

- **Framework:** Next.js 15+ (App Router)
- **Estilização:** Tailwind CSS
- **Componentes:** shadcn/ui & Lucide React
- **Gráficos:** Recharts
- **Banco de Dados:** PostgreSQL (Vercel Postgres em produção)
- **ORM:** Prisma v7.6.0 (com Direct TCP Adapters)
- **Autenticação:** NextAuth.js v5 (Auth.js)

## ✨ Funcionalidades Principais

- **Dashboard Inteligente:** Visão geral da saúde da EBD, estatísticas de presença, rankings e aniversariantes.
- **Gestão de Alunos:** Cadastro completo, histórico de presença e acompanhamento de status (Batizado, Membro, Novo Convertido).
- **Gestão de Classes:** Organização por classes, definição de liderança (Professor, Dirigente) e auditório alvo.
- **Controle de Presença:** Registro simplificado de frequência com suporte a justificativas.
- **Relatórios:** Dados consolidados para tomadas de decisão pastoral e administrativa.
- **Sistema de Justificativas:** Gestão de faltas justificadas com motivos documentados.

## 🛠️ Configuração e Instalação Local

### 1. Clonar o repositório
```bash
git clone https://github.com/seu-usuario/ebd-app.git
cd ebd-app
```

### 2. Instalar dependências
```bash
npm install
```

### 3. Configurar Variáveis de Ambiente
Crie um arquivo `.env` na raiz do projeto:

```env
# Conexão TCP Direta (Local/Dev)
DATABASE_URL="postgres://usuario:senha@host:porta/database"

# NextAuth
AUTH_SECRET="uma-chave-secreta-muito-forte"
NEXTAUTH_URL="http://localhost:3000"
```

### 4. Preparar o Banco de Dados
O projeto utiliza o **Prisma v7** com adaptadores TCP para máxima compatibilidade:

```bash
# Sincronizar schema
npx prisma db push

# Gerar Client
npx prisma generate

# Popular com dados iniciais (Seed)
npx prisma db seed
```

### 5. Iniciar Servidor de Desenvolvimento
```bash
npm run dev
```

## 🌐 Deploy na Vercel

O projeto está otimizado para o ecossistema Vercel:

1. Conecte seu repositório GitHub na Vercel.
2. Adicione o Storage **Vercel Postgres**.
3. Configure as variáveis de ambiente no painel da Vercel:
   - `DATABASE_URL`: (Será injetada automaticamente pelo Vercel Postgres)
   - `AUTH_SECRET`: (Gere uma chave via `openssl rand -base64 32`)
4. O deploy será realizado automaticamente.

## 📁 Estrutura de Pastas

- `src/app/api`: Endpoints RESTful para integração com o banco.
- `src/app/dashboard`: Telas administrativas da aplicação.
- `src/components/ui`: Componentes de interface baseados no shadcn/ui.
- `src/lib`: Configurações de Singleton (Prisma, Auth).
- `prisma`: Schema do banco de dados e scripts de seed.

## 📄 Licença

Este projeto é destinado a fins de gestão eclesiástica. Sinta-se à vontade para adaptar às necessidades da sua congregação.

---

Desenvolvido com ❤️ para o Reino de Deus.
