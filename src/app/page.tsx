"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowDownToLine, ArrowLeft, ArrowRight, BadgePlus, Check, ChevronDown, CircleAlert,
  FileSpreadsheet, Filter, LogOut, Menu, Plus, Printer, Search, ShieldCheck, UserRound, Users, X,
} from "lucide-react";
import { blankMember, type Member, type MemberInput, type UserRole } from "@/lib/types";

type SessionState = "loading" | "setup" | "login" | "ready";
type Dialog = "member" | "import" | null;
type SessionUser = { username: string; role: UserRole };

function roleLabel(role: UserRole) {
  if (role === "administrador") return "Administrador";
  if (role === "secretaria") return "Secretaría";
  return "Consulta";
}

function displayName(member: Member | MemberInput) {
  return [member.apellido, member.nombre].filter(Boolean).join(", ") || "Sin nombre cargado";
}

function dateOnlyValue(date: string | null) {
  const datePart = date?.trim().match(/^(\d{4}-\d{2}-\d{2})(?:$|T)/)?.[1];
  if (!datePart) return null;
  const parsedDate = new Date(`${datePart}T00:00:00Z`);
  if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== datePart) return null;
  return datePart;
}

function dateLabel(date: string | null) {
  if (!date) return "—";
  const datePart = dateOnlyValue(date);
  if (!datePart) return "Fecha inválida";
  const parsedDate = new Date(`${datePart}T00:00:00Z`);
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeZone: "UTC" }).format(parsedDate);
}

function dateInputValue(date: string | null) {
  return dateOnlyValue(date) ?? "";
}

function csvEscape(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function LoginScreen({ onLogin }: { onLogin: (user: SessionUser) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(result.error ?? "No se pudo iniciar sesión.");
      return;
    }
    onLogin(result.user);
  }

  return (
    <main className="gate-screen">
      <div className="gate-mark"><Users size={22} strokeWidth={1.8} /></div>
      <p className="eyebrow">CENTRO DE JUBILADOS</p>
      <h1>El padrón,<br />en orden.</h1>
      <p className="gate-copy">Administración de socios</p>
      <form className="login-form" onSubmit={submit}>
        <label htmlFor="login-username">Usuario</label>
        <input id="login-username" type="text" autoComplete="username" value={username}
          onChange={(event) => setUsername(event.target.value)} required autoFocus />
        <label htmlFor="admin-password">Contraseña</label>
        <input id="admin-password" type="password" autoComplete="current-password" value={password}
          onChange={(event) => setPassword(event.target.value)} required />
        {error && <p className="form-error">{error}</p>}
        <button className="button button-primary full-button" type="submit" disabled={busy}>
          {busy ? "Ingresando…" : "Ingresar"}<ArrowRight size={17} />
        </button>
      </form>
      <p className="gate-foot"><ShieldCheck size={14} /> Acceso privado para la comisión</p>
    </main>
  );
}

function SetupScreen() {
  return (
    <main className="setup-screen">
      <div className="gate-mark"><Users size={22} /></div>
      <p className="eyebrow">CENTRO DE JUBILADOS</p>
      <h1>Un último paso<br />antes de empezar.</h1>
      <p className="setup-copy">Configurá Neon y el acceso de administración para habilitar el padrón.</p>
      <div className="setup-list">
        <p><span>01</span> Copiá <code>.env.example</code> como <code>.env.local</code>.</p>
        <p><span>02</span> Completá la URL de Neon, la contraseña inicial de <code>admin</code> y el secreto de sesión.</p>
        <p><span>03</span> Ejecutá <code>db/schema.sql</code> en el SQL Editor de Neon.</p>
      </div>
      <p className="gate-foot"><ShieldCheck size={14} /> La URL de la base queda solo en el servidor</p>
    </main>
  );
}

function MemberDialog({ member, canEdit, onClose, onSaved }: {
  member: Member | null;
  canEdit: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<MemberInput>(() => member ? { ...member } : { ...blankMember });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function update(field: keyof MemberInput, value: string) {
    const nextValue = field === "numeroSocio" ? (value ? Number(value) : 0) : value || null;
    setForm((current) => ({ ...current, [field]: nextValue }) as MemberInput);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const changedFields: Partial<MemberInput> = {};
    if (member) {
      for (const field of Object.keys(form) as (keyof MemberInput)[]) {
        if (form[field] !== member[field]) Object.assign(changedFields, { [field]: form[field] });
      }
      if (!Object.keys(changedFields).length) {
        onSaved();
        return;
      }
    }
    setBusy(true);
    const response = await fetch(member ? `/api/members/${member.id}` : "/api/members", {
      method: member ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(member ? changedFields : { ...form, numeroSocio: Number(form.numeroSocio) }),
    });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(result.error ?? "No se pudo guardar el socio.");
      return;
    }
    onSaved();
  }

  const textField = (field: keyof MemberInput, label: string, required = false, type = "text") => (
    <label className="field" key={field}>
      <span>{label}{required && canEdit && <b> *</b>}</span>
      <input type={type} required={canEdit && required && (!member || form[field] !== member[field])} disabled={!canEdit}
        value={type === "date" ? dateInputValue(typeof form[field] === "string" ? form[field] : null) : String(form[field] ?? "")}
        onChange={(event) => update(field, event.target.value)} />
    </label>
  );

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal member-modal" role="dialog" aria-modal="true" aria-labelledby="member-title">
        <div className="modal-head">
        <div><p className="eyebrow">FICHA DE SOCIO</p><h2 id="member-title">{member ? (canEdit ? "Editar registro" : "Consultar ficha") : "Nuevo socio"}</h2></div>
          <button className="icon-button" onClick={onClose} aria-label="Cerrar"><X size={19} /></button>
        </div>
        <form onSubmit={canEdit ? submit : (event) => event.preventDefault()}>
          <div className="form-section-title">Identificación</div>
          <div className="form-grid">
            {textField("numeroSocio", "N.º de socio", true, "number")}
            {textField("dni", "DNI", true)}
            {textField("numeroLegajo", "N.º de legajo")}
            {textField("numeroActa", "N.º de acta")}
          </div>
          <div className="form-section-title">Datos personales</div>
          <div className="form-grid">
            {textField("apellido", "Apellido")}
            {textField("nombre", "Nombre")}
            {textField("sexo", "Sexo")}
            {textField("fechaNacimiento", "Fecha de nacimiento", false, "date")}
            {textField("tipoSocio", "Tipo de socio")}
            {textField("telefono", "Teléfono", false, "tel")}
            {textField("domicilio", "Domicilio")}
            {textField("localidad", "Localidad")}
          </div>
          <div className="form-section-title">Vigencia</div>
          <div className="form-grid">
            {textField("fechaAlta", "Fecha de alta", false, "date")}
            {textField("fechaBaja", "Fecha de baja", false, "date")}
            <div className="field field-wide">{textField("motivoBaja", "Motivo de baja")}</div>
          </div>
          {canEdit && <p className="required-note">* Datos obligatorios</p>}
          {error && <p className="form-error">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="button button-quiet" onClick={onClose}>{canEdit ? "Cancelar" : "Cerrar"}</button>
            {canEdit && <button type="submit" className="button button-primary" disabled={busy}>
              {busy ? "Guardando…" : <>{member ? "Guardar cambios" : "Crear socio"}<Check size={16} /></>}
            </button>}
          </div>
        </form>
      </section>
    </div>
  );
}

type ImportResult = {
  members: MemberInput[];
  valid: number;
  duplicates: number;
  rejected: number;
  errors: { rowNumber: number; message: string; fields: { column: string; value: string }[] }[];
};

function ImportDialog({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function chooseFile(file?: File) {
    if (!file) return;
    setBusy(true);
    setError("");
    setSuccess("");
    setPreview(null);
    const formData = new FormData();
    formData.set("file", file);
    const response = await fetch("/api/import", { method: "POST", body: formData });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(result.error ?? "No se pudo leer la planilla.");
      return;
    }
    setPreview(result);
  }

  async function confirmImport() {
    if (!preview) return;
    setBusy(true);
    setError("");
    const response = await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "confirm", members: preview.members }),
    });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(result.error ?? "No se pudo completar la importación.");
      return;
    }
    setSuccess(`Se importaron ${result.inserted} socios${result.duplicates ? `; ${result.duplicates} ya existían y se omitieron` : ""}.`);
    setPreview(null);
    onImported();
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal import-modal" role="dialog" aria-modal="true" aria-labelledby="import-title">
        <div className="modal-head">
          <div><p className="eyebrow">CARGA DE DATOS</p><h2 id="import-title">Importar planilla</h2></div>
          <button className="icon-button" onClick={onClose} aria-label="Cerrar"><X size={19} /></button>
        </div>
        <p className="modal-intro">Cargá un archivo XLSX o CSV separado por coma o punto y coma. La primera fila debe contener los encabezados.</p>
        <input ref={inputRef} className="visually-hidden" type="file" accept=".xlsx,.csv" onChange={(event) => chooseFile(event.target.files?.[0])} />
        <button className="drop-zone" onClick={() => inputRef.current?.click()} disabled={busy}>
          <FileSpreadsheet size={24} strokeWidth={1.5} />
          <strong>{busy ? "Procesando planilla…" : "Elegir archivo"}</strong>
          <span>Formato .xlsx o .csv · Hasta 5 MB</span>
        </button>
        <p className="import-columns">Columnas reconocidas: N.º Socio, N.º Legajo, N.º Acta, Apellido, Nombre, DNI, Sexo, Fecha Nacimiento, Tipo Socio, Domicilio, Localidad, Teléfono, Fecha Alta, Fecha Baja y Motivo Baja.</p>
        {preview && <div className="preview-summary">
          <div><Check size={16} /><strong>{preview.valid}</strong><span>listas para importar</span></div>
          <div><Filter size={16} /><strong>{preview.duplicates}</strong><span>duplicadas / existentes</span></div>
          <div><CircleAlert size={16} /><strong>{preview.rejected}</strong><span>filas con errores</span></div>
          {preview.members.length > 0 && <div className="preview-table-wrap">
            <p>Primeras filas incluidas</p>
            <table><thead><tr><th>N.º</th><th>APELLIDO Y NOMBRE</th><th>DNI</th><th>LOCALIDAD</th></tr></thead>
              <tbody>{preview.members.slice(0, 5).map((member) => <tr key={`${member.numeroSocio}-${member.dni}`}>
                <td>{member.numeroSocio}</td><td>{displayName(member)}</td><td>{member.dni}</td><td>{member.localidad || "—"}</td>
              </tr>)}</tbody>
            </table>
          </div>}
          {preview.errors.length > 0 && <div className="import-error-log">
            <strong>Detalle de filas con error</strong>
            <ul>{preview.errors.map((item) => <li key={item.rowNumber}>
              <b>Fila {item.rowNumber}:</b> {item.message}
              <p>{item.fields.map((field) => `${field.column}: ${field.value}`).join(" | ")}</p>
            </li>)}</ul>
            {preview.rejected > preview.errors.length && <span>Se muestran las primeras {preview.errors.length} de {preview.rejected} filas rechazadas.</span>}
          </div>}
        </div>}
        {error && <p className="form-error">{error}</p>}
        {success && <p className="success-message"><Check size={16} />{success}</p>}
        <div className="modal-actions">
          <button className="button button-quiet" onClick={onClose}>Cerrar</button>
          {preview && <button className="button button-primary" onClick={confirmImport} disabled={busy || preview.valid === 0}>
            Confirmar importación <ArrowRight size={16} />
          </button>}
        </div>
      </section>
    </div>
  );
}

export default function Home() {
  const [session, setSession] = useState<SessionState>("loading");
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [selected, setSelected] = useState<Member | null>(null);
  const [loadError, setLoadError] = useState("");
  const [mobileNav, setMobileNav] = useState(false);

  async function loadMembers() {
    setLoadError("");
    const response = await fetch("/api/members");
    if (response.status === 401) {
      setCurrentUser(null);
      setSession("login");
      return;
    }
    const result = await response.json();
    if (!response.ok) {
      setLoadError(result.error ?? "No se pudo cargar el padrón.");
      return;
    }
    setMembers(result);
  }

  useEffect(() => {
    let active = true;
    fetch("/api/auth/session").then((response) => response.json()).then(async (result) => {
      if (!active) return;
      if (!result.configured) {
        setSession("setup");
      } else if (result.authenticated && result.user) {
        setCurrentUser(result.user);
        setSession("ready");
        await loadMembers();
      } else {
        setCurrentUser(null);
        setSession("login");
      }
    }).catch(() => active && setSession("setup"));
    return () => { active = false; };
  }, []);

  const activeCount = members.filter((member) => !member.fechaBaja).length;
  const inactiveCount = members.length - activeCount;
  const canEditMembers = currentUser?.role === "administrador" || currentUser?.role === "secretaria";
  const canSeeReport = canEditMembers;
  const isAdministrator = currentUser?.role === "administrador";
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("es-AR");
    return members.filter((member) => {
      const matchesStatus = filter === "all" || (filter === "active" ? !member.fechaBaja : Boolean(member.fechaBaja));
      const haystack = [member.numeroSocio, member.dni, member.apellido, member.nombre, member.localidad]
        .join(" ").toLocaleLowerCase("es-AR");
      return matchesStatus && (!needle || haystack.includes(needle));
    });
  }, [members, query, filter]);

  function openNew() {
    setSelected(null);
    setDialog("member");
  }

  function openEdit(member: Member) {
    setSelected(member);
    setDialog("member");
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setCurrentUser(null);
    setSession("login");
    setMembers([]);
  }

  function exportMembers() {
    const headers = ["N° Socio", "N° Legajo", "N° Acta", "Apellido", "Nombre", "DNI", "Sexo", "Fecha Nacimiento", "Tipo Socio", "Domicilio", "Localidad", "Teléfono", "Fecha Alta", "Fecha Baja", "Motivo Baja"];
    const rows = filtered.map((member) => [member.numeroSocio, member.numeroLegajo, member.numeroActa,
      member.apellido, member.nombre, member.dni, member.sexo, member.fechaNacimiento, member.tipoSocio,
      member.domicilio, member.localidad, member.telefono, member.fechaAlta, member.fechaBaja, member.motivoBaja]);
    const content = [headers, ...rows].map((row) => row.map(csvEscape).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "padron-socios.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (session === "loading") return <main className="loading-screen"><span className="loading-dot" />Cargando padrón</main>;
  if (session === "setup") return <SetupScreen />;
  if (session === "login") return <LoginScreen onLogin={(user) => {
    setCurrentUser(user);
    setSession("ready");
    loadMembers();
  }} />;

  return (
    <main className="app-shell">
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <div className="brand-lockup"><div className="brand-icon"><Users size={20} /></div><div><strong>Centro de Jubilados</strong><span>Administración</span></div></div>
        <div className="side-label">GESTIÓN</div>
        <button className="nav-item nav-item-active" onClick={() => setMobileNav(false)}><Users size={17} />Padrón de socios<span className="nav-count">{members.length}</span></button>
        {canEditMembers && <button className="nav-item" onClick={() => { setDialog("import"); setMobileNav(false); }}><ArrowDownToLine size={17} />Importar planilla</button>}
        {canSeeReport && <Link className="nav-item" href="/reporte" onClick={() => setMobileNav(false)}><Printer size={17} />Listado de Socios Activos</Link>}
        {isAdministrator && <Link className="nav-item" href="/usuarios" onClick={() => setMobileNav(false)}><UserRound size={17} />Administrar usuarios</Link>}
        <div className="sidebar-bottom">
          <div className="privacy-note"><ShieldCheck size={17} /><span>Acceso privado<br />Datos protegidos</span></div>
          <button className="nav-item logout-item" onClick={logout}><LogOut size={17} />Cerrar sesión</button>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setMobileNav((value) => !value)} aria-label="Abrir menú"><Menu size={20} /></button>
          <div className="breadcrumb"><span>Gestión</span><span className="breadcrumb-separator">/</span><strong>Socios</strong></div>
          <div className="topbar-user"><span className="user-avatar"><UserRound size={16} /></span><span>{currentUser ? roleLabel(currentUser.role) : ""}</span><ChevronDown size={14} /></div>
        </header>

        <section className="content-area">
          <div className="page-heading">
            <div><p className="eyebrow">REGISTRO INSTITUCIONAL</p><h1>Padrón de socios</h1><p className="page-subtitle">{canEditMembers ? "Altas, datos y estado de membresía en un solo lugar." : "Consulta del padrón de socios en modo solo lectura."}</p></div>
            <div className="heading-actions">
              {canEditMembers && <button className="button button-outline" onClick={exportMembers} disabled={!filtered.length}><ArrowDownToLine size={16} />Exportar</button>}
              {canEditMembers && <button className="button button-primary" onClick={openNew}><Plus size={17} />Nuevo socio</button>}
            </div>
          </div>

          <div className="stats-row">
            <div className="stat-block"><span className="stat-label">TOTAL EN PADRÓN</span><div className="stat-value">{members.length}<span>registros</span></div></div>
            <div className="stat-block"><span className="stat-label">SOCIOS ACTIVOS</span><div className="stat-value">{activeCount}<span>sin fecha de baja</span></div></div>
            <div className="stat-block"><span className="stat-label">DADOS DE BAJA</span><div className="stat-value">{inactiveCount}<span>con historial</span></div></div>
            <div className="stat-aside"><BadgePlus size={19} /><span>El número de socio y el DNI son los únicos datos requeridos.</span></div>
          </div>

          <section className="directory-section">
            <div className="directory-heading"><div><h2>Directorio</h2><p>{filtered.length} {filtered.length === 1 ? "registro" : "registros"}{query ? " encontrados" : " en esta vista"}</p></div></div>
            <div className="table-toolbar">
              <label className="search-box"><Search size={17} /><input placeholder="Buscar por socio, DNI o nombre" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
              <div className="filter-tabs" role="group" aria-label="Filtrar socios">
                <button className={filter === "all" ? "filter-active" : ""} onClick={() => setFilter("all")}>Todos <span>{members.length}</span></button>
                <button className={filter === "active" ? "filter-active" : ""} onClick={() => setFilter("active")}>Activos</button>
                <button className={filter === "inactive" ? "filter-active" : ""} onClick={() => setFilter("inactive")}>Bajas</button>
              </div>
            </div>
            {loadError && <div className="error-banner"><CircleAlert size={17} />{loadError}<button onClick={loadMembers}>Reintentar</button></div>}
            <div className="table-wrap">
              <table className="member-table">
                <thead><tr><th>N.º</th><th>APELLIDO Y NOMBRE</th><th>DNI</th><th>LOCALIDAD</th><th>TELÉFONO / DIRECCIÓN</th><th>FECHA DE ALTA</th><th>ESTADO</th><th><span className="visually-hidden">Acción</span></th></tr></thead>
                <tbody>
                  {filtered.map((member) => <tr key={member.id} onClick={() => openEdit(member)} tabIndex={0} onKeyDown={(event) => event.key === "Enter" && openEdit(member)}>
                    <td className="member-number" data-label="N.º">{String(member.numeroSocio).padStart(3, "0")}</td>
                    <td data-label="Apellido y nombre"><div className="member-name">{displayName(member)}</div><div className="member-sub">{member.tipoSocio || "Tipo sin informar"}</div></td>
                    <td className="member-dni" data-label="DNI">{member.dni}</td>
                    <td data-label="Localidad">{member.localidad || <span className="muted-value">Sin informar</span>}</td>
                    <td className="member-contact-cell" data-label="Teléfono / dirección">
                      <div>{member.telefono || <span className="muted-value">Sin teléfono</span>}</div>
                      <div className="member-contact-address">{member.domicilio || <span className="muted-value">Sin dirección</span>}</div>
                    </td>
                    <td data-label="Fecha de alta">{dateLabel(member.fechaAlta)}</td>
                    <td data-label="Estado"><span className={`status-pill ${member.fechaBaja ? "status-inactive" : "status-active"}`}><i />{member.fechaBaja ? "Baja" : "Activo"}</span></td>
                    <td data-label="Acción"><button className="row-action" aria-label={`${canEditMembers ? "Editar" : "Consultar"} ${displayName(member)}`} onClick={(event) => { event.stopPropagation(); openEdit(member); }}><ArrowRight size={16} /></button></td>
                  </tr>)}
                </tbody>
              </table>
              {!filtered.length && <div className="empty-state"><div className="empty-icon"><Users size={21} /></div><h3>{query || filter !== "all" ? "No hay resultados" : "El padrón empieza acá"}</h3><p>{query || filter !== "all" ? "Probá con otro término o cambiá el filtro." : canEditMembers ? "Agregá un socio o importá los datos de tu planilla." : "No hay socios para mostrar."}</p>{canEditMembers && !query && filter === "all" && <button className="button button-primary" onClick={openNew}><Plus size={16} />Nuevo socio</button>}</div>}
            </div>
            <div className="table-footer"><span>Mostrando {filtered.length} de {members.length} socios</span><div className="pagination"><button disabled aria-label="Página anterior"><ArrowLeft size={15} /></button><span>1</span><button disabled aria-label="Página siguiente"><ArrowRight size={15} /></button></div></div>
          </section>
          <footer className="page-footer"><span>Centro de Jubilados</span><span>PADRÓN DIGITAL · {new Date().getFullYear()}</span></footer>
        </section>
      </div>
      {dialog === "member" && <MemberDialog member={selected} canEdit={canEditMembers} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); loadMembers(); }} />}
      {dialog === "import" && canEditMembers && <ImportDialog onClose={() => setDialog(null)} onImported={loadMembers} />}
    </main>
  );
}