"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CircleAlert, ShieldCheck, UserRound, Users } from "lucide-react";
import { userRoles, type AppUser, type UserRole } from "@/lib/types";

function roleLabel(role: UserRole) {
  if (role === "administrador") return "Administrador";
  if (role === "secretaria") return "Secretaría";
  return "Consulta";
}

export default function UsersPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("consulta");
  const [creating, setCreating] = useState(false);
  const [resettingUser, setResettingUser] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");

  async function loadUsers() {
    setError("");
    try {
      const sessionResponse = await fetch("/api/auth/session");
      const session = await sessionResponse.json();
      if (!sessionResponse.ok || !session.authenticated || session.user?.role !== "administrador") {
        setError("Esta pantalla es exclusiva para administradores.");
        return;
      }
      setAuthorized(true);
      const response = await fetch("/api/users");
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "No se pudieron cargar los usuarios.");
      setUsers(result);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los usuarios.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadUsers(); }, []);

  async function createUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setCreating(true);
    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, role }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "No se pudo crear el usuario.");
      setUsers((current) => [...current, result].sort((a, b) => a.username.localeCompare(b.username)));
      setUsername("");
      setPassword("");
      setRole("consulta");
      setNotice("Usuario creado.");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "No se pudo crear el usuario.");
    } finally {
      setCreating(false);
    }
  }

  async function updateUser(id: string, changes: { role?: UserRole; active?: boolean; password?: string }) {
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "No se pudo actualizar el usuario.");
      setUsers((current) => current.map((user) => user.id === id ? result : user));
      setNotice("Cambios guardados.");
      return true;
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "No se pudo actualizar el usuario.");
      return false;
    }
  }

  async function resetPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!resettingUser) return;
    const saved = await updateUser(resettingUser, { password: newPassword });
    if (saved) {
      setResettingUser(null);
      setNewPassword("");
    }
  }

  return (
    <main className="users-page">
      <header className="users-toolbar">
        <Link href="/" className="report-back"><ArrowLeft size={16} />Volver al padrón</Link>
        <span><ShieldCheck size={16} /> Solo administradores</span>
      </header>
      <section className="users-content">
        <div className="users-heading">
          <div className="users-mark"><Users size={20} /></div>
          <p className="eyebrow">ACCESO AL PADRÓN</p>
          <h1>Administrar usuarios</h1>
          <p>Creá cuentas, asigná permisos y desactivá accesos cuando ya no sean necesarios.</p>
        </div>

        {!authorized && !loading && error && <p className="users-message users-error" role="alert"><CircleAlert size={17} />{error}</p>}

        {authorized && <form className="user-create-form" onSubmit={createUser}>
          <h2>Crear usuario</h2>
          <div className="user-create-fields">
            <label className="field">
              <span>Nombre de usuario</span>
              <input value={username} onChange={(event) => setUsername(event.target.value)} minLength={3}
                maxLength={50} pattern="[a-zA-Z0-9._-]+" autoComplete="off" required />
            </label>
            <label className="field">
              <span>Contraseña (mínimo 12 caracteres)</span>
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)}
                minLength={12} maxLength={256} autoComplete="new-password" required />
            </label>
            <label className="field">
              <span>Rol</span>
              <select value={role} onChange={(event) => setRole(event.target.value as UserRole)}>
                {userRoles.map((option) => <option value={option} key={option}>{roleLabel(option)}</option>)}
              </select>
            </label>
            <button type="submit" className="button button-primary" disabled={creating}>
              {creating ? "Creando…" : <><UserRound size={16} />Crear cuenta</>}
            </button>
          </div>
          <p className="users-hint">El primer acceso crea el usuario <strong>admin</strong> con la contraseña configurada en <code>ADMIN_PASSWORD</code>.</p>
        </form>}

        {authorized && <section className="users-list-section">
          <div className="users-list-heading"><div><h2>Cuentas existentes</h2><p>{users.length} {users.length === 1 ? "usuario" : "usuarios"}</p></div></div>
          {error && <p className="users-message users-error" role="alert"><CircleAlert size={17} />{error}</p>}
          {notice && !error && <p className="users-message users-notice">{notice}</p>}
          {loading && <p className="users-empty">Cargando usuarios…</p>}
          {!loading && !error && !users.length && <p className="users-empty">No hay usuarios registrados.</p>}
          {!loading && users.length > 0 && <div className="users-list">
            {users.map((user) => <article className="user-card" key={user.id}>
              <div className="user-card-heading">
                <div><strong>{user.username}</strong><span className={user.active ? "user-active" : "user-inactive"}>{user.active ? "Activo" : "Desactivado"}</span></div>
                <button className="button button-quiet" onClick={() => void updateUser(user.id, { active: !user.active })}>
                  {user.active ? "Desactivar" : "Activar"}
                </button>
              </div>
              <div className="user-card-controls">
                <label className="field">
                  <span>Rol</span>
                  <select value={user.role} onChange={(event) => void updateUser(user.id, { role: event.target.value as UserRole })}>
                    {userRoles.map((option) => <option value={option} key={option}>{roleLabel(option)}</option>)}
                  </select>
                </label>
                <button type="button" className="button button-outline"
                  onClick={() => {
                    setError("");
                    setNotice("");
                    setNewPassword("");
                    setResettingUser(resettingUser === user.id ? null : user.id);
                  }}>
                  Restablecer contraseña
                </button>
              </div>
              {resettingUser === user.id && <form className="user-reset-form" onSubmit={resetPassword}>
                <label className="field">
                  <span>Nueva contraseña (mínimo 12 caracteres)</span>
                  <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)}
                    minLength={12} maxLength={256} autoComplete="new-password" required />
                </label>
                <button type="submit" className="button button-primary">Guardar contraseña</button>
              </form>}
            </article>)}
          </div>}
        </section>}
      </section>
    </main>
  );
}
