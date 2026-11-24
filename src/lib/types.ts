export type Member = {
  id: string;
  numeroSocio: number;
  numeroLegajo: string | null;
  numeroActa: string | null;
  apellido: string | null;
  nombre: string | null;
  dni: string;
  sexo: string | null;
  fechaNacimiento: string | null;
  tipoSocio: string | null;
  domicilio: string | null;
  localidad: string | null;
  telefono: string | null;
  fechaAlta: string | null;
  fechaBaja: string | null;
  motivoBaja: string | null;
};

export type MemberInput = Omit<Member, "id">;

export const blankMember: MemberInput = {
  numeroSocio: 0,
  numeroLegajo: null,
  numeroActa: null,
  apellido: null,
  nombre: null,
  dni: "",
  sexo: null,
  fechaNacimiento: null,
  tipoSocio: null,
  domicilio: null,
  localidad: null,
  telefono: null,
  fechaAlta: null,
  fechaBaja: null,
  motivoBaja: null,
};

const optionalTextFields = [
  "numeroLegajo", "numeroActa", "apellido", "nombre", "sexo", "tipoSocio",
  "domicilio", "localidad", "telefono", "motivoBaja",
] as const;

const dateFields = ["fechaNacimiento", "fechaAlta", "fechaBaja"] as const;
const editableFields = new Set<string>(["numeroSocio", "dni", ...optionalTextFields, ...dateFields]);

function parseDateField(raw: unknown): string | null | undefined {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return undefined;
  const date = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw) return undefined;
  return raw;
}

export function parseMember(value: unknown): MemberInput | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  const numeroSocio = Number(data.numeroSocio);
  const dni = typeof data.dni === "string" ? data.dni.trim() : "";
  if (!Number.isInteger(numeroSocio) || numeroSocio < 1 || !dni) return null;

  const member: MemberInput = { ...blankMember, numeroSocio, dni };
  for (const field of optionalTextFields) {
    const raw = data[field];
    member[field] = typeof raw === "string" && raw.trim() ? raw.trim() : null;
  }
  for (const field of dateFields) {
    const date = parseDateField(data[field]);
    if (date === undefined) return null;
    member[field] = date;
  }
  if (member.fechaAlta && member.fechaBaja && member.fechaBaja < member.fechaAlta) return null;
  return member;
}

export function parseMemberPatch(value: unknown): Partial<MemberInput> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  const keys = Object.keys(data);
  if (!keys.length || keys.some((field) => !editableFields.has(field))) return null;

  const hasField = (field: string) => Object.prototype.hasOwnProperty.call(data, field);
  const patch: Partial<MemberInput> = {};
  if (hasField("numeroSocio")) {
    const numeroSocio = Number(data.numeroSocio);
    if (!Number.isInteger(numeroSocio) || numeroSocio < 1) return null;
    patch.numeroSocio = numeroSocio;
  }
  if (hasField("dni")) {
    if (typeof data.dni !== "string" || !data.dni.trim()) return null;
    patch.dni = data.dni.trim();
  }
  for (const field of optionalTextFields) {
    if (!hasField(field)) continue;
    const raw = data[field];
    if (raw !== null && typeof raw !== "string") return null;
    patch[field] = typeof raw === "string" && raw.trim() ? raw.trim() : null;
  }
  for (const field of dateFields) {
    if (!hasField(field)) continue;
    const date = parseDateField(data[field]);
    if (date === undefined) return null;
    patch[field] = date;
  }
  if (patch.fechaAlta && patch.fechaBaja && patch.fechaBaja < patch.fechaAlta) return null;
  return patch;
}