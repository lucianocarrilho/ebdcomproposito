import * as ftp from "basic-ftp";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Hostinger Config
const FTP_HOST = "147.79.89.224";
const FTP_USER = "u223033896.ebd2026";
const FTP_PASS = "iS5@TPUE8V";
const FTP_ROOT = "/"; // Root do app Node.js na Hostinger

async function deploy() {
  console.log("🚀 Iniciando Sistema de Auto-Migration e Auto-Deploy...");

  // 1. Gera o Prisma Client com a URL de produção na máquina local e sincroniza (Migration)
  console.log("\n📦 1/4 - Sincronizando Banco de Dados (Auto-Migration) com a Hostinger...");
  try {
    execSync('cmd /c "npx prisma generate"', { stdio: "inherit" });
    execSync(`cmd /c "set DATABASE_URL=mysql://u223033896_ebd2026:Eulk2180263%23@srv890.hstgr.io:3306/u223033896_ebd2026 && npx prisma db push --accept-data-loss"`, { stdio: "inherit" });
    console.log("✅ Banco de dados atualizado com sucesso!");
  } catch (error) {
    console.error("❌ Erro na migração do banco. Verifique suas credenciais!");
    process.exit(1);
  }

  // 2. Build do Next.js
  console.log("\n🏗️  2/4 - Construindo o projeto (Next.js Standalone Build) ...");
  try {
    execSync('cmd /c "npm run build"', { stdio: "inherit" });
    console.log("✅ Build concluído!");
  } catch (error) {
    console.error("❌ Erro no Build do Next.js!");
    process.exit(1);
  }

  // 3. Preparando Arquivos para o Ftp (Copiando Static e Public para a pasta standalone)
  console.log("\n📂 3/4 - Preparando pacotes para transporte...");
  const standaloneDir = path.join(__dirname, ".next", "standalone");
  const staticDirDest = path.join(standaloneDir, ".next", "static");
  const publicDirDest = path.join(standaloneDir, "public");

  fs.mkdirSync(standaloneDir, { recursive: true });
  fs.mkdirSync(staticDirDest, { recursive: true });
  fs.mkdirSync(publicDirDest, { recursive: true });

  try {
    execSync('cmd /c "xcopy /E /I /Y .next\\static .next\\standalone\\.next\\static"', { stdio: "ignore" });
    execSync('cmd /c "xcopy /E /I /Y public .next\\standalone\\public"', { stdio: "ignore" });
  } catch (error) {
    console.log("❌ Erro ao mover arquivos:", error);
    throw error;
  }

  // Cria um arquivo .env de produção que irá junto pro FTP
  const prodEnvContent = `DATABASE_URL="mysql://u223033896_ebd2026:Eulk2180263%23@srv890.hstgr.io:3306/u223033896_ebd2026"\nNEXTAUTH_URL="https://ebdcomproposito.com.br"\nAUTH_SECRET="ebd-com-proposito-secret-key-2026"\nAUTH_TRUST_HOST=true\nPORT=3000\nNODE_ENV=production`;
  fs.writeFileSync(path.join(standaloneDir, ".env"), prodEnvContent);

  // 4. Upload via FTP
  console.log("\n🌐 4/4 - Conectando ao FTP e enviando arquivos (Isso pode levar alguns minutos)...");
  const client = new ftp.Client();
  client.ftp.verbose = false;

  try {
    await client.access({
      host: FTP_HOST,
      user: FTP_USER,
      password: FTP_PASS,
      secure: false
    });

    console.log(`✅ Conectado ao FTP da Hostinger! Iniciando upload para ${FTP_ROOT}...`);
    
    // Assegura que o diretório base existe
    await client.ensureDir(FTP_ROOT);
    
    // Faz o upload de TODA a pasta standalone (que agora tem tudo)
    await client.uploadFromDir(standaloneDir);

    console.log("\n🎉 DEPLOY CONCLUÍDO COM SUCESSO! 🎉");
    console.log("🔗 Verifique seu site em: https://ebdcomproposito.com.br");
    console.log("⚠️  Atenção: Na Hostinger, lembre-se de ir no Painel HPanel > Node.js e clicar em 'Restart/Stop' para aplicar a nova versão!");
  } catch (err) {
    console.error("❌ Falha no Upload FTP:", err);
  }
  client.close();
}

deploy().catch(err => {
  console.error("GLOBAL ERROR:", err);
});
