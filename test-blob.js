// Script de diagnóstico para testar o Vercel Blob
const { put } = require("@vercel/blob");

const BLOB_TOKEN = "vercel_blob_rw_12Z3rqWooPyc8G9Q_QvILDyvVrVA0gqpZJAmg0V6eR2qg8A";

async function testBlobConnection() {
  console.log("=== Testando conexão com Vercel Blob ===\n");
  console.log("Token (primeiros 30 chars):", BLOB_TOKEN.substring(0, 30) + "...");
  
  try {
    const testContent = "Teste de upload - " + new Date().toISOString();
    console.log("\nTentando upload de teste...");
    
    const blob = await put("test-diagnostico.txt", testContent, {
      access: "public",
      token: BLOB_TOKEN,
      addRandomSuffix: true,
    });
    
    console.log("\n✅ SUCESSO! O Vercel Blob está funcionando.");
    console.log("URL:", blob.url);
    console.log("Pathname:", blob.pathname);
    console.log("Content Type:", blob.contentType);
    
    // Limpar o arquivo de teste
    const { del } = require("@vercel/blob");
    await del(blob.url, { token: BLOB_TOKEN });
    console.log("\n🗑️ Arquivo de teste removido com sucesso.");
    
  } catch (error) {
    console.error("\n❌ ERRO ao conectar com Vercel Blob:");
    console.error("Mensagem:", error.message);
    console.error("Código:", error.code);
    console.error("Status:", error.status);
    console.error("\nErro completo:", JSON.stringify(error, null, 2));
  }
}

testBlobConnection();
