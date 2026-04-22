# Arquitetura do Projeto "EBD com Propósito"

> ⚠️ Este arquivo documenta a infraestrutura do projeto para não haver mais confusões com deploys no futuro.

## Front-end & Next.js (Vercel)
- **Hospedagem da Aplicação:** O código inteiro (Next.js, UI, Front-end e Back-end da API) está rodando na Vercel.
- **Deploy:** O deploy ocorre de forma 100% automática a cada push para a branch `main` no repositório oficial do GitHub. 
- Apenas faça `git commit` e `git push`, e a Vercel assume toda a compilação e deploy. Não são mais necessários scripts FTP complexos locais.

## Banco de Dados (Hostinger)
- **O que a Hostinger guarda?** Exclusivamente os dados da aplicação. O banco de dados MySQL está alocado nos servidores da Hostinger. 
- A aplicação na Vercel se conecta à base de dados na Hostinger através da string contida em `DATABASE_URL` (localizada no seu `.env`). 
- Em hipótese alguma o código precisa ser enviado via FTP para a Hostinger. Todo controle de hospedagem do projeto é da Vercel.

**Em resumo: Vercel = Roda o Site / Hostinger = Armazena o MySQL.**
