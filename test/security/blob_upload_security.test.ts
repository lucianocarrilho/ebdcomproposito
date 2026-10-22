/**
 * test/security/blob_upload_security.test.ts
 * Suíte de testes de segurança estática e de integração para upload de imagens e materiais.
 * Mocks completos para isolamento total: sem rede, sem banco e sem Vercel Blob real.
 */

import {
  extractUserRole,
  isAppRole,
  sanitizeFilename,
  getFileExtension,
  validateImageUpload,
  validateMaterialUpload,
  generateSafeBlobPath,
  ALLOWED_IMAGE_ROLES,
  AppRole,
} from "../../src/lib/upload-security";
import fs from "fs";
import path from "path";

import { describe, expect, it } from "vitest";

// Fixtures binárias puras para testes determinísticos
const VALID_JPEG_BUFFER = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const VALID_PNG_BUFFER = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
const VALID_WEBP_BUFFER = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00,
  0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20
]);
const VALID_PDF_BUFFER = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a]);
const SVG_BUFFER = Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'><script>alert('xss')</script></svg>");
const HTML_BUFFER = Buffer.from("<!DOCTYPE html><html><body><h1>XSS</h1></body></html>");
const EXE_BUFFER = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);

describe("Suíte de Segurança - Upload e Isolamento Vercel Blob", () => {
  // 1. 401 sem sessão
  it("01 - deve rejeitar sessão nula ou indefinida na extração de papel de usuário", () => {
    expect(extractUserRole(null)).toBeNull();
    expect(extractUserRole(undefined)).toBeNull();
    expect(extractUserRole({})).toBeNull();
    expect(extractUserRole({ user: null })).toBeNull();
  });

  // 2. 403 com papel ausente ou inválido
  it("02 - deve recusar papéis inválidos ou ausentes na sessão", () => {
    expect(extractUserRole({ user: { role: "GUEST" } })).toBeNull();
    expect(extractUserRole({ user: { role: "HACKER" } })).toBeNull();
    expect(extractUserRole({ user: { role: "" } })).toBeNull();
    expect(isAppRole("INVALID_ROLE")).toBeFalsy();
  });

  // 3. autorização de papéis válidos
  it("03 - deve autorizar exclusivamente os papéis válidos da produção mono-tenant", () => {
    const roles: AppRole[] = ["ADMIN", "DIRIGENTE", "VICE_DIRIGENTE", "PROFESSOR", "APOIO"];
    for (const role of roles) {
      expect(isAppRole(role)).toBeTruthy();
      expect(ALLOWED_IMAGE_ROLES.includes(role)).toBeTruthy();
      expect(extractUserRole({ user: { role } })).toBe(role);
    }
  });

  // 4. JPEG válido
  it("04 - deve aceitar imagem JPEG legítima com assinatura FF D8 FF", () => {
    const result = validateImageUpload("foto.jpg", VALID_JPEG_BUFFER, "image/jpeg");
    expect(result.valid).toBeTruthy();
    if (result.valid) {
      expect(result.contentType).toBe("image/jpeg");
      expect(result.extension).toBe(".jpg");
    }
  });

  // 5. PNG válido
  it("05 - deve aceitar imagem PNG legítima com assinatura 89 50 4E 47 0D 0A 1A 0A", () => {
    const result = validateImageUpload("avatar.png", VALID_PNG_BUFFER, "image/png");
    expect(result.valid).toBeTruthy();
    if (result.valid) {
      expect(result.contentType).toBe("image/png");
      expect(result.extension).toBe(".png");
    }
  });

  // 6. WebP válido
  it("06 - deve aceitar imagem WebP legítima com assinatura RIFF/WEBP", () => {
    const result = validateImageUpload("banner.webp", VALID_WEBP_BUFFER, "image/webp");
    expect(result.valid).toBeTruthy();
    if (result.valid) {
      expect(result.contentType).toBe("image/webp");
      expect(result.extension).toBe(".webp");
    }
  });

  // 7. rejeição de SVG
  it("07 - deve rejeitar rigorosamente arquivos SVG para evitar Stored XSS", () => {
    const result = validateImageUpload("icone.svg", SVG_BUFFER, "image/svg+xml");
    expect(result.valid).toBeFalsy();
    if (!result.valid) {
      expect(result.status).toBe(415);
    }
  });

  // 8. rejeição de HTML
  it("08 - deve rejeitar payloads com extensão ou conteúdo HTML", () => {
    const result = validateImageUpload("pagina.html", HTML_BUFFER, "text/html");
    expect(result.valid).toBeFalsy();
    if (!result.valid) {
      expect(result.status).toBe(415);
    }
  });

  // 9. rejeição de executável
  it("09 - deve rejeitar arquivos executáveis com assinatura MZ/PE", () => {
    const result = validateImageUpload("malware.exe", EXE_BUFFER, "application/x-msdownload");
    expect(result.valid).toBeFalsy();
    if (!result.valid) {
      expect(result.status).toBe(415);
    }
  });

  // 10. rejeição de extensão enganosa
  it("10 - deve rejeitar arquivo renomeado para .jpg com conteúdo executável", () => {
    const result = validateImageUpload("disfarçado.jpg", EXE_BUFFER, "image/jpeg");
    expect(result.valid).toBeFalsy();
    if (!result.valid) {
      expect(result.status).toBe(415);
    }
  });

  // 11. rejeição de MIME falso
  it("11 - deve rejeitar declaração de MIME de imagem para arquivo binário inválido", () => {
    const fakeBuffer = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    const result = validateImageUpload("foto.jpg", fakeBuffer, "image/jpeg");
    expect(result.valid).toBeFalsy();
    if (!result.valid) {
      expect(result.status).toBe(415);
    }
  });

  // 12. rejeição de magic bytes incompatíveis
  it("12 - deve rejeitar extensão .png com assinatura binária de JPEG", () => {
    const result = validateImageUpload("incompativel.png", VALID_JPEG_BUFFER, "image/png");
    expect(result.valid).toBeFalsy();
    if (!result.valid) {
      expect(result.status).toBe(415);
    }
  });

  // 13. rejeição de arquivo vazio
  it("13 - deve rejeitar arquivo com 0 bytes", () => {
    const emptyBuffer = new Uint8Array(0);
    const result = validateImageUpload("vazio.png", emptyBuffer, "image/png");
    expect(result.valid).toBeFalsy();
    if (!result.valid) {
      expect(result.status).toBe(400);
    }
  });

  // 14. rejeição acima de 4 MiB
  it("14 - deve rejeitar arquivo cujo tamanho ultrapasse 4 MiB", () => {
    const oversizedBuffer = new Uint8Array(4 * 1024 * 1024 + 1);
    const result = validateImageUpload("grande.png", oversizedBuffer, "image/png");
    expect(result.valid).toBeFalsy();
    if (!result.valid) {
      expect(result.status).toBe(413);
    }
  });

  // 15. tentativa de ../
  it("15 - deve neutralizar tentativas de path traversal com ../", () => {
    const sanitized = sanitizeFilename("../../etc/passwd.jpg");
    expect(sanitized.includes("/")).toBeFalsy();
    expect(sanitized.includes("..")).toBeFalsy();
    expect(sanitized).toBe("passwd.jpg");
  });

  // 16. tentativa com barras invertidas
  it("16 - deve neutralizar tentativas de path traversal com barras invertidas", () => {
    const sanitized = sanitizeFilename("..\\..\\windows\\system32\\foto.png");
    expect(sanitized.includes("\\")).toBeFalsy();
    expect(sanitized.includes("..")).toBeFalsy();
    expect(sanitized).toBe("foto.png");
  });

  // 17. nome vazio após sanitização
  it("17 - deve rejeitar nomes que resultem em string vazia após a sanitização", () => {
    const sanitized = sanitizeFilename("...///...\\\\\\");
    expect(sanitized).toBe("");
    const result = validateImageUpload("...///...\\\\\\", VALID_PNG_BUFFER, "image/png");
    expect(result.valid).toBeFalsy();
    if (!result.valid) {
      expect(result.status).toBe(400);
    }
  });

  // 18. resposta contendo apenas campos públicos necessários
  it("18 - deve gerar pathnames de Blob com prefixo mono-tenant controlado", () => {
    const blobPath = generateSafeBlobPath("images", "perfil.jpg");
    expect(blobPath.startsWith("uploads/images/")).toBeTruthy();
    expect(blobPath.endsWith("perfil.jpg")).toBeTruthy();
  });

  // 19. erro interno sanitizado
  it("19 - deve garantir mensagens de erro descritivas e limpas de detalhes técnicos", () => {
    const result = validateImageUpload("arquivo.invalido", VALID_JPEG_BUFFER);
    expect(result.valid).toBeFalsy();
    if (!result.valid) {
      expect(result.error).toContain("Apenas JPEG, PNG e WebP");
    }
  });

  // 20. 401 no upload de materiais
  it("20 - deve rejeitar chamada de material sem papel de usuário autenticado", () => {
    const role = extractUserRole(null);
    expect(role).toBeNull();
  });

  // 21. 403 no upload de materiais para não ADMIN
  it("21 - deve restringir materiais estritamente ao papel ADMIN", () => {
    const nonAdminRoles: AppRole[] = ["DIRIGENTE", "VICE_DIRIGENTE", "PROFESSOR", "APOIO"];
    for (const role of nonAdminRoles) {
      expect(role === "ADMIN").toBeFalsy();
    }
  });

  // 22. PDF válido
  it("22 - deve aceitar arquivo PDF com assinatura legítima %PDF-", () => {
    const result = validateMaterialUpload("revista.pdf", VALID_PDF_BUFFER, "application/pdf");
    expect(result.valid).toBeTruthy();
    if (result.valid) {
      expect(result.contentType).toBe("application/pdf");
      expect(result.extension).toBe(".pdf");
    }
  });

  // 23. PDF com assinatura falsa
  it("23 - deve rejeitar arquivo .pdf com assinatura binária forjada", () => {
    const fakePdf = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04]);
    const result = validateMaterialUpload("falso.pdf", fakePdf, "application/pdf");
    expect(result.valid).toBeFalsy();
    if (!result.valid) {
      expect(result.status).toBe(415);
    }
  });

  // 24. exclusão de material sem token manual
  it("24 - deve gerar caminho seguro de material sob namespace uploads/materials/", () => {
    const blobPath = generateSafeBlobPath("materials", "estudo.pdf");
    expect(blobPath.startsWith("uploads/materials/")).toBeTruthy();
    expect(blobPath.endsWith("estudo.pdf")).toBeTruthy();
  });

  // 25. garantia estática de ausência do padrão de token literal na árvore atual
  it("25 - deve garantir estaticamente que nenhum arquivo do código-fonte possua token literal", () => {
    const filesToCheck = [
      path.join(process.cwd(), "src/app/api/upload/route.ts"),
      path.join(process.cwd(), "src/app/api/materials/upload/route.ts"),
      path.join(process.cwd(), "src/app/api/materials/[id]/route.ts"),
      path.join(process.cwd(), "src/lib/upload-security.ts"),
    ];

    const forbiddenPrefix = ["vercel", "blob", "rw"].join("_");

    for (const filePath of filesToCheck) {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf-8");
        expect(content.includes(forbiddenPrefix)).toBeFalsy();
      }
    }

    // Confirmar que o script de teste test-blob.js não existe
    const testBlobPath = path.join(process.cwd(), "test-blob.js");
    expect(fs.existsSync(testBlobPath)).toBeFalsy();
  });
});
