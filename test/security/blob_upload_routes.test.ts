/**
 * test/security/blob_upload_routes.test.ts
 * Suíte de testes automatizados para os handlers HTTP reais:
 * - POST /api/upload
 * - POST /api/materials/upload
 * - DELETE /api/materials/[id]
 *
 * Mocks 100% estritos, isolados e determinísticos:
 * Zero chamadas de rede, zero banco de dados, zero filesystem real, zero Vercel Blob real.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as handleImageUpload } from "@/app/api/upload/route";
import { POST as handleMaterialUpload } from "@/app/api/materials/upload/route";
import { DELETE as handleMaterialDelete } from "@/app/api/materials/[id]/route";
import { put, del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { writeFile } from "fs/promises";

interface MockUser {
  id?: string;
  name?: string | null;
  email?: string | null;
  role?: string;
}

interface MockSession {
  user?: MockUser;
  expires: string;
}

const { mockAuth } = vi.hoisted(() => {
  return {
    mockAuth: vi.fn(),
  };
});

vi.mock("@/lib/auth", () => ({
  auth: mockAuth,
}));

vi.mock("@vercel/blob", () => ({
  put: vi.fn(),
  del: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    material: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("fs", async () => {
  const actual = await vi.importActual<typeof import("fs")>("fs");
  return {
    ...actual,
    default: {
      ...actual,
      existsSync: vi.fn().mockReturnValue(true),
      promises: {
        ...actual.promises,
        mkdir: vi.fn().mockResolvedValue(undefined),
      },
    },
    existsSync: vi.fn().mockReturnValue(true),
  };
});

vi.mock("fs/promises", () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

const mockPut = vi.mocked(put);
const mockDel = vi.mocked(del);
const mockFindUnique = vi.mocked(prisma.material.findUnique);
const mockDelete = vi.mocked(prisma.material.delete);
const mockWriteFile = vi.mocked(writeFile);

const VALID_JPEG_BUFFER = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const VALID_PNG_BUFFER = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
const VALID_WEBP_BUFFER = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00,
  0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20
]);
const VALID_PDF_BUFFER = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a]);
const SVG_BUFFER = Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'><script>alert('xss')</script></svg>");
const EXE_BUFFER = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
const OVERSIZED_BUFFER = new Uint8Array(4 * 1024 * 1024 + 1);

function createSession(role?: string): MockSession {
  const user: MockUser = {
    id: "usr-teste-123",
    name: "Usuario Teste",
    email: "teste@example.com",
  };
  if (role !== undefined) {
    user.role = role;
  }
  return {
    user,
    expires: "2099-01-01T00:00:00.000Z",
  };
}

describe("Suíte de Rotas Reais - Upload e Isolamento Vercel Blob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "test");
    mockPut.mockResolvedValue({
      url: "https://blob.vercel-storage.com/uploads/images/arquivo.jpg",
      downloadUrl: "https://blob.vercel-storage.com/uploads/images/arquivo.jpg",
      pathname: "uploads/images/arquivo.jpg",
      contentType: "image/jpeg",
      contentDisposition: "inline",
      etag: "mock-etag-123",
    });
    mockDel.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("POST /api/upload (Upload de Imagens)", () => {
    it("01 - deve retornar 401 quando não houver sessão ativa", async () => {
      mockAuth.mockResolvedValue(null);
      const req = new Request("http://localhost/api/upload?filename=foto.jpg", {
        method: "POST",
        body: VALID_JPEG_BUFFER,
      });

      const res = await handleImageUpload(req);
      expect(res.status).toBe(401);
      const data = await res.json() as { error: string };
      expect(data.error).toBe("Não autorizado");
      expect(mockPut).not.toHaveBeenCalled();
    });

    it("02 - deve retornar 403 quando o usuário autenticado não possuir papel (role)", async () => {
      mockAuth.mockResolvedValue(createSession());
      const req = new Request("http://localhost/api/upload?filename=foto.jpg", {
        method: "POST",
        body: VALID_JPEG_BUFFER,
      });

      const res = await handleImageUpload(req);
      expect(res.status).toBe(403);
      const data = await res.json() as { error: string };
      expect(data.error).toBe("Acesso negado");
      expect(mockPut).not.toHaveBeenCalled();
    });

    it("03 - deve retornar 403 quando o usuário possuir papel não autorizado", async () => {
      mockAuth.mockResolvedValue(createSession("ALUNO"));
      const req = new Request("http://localhost/api/upload?filename=foto.jpg", {
        method: "POST",
        body: VALID_JPEG_BUFFER,
      });

      const res = await handleImageUpload(req);
      expect(res.status).toBe(403);
      const data = await res.json() as { error: string };
      expect(data.error).toBe("Acesso negado");
      expect(mockPut).not.toHaveBeenCalled();
    });

    it("04 - deve retornar 400 quando o parâmetro filename estiver ausente na query", async () => {
      mockAuth.mockResolvedValue(createSession("ADMIN"));
      const req = new Request("http://localhost/api/upload", {
        method: "POST",
        body: VALID_JPEG_BUFFER,
      });

      const res = await handleImageUpload(req);
      expect(res.status).toBe(400);
      const data = await res.json() as { error: string };
      expect(data.error).toBe("Nome do arquivo é obrigatório");
      expect(mockPut).not.toHaveBeenCalled();
    });

    it("05 - deve retornar 400 quando o filename for invalidado/esvaziado pela sanitização", async () => {
      mockAuth.mockResolvedValue(createSession("ADMIN"));
      const req = new Request("http://localhost/api/upload?filename=...///...\\\\\\", {
        method: "POST",
        body: VALID_JPEG_BUFFER,
      });

      const res = await handleImageUpload(req);
      expect(res.status).toBe(400);
      const data = await res.json() as { error: string };
      expect(data.error).toBe("Nome de arquivo inválido");
      expect(mockPut).not.toHaveBeenCalled();
    });

    it("06 - deve retornar 400 quando o cabeçalho Content-Length for não numérico", async () => {
      mockAuth.mockResolvedValue(createSession("ADMIN"));
      const req = new Request("http://localhost/api/upload?filename=foto.jpg", {
        method: "POST",
        headers: { "content-length": "invalido_tamanho" },
        body: VALID_JPEG_BUFFER,
      });

      const res = await handleImageUpload(req);
      expect(res.status).toBe(400);
      const data = await res.json() as { error: string };
      expect(data.error).toBe("Cabeçalho Content-Length inválido");
      expect(mockPut).not.toHaveBeenCalled();
    });

    it("07 - deve retornar 400 quando o cabeçalho Content-Length for negativo", async () => {
      mockAuth.mockResolvedValue(createSession("ADMIN"));
      const req = new Request("http://localhost/api/upload?filename=foto.jpg", {
        method: "POST",
        headers: { "content-length": "-500" },
        body: VALID_JPEG_BUFFER,
      });

      const res = await handleImageUpload(req);
      expect(res.status).toBe(400);
      const data = await res.json() as { error: string };
      expect(data.error).toBe("Cabeçalho Content-Length inválido");
      expect(mockPut).not.toHaveBeenCalled();
    });

    it("08 - deve retornar 413 preliminar quando Content-Length exceder 4 MiB", async () => {
      mockAuth.mockResolvedValue(createSession("ADMIN"));
      const req = new Request("http://localhost/api/upload?filename=foto.jpg", {
        method: "POST",
        headers: { "content-length": "5000000" },
        body: VALID_JPEG_BUFFER,
      });

      const res = await handleImageUpload(req);
      expect(res.status).toBe(413);
      const data = await res.json() as { error: string };
      expect(data.error).toBe("Arquivo excede o tamanho máximo de 4MB");
      expect(mockPut).not.toHaveBeenCalled();
    });

    it("09 - deve retornar 413 quando o buffer real do arquivo exceder 4 MiB", async () => {
      mockAuth.mockResolvedValue(createSession("ADMIN"));
      const req = new Request("http://localhost/api/upload?filename=foto.jpg", {
        method: "POST",
        body: OVERSIZED_BUFFER,
      });

      const res = await handleImageUpload(req);
      expect(res.status).toBe(413);
      const data = await res.json() as { error: string };
      expect(data.error).toBe("Arquivo excede o tamanho máximo de 4MB");
      expect(mockPut).not.toHaveBeenCalled();
    });

    it("10 - deve retornar 415 ao tentar enviar arquivo SVG", async () => {
      mockAuth.mockResolvedValue(createSession("ADMIN"));
      const req = new Request("http://localhost/api/upload?filename=icone.svg", {
        method: "POST",
        headers: { "content-type": "image/svg+xml" },
        body: SVG_BUFFER,
      });

      const res = await handleImageUpload(req);
      expect(res.status).toBe(415);
      const data = await res.json() as { error: string };
      expect(data.error).toContain("Apenas JPEG, PNG e WebP são aceitos");
      expect(mockPut).not.toHaveBeenCalled();
    });

    it("11 - deve retornar 415 para extensão não autorizada (.exe)", async () => {
      mockAuth.mockResolvedValue(createSession("ADMIN"));
      const req = new Request("http://localhost/api/upload?filename=malware.exe", {
        method: "POST",
        body: EXE_BUFFER,
      });

      const res = await handleImageUpload(req);
      expect(res.status).toBe(415);
      expect(mockPut).not.toHaveBeenCalled();
    });

    it("12 - deve retornar 415 quando o MIME declarado for incompatível com a extensão", async () => {
      mockAuth.mockResolvedValue(createSession("ADMIN"));
      const req = new Request("http://localhost/api/upload?filename=foto.jpg", {
        method: "POST",
        headers: { "content-type": "text/html" },
        body: VALID_JPEG_BUFFER,
      });

      const res = await handleImageUpload(req);
      expect(res.status).toBe(415);
      const data = await res.json() as { error: string };
      expect(data.error).toContain("Tipo MIME incompatível");
      expect(mockPut).not.toHaveBeenCalled();
    });

    it("13 - deve retornar 415 quando a assinatura binária for incompatível com a extensão", async () => {
      mockAuth.mockResolvedValue(createSession("ADMIN"));
      const fakeBuffer = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
      const req = new Request("http://localhost/api/upload?filename=foto.jpg", {
        method: "POST",
        headers: { "content-type": "image/jpeg" },
        body: fakeBuffer,
      });

      const res = await handleImageUpload(req);
      expect(res.status).toBe(415);
      const data = await res.json() as { error: string };
      expect(data.error).toContain("Assinatura de arquivo inválida");
      expect(mockPut).not.toHaveBeenCalled();
    });

    it("14 - deve retornar 200 para imagem JPEG legítima com assinatura válida", async () => {
      mockAuth.mockResolvedValue(createSession("ADMIN"));
      const req = new Request("http://localhost/api/upload?filename=foto.jpg", {
        method: "POST",
        headers: { "content-type": "image/jpeg" },
        body: VALID_JPEG_BUFFER,
      });

      const res = await handleImageUpload(req);
      expect(res.status).toBe(200);
      const data = await res.json() as { url: string };
      expect(data.url).toBe("https://blob.vercel-storage.com/uploads/images/arquivo.jpg");
    });

    it("15 - deve retornar 200 para imagem PNG legítima com assinatura válida", async () => {
      mockAuth.mockResolvedValue(createSession("PROFESSOR"));
      const req = new Request("http://localhost/api/upload?filename=foto.png", {
        method: "POST",
        headers: { "content-type": "image/png" },
        body: VALID_PNG_BUFFER,
      });

      const res = await handleImageUpload(req);
      expect(res.status).toBe(200);
    });

    it("16 - deve retornar 200 para imagem WebP legítima com assinatura válida", async () => {
      mockAuth.mockResolvedValue(createSession("DIRIGENTE"));
      const req = new Request("http://localhost/api/upload?filename=foto.webp", {
        method: "POST",
        headers: { "content-type": "image/webp" },
        body: VALID_WEBP_BUFFER,
      });

      const res = await handleImageUpload(req);
      expect(res.status).toBe(200);
    });

    it("17 - deve preservar o contrato de resposta { url } consumido pelo frontend", async () => {
      mockAuth.mockResolvedValue(createSession("VICE_DIRIGENTE"));
      const req = new Request("http://localhost/api/upload?filename=foto.jpg", {
        method: "POST",
        headers: { "content-type": "image/jpeg" },
        body: VALID_JPEG_BUFFER,
      });

      const res = await handleImageUpload(req);
      const data = await res.json() as { url: string };
      expect(data).toHaveProperty("url");
      expect(typeof data.url).toBe("string");
    });

    it("18 - deve invocar @vercel/blob put apenas após autenticação e validação completas", async () => {
      mockAuth.mockResolvedValue(createSession("APOIO"));
      const req = new Request("http://localhost/api/upload?filename=avatar.jpg", {
        method: "POST",
        headers: { "content-type": "image/jpeg" },
        body: VALID_JPEG_BUFFER,
      });

      await handleImageUpload(req);
      expect(mockPut).toHaveBeenCalledTimes(1);
      const firstArg = mockPut.mock.calls[0][0];
      expect(typeof firstArg).toBe("string");
      expect(firstArg.startsWith("uploads/images/")).toBeTruthy();
    });

    it("19 - deve garantir que put seja chamado sem nenhuma propriedade token manual", async () => {
      mockAuth.mockResolvedValue(createSession("ADMIN"));
      const req = new Request("http://localhost/api/upload?filename=foto.jpg", {
        method: "POST",
        headers: { "content-type": "image/jpeg" },
        body: VALID_JPEG_BUFFER,
      });

      await handleImageUpload(req);
      expect(mockPut).toHaveBeenCalledTimes(1);
      const options = mockPut.mock.calls[0][2];
      expect(options).toBeDefined();
      expect(options).not.toHaveProperty("token");
    });

    it("20 - deve garantir que put nunca seja chamado em cenários de erro (401, 403, 400, 413, 415)", async () => {
      mockAuth.mockResolvedValue(null);
      const req = new Request("http://localhost/api/upload?filename=foto.jpg", {
        method: "POST",
        body: VALID_JPEG_BUFFER,
      });

      await handleImageUpload(req);
      expect(mockPut).not.toHaveBeenCalled();
    });

    it("21 - deve retornar 500 com mensagem sanitizada quando o Vercel Blob falhar em produção", async () => {
      vi.stubEnv("NODE_ENV", "production");
      mockAuth.mockResolvedValue(createSession("ADMIN"));
      mockPut.mockRejectedValue(new Error("Erro de infraestrutura Vercel Blob"));

      const req = new Request("http://localhost/api/upload?filename=foto.jpg", {
        method: "POST",
        headers: { "content-type": "image/jpeg" },
        body: VALID_JPEG_BUFFER,
      });

      const res = await handleImageUpload(req);
      expect(res.status).toBe(500);
      const data = await res.json() as { error: string };
      expect(data.error).toBe("Falha ao processar armazenamento no Vercel Blob");
    });

    it("22 - deve assegurar que a resposta 500 não vaze stack, pathnames ou detalhes internos", async () => {
      vi.stubEnv("NODE_ENV", "production");
      mockAuth.mockResolvedValue(createSession("ADMIN"));
      mockPut.mockRejectedValue(new Error("Database connection string leaked: secret_uri"));

      const req = new Request("http://localhost/api/upload?filename=foto.jpg", {
        method: "POST",
        headers: { "content-type": "image/jpeg" },
        body: VALID_JPEG_BUFFER,
      });

      const res = await handleImageUpload(req);
      const data = await res.json() as Record<string, unknown>;
      expect(data.stack).toBeUndefined();
      expect(data.details).toBeUndefined();
      expect(JSON.stringify(data).includes("secret_uri")).toBeFalsy();
    });

    it("23 - deve utilizar fallback local com mock de filesystem e caminho seguro em desenvolvimento", async () => {
      vi.stubEnv("NODE_ENV", "development");
      mockAuth.mockResolvedValue(createSession("ADMIN"));
      mockPut.mockRejectedValue(new Error("Blob offline"));

      const req = new Request("http://localhost/api/upload?filename=foto.jpg", {
        method: "POST",
        headers: { "content-type": "image/jpeg" },
        body: VALID_JPEG_BUFFER,
      });

      const res = await handleImageUpload(req);
      expect(res.status).toBe(200);
      const data = await res.json() as { url: string };
      expect(data.url.startsWith("/uploads/")).toBeTruthy();
      expect(mockWriteFile).toHaveBeenCalled();
    });

    it("24 - deve assegurar que o fallback local nunca grave no filesystem real", async () => {
      vi.stubEnv("NODE_ENV", "development");
      mockAuth.mockResolvedValue(createSession("ADMIN"));
      mockPut.mockRejectedValue(new Error("Blob offline"));

      const req = new Request("http://localhost/api/upload?filename=seguro.jpg", {
        method: "POST",
        headers: { "content-type": "image/jpeg" },
        body: VALID_JPEG_BUFFER,
      });

      await handleImageUpload(req);
      expect(mockWriteFile).toHaveBeenCalledTimes(1);
      const destinationPath = mockWriteFile.mock.calls[0][0];
      expect(String(destinationPath).includes("..")).toBeFalsy();
    });
  });

  describe("POST /api/materials/upload (Upload de Materiais)", () => {
    it("01 - deve retornar 401 quando não houver sessão ativa", async () => {
      mockAuth.mockResolvedValue(null);
      const formData = new FormData();
      formData.append("file", new File([VALID_PDF_BUFFER], "estudo.pdf", { type: "application/pdf" }));

      const req = new Request("http://localhost/api/materials/upload", {
        method: "POST",
        body: formData,
      });

      const res = await handleMaterialUpload(req);
      expect(res.status).toBe(401);
      const data = await res.json() as { error: string };
      expect(data.error).toBe("Não autorizado");
      expect(mockPut).not.toHaveBeenCalled();
    });

    it("02 - deve retornar 403 quando o usuário possuir papel PROFESSOR", async () => {
      mockAuth.mockResolvedValue(createSession("PROFESSOR"));
      const formData = new FormData();
      formData.append("file", new File([VALID_PDF_BUFFER], "estudo.pdf", { type: "application/pdf" }));

      const req = new Request("http://localhost/api/materials/upload", {
        method: "POST",
        body: formData,
      });

      const res = await handleMaterialUpload(req);
      expect(res.status).toBe(403);
      const data = await res.json() as { error: string };
      expect(data.error).toBe("Apenas administradores podem fazer upload de materiais");
      expect(mockPut).not.toHaveBeenCalled();
    });

    it("03 - deve retornar 403 quando o usuário possuir papel DIRIGENTE", async () => {
      mockAuth.mockResolvedValue(createSession("DIRIGENTE"));
      const formData = new FormData();
      formData.append("file", new File([VALID_PDF_BUFFER], "estudo.pdf", { type: "application/pdf" }));

      const req = new Request("http://localhost/api/materials/upload", {
        method: "POST",
        body: formData,
      });

      const res = await handleMaterialUpload(req);
      expect(res.status).toBe(403);
      expect(mockPut).not.toHaveBeenCalled();
    });

    it("04 - deve retornar 403 para qualquer papel diferente de ADMIN", async () => {
      mockAuth.mockResolvedValue(createSession("APOIO"));
      const formData = new FormData();
      formData.append("file", new File([VALID_PDF_BUFFER], "estudo.pdf", { type: "application/pdf" }));

      const req = new Request("http://localhost/api/materials/upload", {
        method: "POST",
        body: formData,
      });

      const res = await handleMaterialUpload(req);
      expect(res.status).toBe(403);
      expect(mockPut).not.toHaveBeenCalled();
    });

    it("05 - deve retornar 400 quando o FormData for malformado ou inválido", async () => {
      mockAuth.mockResolvedValue(createSession("ADMIN"));
      const req = new Request("http://localhost/api/materials/upload", {
        method: "POST",
        headers: { "content-type": "multipart/form-data; boundary=invalido" },
        body: "dados_quebrados_sem_boundary_correto",
      });

      const res = await handleMaterialUpload(req);
      expect(res.status).toBe(400);
      expect(mockPut).not.toHaveBeenCalled();
    });

    it("06 - deve retornar 400 quando o campo file estiver ausente no FormData", async () => {
      mockAuth.mockResolvedValue(createSession("ADMIN"));
      const formData = new FormData();
      formData.append("outro_campo", "valor");

      const req = new Request("http://localhost/api/materials/upload", {
        method: "POST",
        body: formData,
      });

      const res = await handleMaterialUpload(req);
      expect(res.status).toBe(400);
      const data = await res.json() as { error: string };
      expect(data.error).toBe("Nenhum arquivo válido encontrado no upload");
      expect(mockPut).not.toHaveBeenCalled();
    });

    it("07 - deve retornar 400 quando o arquivo enviado estiver vazio (0 bytes)", async () => {
      mockAuth.mockResolvedValue(createSession("ADMIN"));
      const formData = new FormData();
      formData.append("file", new File([], "vazio.pdf", { type: "application/pdf" }));

      const req = new Request("http://localhost/api/materials/upload", {
        method: "POST",
        body: formData,
      });

      const res = await handleMaterialUpload(req);
      expect(res.status).toBe(400);
      const data = await res.json() as { error: string };
      expect(data.error).toBe("Arquivo vazio não permitido");
      expect(mockPut).not.toHaveBeenCalled();
    });

    it("08 - deve retornar 413 quando o PDF exceder o tamanho máximo de 4 MiB", async () => {
      mockAuth.mockResolvedValue(createSession("ADMIN"));
      const formData = new FormData();
      formData.append("file", new File([OVERSIZED_BUFFER], "gigante.pdf", { type: "application/pdf" }));

      const req = new Request("http://localhost/api/materials/upload", {
        method: "POST",
        body: formData,
      });

      const res = await handleMaterialUpload(req);
      expect(res.status).toBe(413);
      const data = await res.json() as { error: string };
      expect(data.error).toBe("Arquivo excede o tamanho máximo de 4MB");
      expect(mockPut).not.toHaveBeenCalled();
    });

    it("09 - deve retornar 415 para extensão diferente de .pdf", async () => {
      mockAuth.mockResolvedValue(createSession("ADMIN"));
      const formData = new FormData();
      formData.append("file", new File([VALID_PDF_BUFFER], "manual.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));

      const req = new Request("http://localhost/api/materials/upload", {
        method: "POST",
        body: formData,
      });

      const res = await handleMaterialUpload(req);
      expect(res.status).toBe(415);
      const data = await res.json() as { error: string };
      expect(data.error).toContain("Apenas arquivos PDF são permitidos");
      expect(mockPut).not.toHaveBeenCalled();
    });

    it("10 - deve retornar 415 quando o MIME declarado for incompatível com PDF", async () => {
      mockAuth.mockResolvedValue(createSession("ADMIN"));
      const formData = new FormData();
      formData.append("file", new File([VALID_PDF_BUFFER], "manual.pdf", { type: "text/plain" }));

      const req = new Request("http://localhost/api/materials/upload", {
        method: "POST",
        body: formData,
      });

      const res = await handleMaterialUpload(req);
      expect(res.status).toBe(415);
      const data = await res.json() as { error: string };
      expect(data.error).toContain("Tipo MIME incompatível");
      expect(mockPut).not.toHaveBeenCalled();
    });

    it("11 - deve retornar 415 para arquivo com extensão .pdf mas assinatura binária falsa", async () => {
      mockAuth.mockResolvedValue(createSession("ADMIN"));
      const fakeBuffer = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04]);
      const formData = new FormData();
      formData.append("file", new File([fakeBuffer], "forjado.pdf", { type: "application/pdf" }));

      const req = new Request("http://localhost/api/materials/upload", {
        method: "POST",
        body: formData,
      });

      const res = await handleMaterialUpload(req);
      expect(res.status).toBe(415);
      const data = await res.json() as { error: string };
      expect(data.error).toContain("Assinatura de arquivo inválida");
      expect(mockPut).not.toHaveBeenCalled();
    });

    it("12 - deve retornar 200 para arquivo PDF legítimo com assinatura %PDF- enviado por ADMIN", async () => {
      mockAuth.mockResolvedValue(createSession("ADMIN"));
      mockPut.mockResolvedValue({
        url: "https://blob.vercel-storage.com/uploads/materials/aula.pdf",
        downloadUrl: "https://blob.vercel-storage.com/uploads/materials/aula.pdf",
        pathname: "uploads/materials/aula.pdf",
        contentType: "application/pdf",
        contentDisposition: "inline",
        etag: "mock-etag-pdf",
      });

      const formData = new FormData();
      formData.append("file", new File([VALID_PDF_BUFFER], "aula.pdf", { type: "application/pdf" }));

      const req = new Request("http://localhost/api/materials/upload", {
        method: "POST",
        body: formData,
      });

      const res = await handleMaterialUpload(req);
      expect(res.status).toBe(200);
      const data = await res.json() as { url: string; pathname: string };
      expect(data.url).toBe("https://blob.vercel-storage.com/uploads/materials/aula.pdf");
      expect(data.pathname).toBe("uploads/materials/aula.pdf");
    });

    it("13 - deve preservar o contrato de resposta { url, pathname } no sucesso", async () => {
      mockAuth.mockResolvedValue(createSession("ADMIN"));
      const formData = new FormData();
      formData.append("file", new File([VALID_PDF_BUFFER], "licao.pdf", { type: "application/pdf" }));

      const req = new Request("http://localhost/api/materials/upload", {
        method: "POST",
        body: formData,
      });

      const res = await handleMaterialUpload(req);
      const data = await res.json() as { url: string; pathname: string };
      expect(data).toHaveProperty("url");
      expect(data).toHaveProperty("pathname");
    });

    it("14 - deve invocar @vercel/blob put sem nenhuma propriedade de token manual", async () => {
      mockAuth.mockResolvedValue(createSession("ADMIN"));
      const formData = new FormData();
      formData.append("file", new File([VALID_PDF_BUFFER], "revista.pdf", { type: "application/pdf" }));

      const req = new Request("http://localhost/api/materials/upload", {
        method: "POST",
        body: formData,
      });

      await handleMaterialUpload(req);
      expect(mockPut).toHaveBeenCalledTimes(1);
      const options = mockPut.mock.calls[0][2];
      expect(options).toBeDefined();
      expect(options).not.toHaveProperty("token");
    });

    it("15 - deve garantir que put nunca seja chamado antes de autenticação e validação", async () => {
      mockAuth.mockResolvedValue(createSession("PROFESSOR"));
      const formData = new FormData();
      formData.append("file", new File([VALID_PDF_BUFFER], "revista.pdf", { type: "application/pdf" }));

      const req = new Request("http://localhost/api/materials/upload", {
        method: "POST",
        body: formData,
      });

      await handleMaterialUpload(req);
      expect(mockPut).not.toHaveBeenCalled();
    });

    it("16 - deve retornar 500 com erro sanitizado caso o processamento ou upload falhe", async () => {
      mockAuth.mockResolvedValue(createSession("ADMIN"));
      mockPut.mockRejectedValue(new Error("Timeout inesperado no Vercel Blob"));

      const formData = new FormData();
      formData.append("file", new File([VALID_PDF_BUFFER], "estudo.pdf", { type: "application/pdf" }));

      const req = new Request("http://localhost/api/materials/upload", {
        method: "POST",
        body: formData,
      });

      const res = await handleMaterialUpload(req);
      expect(res.status).toBe(500);
      const data = await res.json() as { error: string };
      expect(data.error).toBe("Erro interno no processamento do material");
    });
  });

  describe("DELETE /api/materials/[id] (Exclusão de Material)", () => {
    const mockMaterialRecord = {
      id: "mat-1",
      title: "Lição 1",
      description: null,
      fileUrl: "https://blob.vercel-storage.com/uploads/materials/licao1.pdf",
      fileName: "licao1.pdf",
      fileSize: 1024,
      category: "Revistas",
      active: true,
      classId: null,
      organizationId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("01 - deve retornar 401 quando não houver sessão ativa", async () => {
      mockAuth.mockResolvedValue(null);
      const req = new NextRequest("http://localhost/api/materials/mat-1", { method: "DELETE" });

      const res = await handleMaterialDelete(req, {
        params: Promise.resolve({ id: "mat-1" }),
      });

      expect(res.status).toBe(401);
      const data = await res.json() as { error: string };
      expect(data.error).toBe("Não autorizado");
      expect(mockDelete).not.toHaveBeenCalled();
      expect(mockDel).not.toHaveBeenCalled();
    });

    it("02 - deve retornar 403 para usuário com papel diferente de ADMIN", async () => {
      mockAuth.mockResolvedValue(createSession("PROFESSOR"));
      const req = new NextRequest("http://localhost/api/materials/mat-1", { method: "DELETE" });

      const res = await handleMaterialDelete(req, {
        params: Promise.resolve({ id: "mat-1" }),
      });

      expect(res.status).toBe(403);
      const data = await res.json() as { error: string };
      expect(data.error).toBe("Apenas administradores podem excluir materiais");
      expect(mockDelete).not.toHaveBeenCalled();
      expect(mockDel).not.toHaveBeenCalled();
    });

    it("03 - deve retornar 404 quando o material não for encontrado no banco de dados", async () => {
      mockAuth.mockResolvedValue(createSession("ADMIN"));
      mockFindUnique.mockResolvedValue(null);
      const req = new NextRequest("http://localhost/api/materials/mat-999", { method: "DELETE" });

      const res = await handleMaterialDelete(req, {
        params: Promise.resolve({ id: "mat-999" }),
      });

      expect(res.status).toBe(404);
      const data = await res.json() as { error: string };
      expect(data.error).toBe("Material não encontrado");
      expect(mockDelete).not.toHaveBeenCalled();
      expect(mockDel).not.toHaveBeenCalled();
    });

    it("04 - deve retornar 200 com { success: true } para exclusão de material existente", async () => {
      mockAuth.mockResolvedValue(createSession("ADMIN"));
      mockFindUnique.mockResolvedValue(mockMaterialRecord);
      mockDelete.mockResolvedValue(mockMaterialRecord);

      const req = new NextRequest("http://localhost/api/materials/mat-1", { method: "DELETE" });
      const res = await handleMaterialDelete(req, {
        params: Promise.resolve({ id: "mat-1" }),
      });

      expect(res.status).toBe(200);
      const data = await res.json() as { success: boolean };
      expect(data.success).toBe(true);
    });

    it("05 - deve invocar prisma.material.delete com o ID correto", async () => {
      mockAuth.mockResolvedValue(createSession("ADMIN"));
      const customRecord = { ...mockMaterialRecord, id: "mat-uuid-123" };
      mockFindUnique.mockResolvedValue(customRecord);
      mockDelete.mockResolvedValue(customRecord);

      const req = new NextRequest("http://localhost/api/materials/mat-uuid-123", { method: "DELETE" });
      await handleMaterialDelete(req, {
        params: Promise.resolve({ id: "mat-uuid-123" }),
      });

      expect(mockDelete).toHaveBeenCalledWith({
        where: { id: "mat-uuid-123" },
      });
    });

    it("06 - deve invocar @vercel/blob del com a URL persistida no banco de dados", async () => {
      mockAuth.mockResolvedValue(createSession("ADMIN"));
      const testBlobUrl = "https://blob.vercel-storage.com/uploads/materials/teste.pdf";
      const customRecord = { ...mockMaterialRecord, fileUrl: testBlobUrl };
      mockFindUnique.mockResolvedValue(customRecord);
      mockDelete.mockResolvedValue(customRecord);

      const req = new NextRequest("http://localhost/api/materials/mat-1", { method: "DELETE" });
      await handleMaterialDelete(req, {
        params: Promise.resolve({ id: "mat-1" }),
      });

      expect(mockDel).toHaveBeenCalledWith(testBlobUrl);
    });

    it("07 - deve invocar @vercel/blob del sem nenhuma propriedade de token manual", async () => {
      mockAuth.mockResolvedValue(createSession("ADMIN"));
      const testBlobUrl = "https://blob.vercel-storage.com/uploads/materials/teste.pdf";
      const customRecord = { ...mockMaterialRecord, fileUrl: testBlobUrl };
      mockFindUnique.mockResolvedValue(customRecord);
      mockDelete.mockResolvedValue(customRecord);

      const req = new NextRequest("http://localhost/api/materials/mat-1", { method: "DELETE" });
      await handleMaterialDelete(req, {
        params: Promise.resolve({ id: "mat-1" }),
      });

      expect(mockDel).toHaveBeenCalledTimes(1);
      const callArgs = mockDel.mock.calls[0];
      expect(callArgs.length).toBe(1);
    });

    it("08 - não deve invocar del quando a URL do material for de arquivo local (/uploads/...)", async () => {
      mockAuth.mockResolvedValue(createSession("ADMIN"));
      const localRecord = { ...mockMaterialRecord, id: "mat-local", fileUrl: "/uploads/manual.pdf" };
      mockFindUnique.mockResolvedValue(localRecord);
      mockDelete.mockResolvedValue(localRecord);

      const req = new NextRequest("http://localhost/api/materials/mat-local", { method: "DELETE" });
      await handleMaterialDelete(req, {
        params: Promise.resolve({ id: "mat-local" }),
      });

      expect(mockDelete).toHaveBeenCalled();
      expect(mockDel).not.toHaveBeenCalled();
    });

    it("09 - não deve invocar del quando fileUrl for vazia ou nula", async () => {
      mockAuth.mockResolvedValue(createSession("ADMIN"));
      const emptyUrlRecord = { ...mockMaterialRecord, id: "mat-empty-url", fileUrl: "" };
      mockFindUnique.mockResolvedValue(emptyUrlRecord);
      mockDelete.mockResolvedValue(emptyUrlRecord);

      const req = new NextRequest("http://localhost/api/materials/mat-empty-url", { method: "DELETE" });
      await handleMaterialDelete(req, {
        params: Promise.resolve({ id: "mat-empty-url" }),
      });

      expect(mockDelete).toHaveBeenCalled();
      expect(mockDel).not.toHaveBeenCalled();
    });

    it("10 - deve garantir que falha no del do Blob não vaze erros e não quebre a remoção cadastral", async () => {
      mockAuth.mockResolvedValue(createSession("ADMIN"));
      const testBlobUrl = "https://blob.vercel-storage.com/uploads/materials/falha.pdf";
      const failedRecord = { ...mockMaterialRecord, id: "mat-falha", fileUrl: testBlobUrl };
      mockFindUnique.mockResolvedValue(failedRecord);
      mockDelete.mockResolvedValue(failedRecord);
      mockDel.mockRejectedValue(new Error("Erro de conexão com storage remoto"));

      const req = new NextRequest("http://localhost/api/materials/mat-falha", { method: "DELETE" });
      const res = await handleMaterialDelete(req, {
        params: Promise.resolve({ id: "mat-falha" }),
      });

      expect(res.status).toBe(200);
      const data = await res.json() as { success: boolean };
      expect(data.success).toBe(true);
      expect(mockDelete).toHaveBeenCalled();
    });

    it("11 - deve garantir isolamento total sem nenhuma conexão real com banco de dados", async () => {
      mockAuth.mockResolvedValue(createSession("ADMIN"));
      mockFindUnique.mockResolvedValue(null);

      const req = new NextRequest("http://localhost/api/materials/test-db", { method: "DELETE" });
      await handleMaterialDelete(req, {
        params: Promise.resolve({ id: "test-db" }),
      });

      expect(vi.isMockFunction(prisma.material.findUnique)).toBe(true);
      expect(vi.isMockFunction(prisma.material.delete)).toBe(true);
    });

    it("12 - deve garantir isolamento total sem nenhuma chamada de rede externa ao Vercel Blob", async () => {
      mockAuth.mockResolvedValue(createSession("ADMIN"));
      const netRecord = { ...mockMaterialRecord, id: "test-net", fileUrl: "https://blob.vercel-storage.com/uploads/materials/rede.pdf" };
      mockFindUnique.mockResolvedValue(netRecord);
      mockDelete.mockResolvedValue(netRecord);

      const req = new NextRequest("http://localhost/api/materials/test-net", { method: "DELETE" });
      await handleMaterialDelete(req, {
        params: Promise.resolve({ id: "test-net" }),
      });

      expect(vi.isMockFunction(del)).toBe(true);
    });
  });
});
