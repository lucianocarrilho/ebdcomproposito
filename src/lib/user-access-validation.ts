import type { Role } from "@prisma/client";
import type { ValidationResult } from "@/lib/organization-validation";

export const USER_NAME_MAX_LENGTH = 191;
export const USER_EMAIL_MAX_LENGTH = 191;
export const USER_IMAGE_MAX_LENGTH = 191;

export const VALID_ORGANIZATION_ROLES: readonly Role[] = [
  "ADMIN",
  "DIRIGENTE",
  "VICE_DIRIGENTE",
  "PROFESSOR",
  "APOIO",
] as const;

const VALID_ROLE_SET = new Set<string>(VALID_ORGANIZATION_ROLES);
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ALLOWED_CREATE_ACCESS_FIELDS = new Set([
  "name",
  "email",
  "password",
  "role",
  "image",
  "birthDate",
]);

const ALLOWED_UPDATE_ACCESS_FIELDS = new Set([
  "name",
  "email",
  "password",
  "role",
  "image",
  "birthDate",
]);

export interface CreateUserAccessInput {
  email: string;
  role: Role;
  name?: string;
  password?: string;
  image?: string | null;
  birthDate?: Date | null;
}

export interface UpdateUserAccessInput {
  role?: Role;
  name?: string;
  email?: string;
  password?: string;
  image?: string | null;
  birthDate?: Date | null;
}

export interface SessionMembershipLike {
  organizationId?: string | null;
  organizationName?: string | null;
  role?: string | null;
}

export interface SessionUserLike {
  role?: string | null;
  isGlobalAdmin?: boolean;
  globalAdminMode?: boolean;
  activeOrganizationId?: string | null;
  activeOrganizationName?: string | null;
  memberships?: SessionMembershipLike[] | null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function findDisallowedFields(
  body: Record<string, unknown>,
  allowedFields: ReadonlySet<string>
): string[] {
  return Object.keys(body).filter((key) => !allowedFields.has(key));
}

export function normalizeAccessEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateAccessRole(rawRole: unknown): ValidationResult<Role> {
  if (typeof rawRole !== "string" || !VALID_ROLE_SET.has(rawRole)) {
    return {
      valid: false,
      error: "Perfil de permissão inválido.",
    };
  }

  return { valid: true, data: rawRole as Role };
}

export function validateAccessEmail(rawEmail: unknown): ValidationResult<string> {
  if (typeof rawEmail !== "string") {
    return { valid: false, error: "E-mail é obrigatório." };
  }

  const normalized = normalizeAccessEmail(rawEmail);
  if (!normalized) {
    return { valid: false, error: "E-mail é obrigatório." };
  }

  if (normalized.length > USER_EMAIL_MAX_LENGTH) {
    return {
      valid: false,
      error: `E-mail deve ter no máximo ${USER_EMAIL_MAX_LENGTH} caracteres.`,
    };
  }

  if (!EMAIL_REGEX.test(normalized)) {
    return { valid: false, error: "Formato de e-mail inválido." };
  }

  return { valid: true, data: normalized };
}

export function validateAccessName(rawName: unknown): ValidationResult<string> {
  if (typeof rawName !== "string") {
    return { valid: false, error: "Nome é obrigatório." };
  }

  const trimmed = rawName.trim();
  if (!trimmed) {
    return { valid: false, error: "Nome é obrigatório." };
  }

  if (trimmed.length > USER_NAME_MAX_LENGTH) {
    return {
      valid: false,
      error: `Nome deve ter no máximo ${USER_NAME_MAX_LENGTH} caracteres.`,
    };
  }

  return { valid: true, data: trimmed };
}

export function validateOptionalAccessPassword(
  rawPassword: unknown
): ValidationResult<string | undefined> {
  if (rawPassword === undefined || rawPassword === null || rawPassword === "") {
    return { valid: true, data: undefined };
  }

  if (typeof rawPassword !== "string") {
    return { valid: false, error: "Senha inválida." };
  }

  if (rawPassword.trim() === "") {
    return { valid: false, error: "A senha não pode conter apenas espaços." };
  }

  return { valid: true, data: rawPassword };
}

export function validateOptionalAccessImage(
  rawImage: unknown
): ValidationResult<string | null | undefined> {
  if (rawImage === undefined) {
    return { valid: true, data: undefined };
  }

  if (rawImage === null || rawImage === "") {
    return { valid: true, data: null };
  }

  if (typeof rawImage !== "string") {
    return { valid: false, error: "URL da foto inválida." };
  }

  const trimmed = rawImage.trim();
  if (!trimmed) {
    return { valid: true, data: null };
  }

  if (trimmed.length > USER_IMAGE_MAX_LENGTH) {
    return {
      valid: false,
      error: `URL da foto deve ter no máximo ${USER_IMAGE_MAX_LENGTH} caracteres.`,
    };
  }

  const lower = trimmed.toLowerCase();
  if (lower.startsWith("javascript:") || lower.startsWith("data:")) {
    return { valid: false, error: "URL da foto inválida." };
  }

  return { valid: true, data: trimmed };
}

export function validateOptionalBirthDate(
  rawBirthDate: unknown
): ValidationResult<Date | null | undefined> {
  if (rawBirthDate === undefined) {
    return { valid: true, data: undefined };
  }

  if (rawBirthDate === null || rawBirthDate === "") {
    return { valid: true, data: null };
  }

  if (typeof rawBirthDate !== "string" && !(rawBirthDate instanceof Date)) {
    return { valid: false, error: "Data de nascimento inválida." };
  }

  const parsed = rawBirthDate instanceof Date ? rawBirthDate : new Date(rawBirthDate);
  if (Number.isNaN(parsed.getTime())) {
    return { valid: false, error: "Data de nascimento inválida." };
  }

  return { valid: true, data: parsed };
}

export function parseCreateUserAccessInput(
  rawBody: unknown
): ValidationResult<CreateUserAccessInput> {
  if (!isPlainObject(rawBody)) {
    return { valid: false, error: "Payload inválido." };
  }

  const disallowed = findDisallowedFields(rawBody, ALLOWED_CREATE_ACCESS_FIELDS);
  if (disallowed.length > 0) {
    return {
      valid: false,
      error: `Campos não permitidos no payload: ${disallowed.join(", ")}.`,
    };
  }

  const emailCheck = validateAccessEmail(rawBody.email);
  if (!emailCheck.valid) {
    return emailCheck;
  }

  const roleCheck = validateAccessRole(rawBody.role ?? "APOIO");
  if (!roleCheck.valid) {
    return roleCheck;
  }

  const result: CreateUserAccessInput = {
    email: emailCheck.data,
    role: roleCheck.data,
  };

  if ("name" in rawBody && rawBody.name !== undefined && rawBody.name !== null) {
    if (typeof rawBody.name !== "string") {
      return { valid: false, error: "Nome inválido." };
    }
    const trimmedName = rawBody.name.trim();
    if (trimmedName.length > USER_NAME_MAX_LENGTH) {
      return {
        valid: false,
        error: `Nome deve ter no máximo ${USER_NAME_MAX_LENGTH} caracteres.`,
      };
    }
    if (trimmedName.length > 0) {
      result.name = trimmedName;
    }
  }

  const passwordCheck = validateOptionalAccessPassword(rawBody.password);
  if (!passwordCheck.valid) {
    return passwordCheck;
  }
  if (passwordCheck.data !== undefined) {
    result.password = passwordCheck.data;
  }

  const imageCheck = validateOptionalAccessImage(rawBody.image);
  if (!imageCheck.valid) {
    return imageCheck;
  }
  if (imageCheck.data !== undefined) {
    result.image = imageCheck.data;
  }

  const birthDateCheck = validateOptionalBirthDate(rawBody.birthDate);
  if (!birthDateCheck.valid) {
    return birthDateCheck;
  }
  if (birthDateCheck.data !== undefined) {
    result.birthDate = birthDateCheck.data;
  }

  return { valid: true, data: result };
}

export function parseUpdateUserAccessInput(
  rawBody: unknown
): ValidationResult<UpdateUserAccessInput> {
  if (!isPlainObject(rawBody)) {
    return { valid: false, error: "Payload inválido." };
  }

  const disallowed = findDisallowedFields(rawBody, ALLOWED_UPDATE_ACCESS_FIELDS);
  if (disallowed.length > 0) {
    return {
      valid: false,
      error: `Campos não permitidos no payload: ${disallowed.join(", ")}.`,
    };
  }

  const hasAnyAllowedField = Object.keys(rawBody).some(
    (key) => rawBody[key] !== undefined
  );
  if (!hasAnyAllowedField) {
    return {
      valid: false,
      error: "Informe ao menos um campo para atualização.",
    };
  }

  const updateData: UpdateUserAccessInput = {};

  if ("role" in rawBody && rawBody.role !== undefined) {
    const roleCheck = validateAccessRole(rawBody.role);
    if (!roleCheck.valid) {
      return roleCheck;
    }
    updateData.role = roleCheck.data;
  }

  if ("name" in rawBody && rawBody.name !== undefined) {
    const nameCheck = validateAccessName(rawBody.name);
    if (!nameCheck.valid) {
      return nameCheck;
    }
    updateData.name = nameCheck.data;
  }

  if ("email" in rawBody && rawBody.email !== undefined) {
    const emailCheck = validateAccessEmail(rawBody.email);
    if (!emailCheck.valid) {
      return emailCheck;
    }
    updateData.email = emailCheck.data;
  }

  const passwordCheck = validateOptionalAccessPassword(rawBody.password);
  if (!passwordCheck.valid) {
    return passwordCheck;
  }
  if (passwordCheck.data !== undefined) {
    updateData.password = passwordCheck.data;
  }

  const imageCheck = validateOptionalAccessImage(rawBody.image);
  if (!imageCheck.valid) {
    return imageCheck;
  }
  if (imageCheck.data !== undefined) {
    updateData.image = imageCheck.data;
  }

  const birthDateCheck = validateOptionalBirthDate(rawBody.birthDate);
  if (!birthDateCheck.valid) {
    return birthDateCheck;
  }
  if (birthDateCheck.data !== undefined) {
    updateData.birthDate = birthDateCheck.data;
  }

  return { valid: true, data: updateData };
}

export function resolveSessionActiveRole(
  user?: SessionUserLike | null
): string {
  if (!user) return "APOIO";

  const activeOrgId = user.activeOrganizationId;
  if (user.isGlobalAdmin && user.globalAdminMode) {
    return "ADMIN";
  }

  if (activeOrgId && Array.isArray(user.memberships)) {
    const currentMembership = user.memberships.find(
      (membership) => membership.organizationId === activeOrgId
    );
    if (currentMembership?.role) {
      return currentMembership.role;
    }
  }

  if (!activeOrgId && user.isGlobalAdmin) {
    return "ADMIN";
  }

  return user.role || "APOIO";
}
