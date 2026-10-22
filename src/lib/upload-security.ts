/**
 * upload-security.ts
 * Utilitários puros para validação rigorosa de uploads, assinaturas binárias e papéis de acesso.
 * Compatível estritamente com TypeScript (zero any, zero @ts-ignore).
 */

import path from "path";

export type AppRole =
  | "ADMIN"
  | "DIRIGENTE"
  | "VICE_DIRIGENTE"
  | "PROFESSOR"
  | "APOIO";

export const ALLOWED_IMAGE_ROLES: readonly AppRole[] = [
  "ADMIN",
  "DIRIGENTE",
  "VICE_DIRIGENTE",
  "PROFESSOR",
  "APOIO",
] as const;

export const ALLOWED_MATERIAL_ROLES: readonly AppRole[] = [
  "ADMIN",
] as const;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isAppRole(value: unknown): value is AppRole {
  return (
    typeof value === "string" &&
    ALLOWED_IMAGE_ROLES.includes(value as AppRole)
  );
}

export function extractUserRole(session: unknown): AppRole | null {
  if (!isRecord(session)) return null;
  const user = session["user"];
  if (!isRecord(user)) return null;
  const role = user["role"];
  if (isAppRole(role)) return role;
  return null;
}

export function isJpegSignature(buffer: Uint8Array): boolean {
  if (buffer.length < 3) return false;
  return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

export function isPngSignature(buffer: Uint8Array): boolean {
  if (buffer.length < 8) return false;
  return (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  );
}

export function isWebpSignature(buffer: Uint8Array): boolean {
  if (buffer.length < 12) return false;
  const isRiff =
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46;
  const isWebp =
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50;
  return isRiff && isWebp;
}

export function isPdfSignature(buffer: Uint8Array): boolean {
  if (buffer.length < 5) return false;
  return (
    buffer[0] === 0x25 && // %
    buffer[1] === 0x50 && // P
    buffer[2] === 0x44 && // D
    buffer[3] === 0x46 && // F
    buffer[4] === 0x2d    // -
  );
}

export function sanitizeFilename(filename: string): string {
  if (!filename || typeof filename !== "string") return "";
  let clean = filename.replace(/[\x00-\x1f\x7f]/g, "");
  clean = clean.replace(/\\/g, "/");
  const parts = clean.split("/").filter(Boolean);
  const base = parts.pop() || "";
  const sanitized = base.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/\.{2,}/g, ".");
  return sanitized.replace(/^\.+/, "");
}

export function getFileExtension(filename: string): string {
  const sanitized = sanitizeFilename(filename);
  const lastDot = sanitized.lastIndexOf(".");
  if (lastDot === -1 || lastDot === sanitized.length - 1) return "";
  return sanitized.slice(lastDot).toLowerCase();
}

export type ValidationResult<T = string> =
  | { valid: true; contentType: T; extension: string; sanitizedBaseName: string }
  | { valid: false; error: string; status: number };

export function validateImageUpload(
  filename: string,
  buffer: Uint8Array,
  declaredMimeType?: string | null
): ValidationResult<"image/jpeg" | "image/png" | "image/webp"> {
  if (!buffer || buffer.length === 0) {
    return { valid: false, error: "Arquivo vazio não permitido", status: 400 };
  }

  const MAX_IMAGE_SIZE = 4 * 1024 * 1024; // 4 MiB
  if (buffer.length > MAX_IMAGE_SIZE) {
    return { valid: false, error: "Arquivo excede o tamanho máximo de 4MB", status: 413 };
  }

  const sanitized = sanitizeFilename(filename);
  if (!sanitized) {
    return { valid: false, error: "Nome de arquivo inválido", status: 400 };
  }

  const ext = getFileExtension(sanitized);
  const normalizedMime = declaredMimeType?.toLowerCase().trim() || "";

  if (ext === ".jpg" || ext === ".jpeg") {
    if (
      normalizedMime &&
      normalizedMime !== "image/jpeg" &&
      normalizedMime !== "application/octet-stream"
    ) {
      return { valid: false, error: "Tipo MIME incompatível com extensão JPEG", status: 415 };
    }
    if (!isJpegSignature(buffer)) {
      return { valid: false, error: "Assinatura de arquivo inválida para JPEG", status: 415 };
    }
    return { valid: true, contentType: "image/jpeg", extension: ext, sanitizedBaseName: sanitized };
  }

  if (ext === ".png") {
    if (
      normalizedMime &&
      normalizedMime !== "image/png" &&
      normalizedMime !== "application/octet-stream"
    ) {
      return { valid: false, error: "Tipo MIME incompatível com extensão PNG", status: 415 };
    }
    if (!isPngSignature(buffer)) {
      return { valid: false, error: "Assinatura de arquivo inválida para PNG", status: 415 };
    }
    return { valid: true, contentType: "image/png", extension: ext, sanitizedBaseName: sanitized };
  }

  if (ext === ".webp") {
    if (
      normalizedMime &&
      normalizedMime !== "image/webp" &&
      normalizedMime !== "application/octet-stream"
    ) {
      return { valid: false, error: "Tipo MIME incompatível com extensão WebP", status: 415 };
    }
    if (!isWebpSignature(buffer)) {
      return { valid: false, error: "Assinatura de arquivo inválida para WebP", status: 415 };
    }
    return { valid: true, contentType: "image/webp", extension: ext, sanitizedBaseName: sanitized };
  }

  return {
    valid: false,
    error: "Formato de arquivo não permitido. Apenas JPEG, PNG e WebP são aceitos.",
    status: 415,
  };
}

export function validateMaterialUpload(
  filename: string,
  buffer: Uint8Array,
  declaredMimeType?: string | null
): ValidationResult<"application/pdf"> {
  if (!buffer || buffer.length === 0) {
    return { valid: false, error: "Arquivo vazio não permitido", status: 400 };
  }

  const MAX_MATERIAL_SIZE = 4 * 1024 * 1024; // 4 MiB
  if (buffer.length > MAX_MATERIAL_SIZE) {
    return { valid: false, error: "Arquivo excede o tamanho máximo de 4MB", status: 413 };
  }

  const sanitized = sanitizeFilename(filename);
  if (!sanitized) {
    return { valid: false, error: "Nome de arquivo inválido", status: 400 };
  }

  const ext = getFileExtension(sanitized);
  const normalizedMime = declaredMimeType?.toLowerCase().trim() || "";

  if (ext !== ".pdf") {
    return { valid: false, error: "Apenas arquivos PDF são permitidos para materiais", status: 415 };
  }

  if (
    normalizedMime &&
    normalizedMime !== "application/pdf" &&
    normalizedMime !== "application/octet-stream"
  ) {
    return { valid: false, error: "Tipo MIME incompatível com arquivo PDF", status: 415 };
  }

  if (!isPdfSignature(buffer)) {
    return { valid: false, error: "Assinatura de arquivo inválida para PDF", status: 415 };
  }

  return {
    valid: true,
    contentType: "application/pdf",
    extension: ".pdf",
    sanitizedBaseName: sanitized,
  };
}

export function generateSafeBlobPath(
  prefix: "images" | "materials",
  sanitizedName: string
): string {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  return `uploads/${prefix}/${timestamp}-${randomSuffix}-${sanitizedName}`;
}

export function getSafeLocalPath(baseDir: string, sanitizedName: string): string | null {
  const timestamp = Date.now();
  const safeFilename = `${timestamp}-${sanitizedName}`;
  const resolvedTarget = path.resolve(baseDir, safeFilename);
  const resolvedBase = path.resolve(baseDir);
  if (!resolvedTarget.startsWith(resolvedBase + path.sep)) {
    return null;
  }
  return resolvedTarget;
}
