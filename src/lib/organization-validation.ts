export const ORG_NAME_MIN_LENGTH = 2;
export const ORG_NAME_MAX_LENGTH = 191;
export const ORG_SLUG_MIN_LENGTH = 2;
export const ORG_SLUG_MAX_LENGTH = 191;
export const ORG_SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const ALLOWED_ORGANIZATION_FIELDS = new Set(["name", "slug", "active"]);

export type ValidationSuccess<T> = {
  valid: true;
  data: T;
};

export type ValidationFailure = {
  valid: false;
  error: string;
};

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

export interface CreateOrganizationInput {
  name: string;
  slug: string;
  active: boolean;
}

export interface UpdateOrganizationInput {
  name?: string;
  slug?: string;
  active?: boolean;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function findDisallowedFields(body: Record<string, unknown>): string[] {
  return Object.keys(body).filter((key) => !ALLOWED_ORGANIZATION_FIELDS.has(key));
}

export function suggestOrganizationSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, ORG_SLUG_MAX_LENGTH);
}

export function validateOrganizationName(
  rawName: unknown
): ValidationResult<string> {
  if (typeof rawName !== "string") {
    return { valid: false, error: "Nome da congregação é obrigatório." };
  }

  const trimmed = rawName.trim();
  if (!trimmed) {
    return { valid: false, error: "Nome da congregação é obrigatório." };
  }

  if (trimmed.length < ORG_NAME_MIN_LENGTH) {
    return {
      valid: false,
      error: `Nome da congregação deve ter pelo menos ${ORG_NAME_MIN_LENGTH} caracteres.`,
    };
  }

  if (trimmed.length > ORG_NAME_MAX_LENGTH) {
    return {
      valid: false,
      error: `Nome da congregação deve ter no máximo ${ORG_NAME_MAX_LENGTH} caracteres.`,
    };
  }

  return { valid: true, data: trimmed };
}

export function validateOrganizationSlug(
  rawSlug: unknown
): ValidationResult<string> {
  if (typeof rawSlug !== "string") {
    return { valid: false, error: "Slug da congregação é obrigatório." };
  }

  const trimmed = rawSlug.trim();
  if (!trimmed) {
    return { valid: false, error: "Slug da congregação é obrigatório." };
  }

  if (trimmed.length < ORG_SLUG_MIN_LENGTH) {
    return {
      valid: false,
      error: `Slug deve ter pelo menos ${ORG_SLUG_MIN_LENGTH} caracteres.`,
    };
  }

  if (trimmed.length > ORG_SLUG_MAX_LENGTH) {
    return {
      valid: false,
      error: `Slug deve ter no máximo ${ORG_SLUG_MAX_LENGTH} caracteres.`,
    };
  }

  if (!ORG_SLUG_REGEX.test(trimmed)) {
    return {
      valid: false,
      error:
        "Slug deve conter apenas letras minúsculas sem acentos, números e hífens (sem espaços ou caracteres especiais).",
    };
  }

  return { valid: true, data: trimmed };
}

export function parseCreateOrganizationInput(
  rawBody: unknown
): ValidationResult<CreateOrganizationInput> {
  if (!isPlainObject(rawBody)) {
    return { valid: false, error: "Payload inválido." };
  }

  const disallowed = findDisallowedFields(rawBody);
  if (disallowed.length > 0) {
    return {
      valid: false,
      error: `Campos não permitidos na requisição: ${disallowed.join(", ")}.`,
    };
  }

  const nameCheck = validateOrganizationName(rawBody.name);
  if (!nameCheck.valid) {
    return nameCheck;
  }

  const slugCheck = validateOrganizationSlug(rawBody.slug);
  if (!slugCheck.valid) {
    return slugCheck;
  }

  let active = true;
  if ("active" in rawBody && rawBody.active !== undefined) {
    if (typeof rawBody.active !== "boolean") {
      return { valid: false, error: "O campo 'active' deve ser booleano." };
    }
    active = rawBody.active;
  }

  return {
    valid: true,
    data: {
      name: nameCheck.data,
      slug: slugCheck.data,
      active,
    },
  };
}

export function parseUpdateOrganizationInput(
  rawBody: unknown
): ValidationResult<UpdateOrganizationInput> {
  if (!isPlainObject(rawBody)) {
    return { valid: false, error: "Payload inválido." };
  }

  const disallowed = findDisallowedFields(rawBody);
  if (disallowed.length > 0) {
    return {
      valid: false,
      error: `Campos não permitidos na requisição: ${disallowed.join(", ")}.`,
    };
  }

  const providedKeys = Object.keys(rawBody).filter(
    (key) => rawBody[key] !== undefined
  );
  if (providedKeys.length === 0) {
    return {
      valid: false,
      error: "Informe ao menos um campo válido para atualização.",
    };
  }

  const updateData: UpdateOrganizationInput = {};

  if ("name" in rawBody && rawBody.name !== undefined) {
    const nameCheck = validateOrganizationName(rawBody.name);
    if (!nameCheck.valid) {
      return nameCheck;
    }
    updateData.name = nameCheck.data;
  }

  if ("slug" in rawBody && rawBody.slug !== undefined) {
    const slugCheck = validateOrganizationSlug(rawBody.slug);
    if (!slugCheck.valid) {
      return slugCheck;
    }
    updateData.slug = slugCheck.data;
  }

  if ("active" in rawBody && rawBody.active !== undefined) {
    if (typeof rawBody.active !== "boolean") {
      return { valid: false, error: "O campo 'active' deve ser booleano." };
    }
    updateData.active = rawBody.active;
  }

  return { valid: true, data: updateData };
}

export const ORGANIZATION_ADMIN_SELECT = {
  id: true,
  name: true,
  slug: true,
  active: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      memberships: true,
      classes: true,
      students: true,
    },
  },
} as const;

export function hasPrismaErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === code
  );
}

