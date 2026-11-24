"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CircleAlert, Printer } from "lucide-react";
import type { Member } from "@/lib/types";

export default function ReportPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const previousTitle = document.title;
    document.title = "Socios activos | Centro de Jubilados";

    async function loadMembers() {
      try {
        const sessionResponse = await fetch("/api/auth/session");
        const session = await sessionResponse.json();
        if (!sessionResponse.ok || !session.authenticated) throw new Error("Iniciá sesión para continuar.");
        if (session.user?.role === "consulta") throw new Error("No tenés permiso para consultar este listado.");
        const response = await fetch("/api/members");
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "No se pudo cargar el padrón.");
        if (active) {
          const activeMembers = (result as Member[]).filter((member) => !member.fechaBaja);
          activeMembers.sort((a, b) => {
            const byLastName = (a.apellido ?? "").localeCompare(b.apellido ?? "", "es-AR", { sensitivity: "base" });
            return byLastName || (a.nombre ?? "").localeCompare(b.nombre ?? "", "es-AR", { sensitivity: "base" });
          });
          setMembers(activeMembers);
        }
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el padrón.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadMembers();
    return () => {
      active = false;
      document.title = previousTitle;
    };
  }, []);

  return (
    <main className="report-page">
      <div className="report-toolbar">
        <Link href="/" className="report-back"><ArrowLeft size={16} />Volver al padrón</Link>
        <button className="report-print-button" onClick={() => window.print()} disabled={loading || Boolean(error)}>
          <Printer size={16} />Imprimir / Guardar PDF
        </button>
      </div>
      <section className="report-content">
        <header className="report-heading">
          <p className="eyebrow">PADRÓN DIGITAL</p>
          <h1>Listado de socios activos</h1>
          {!loading && !error && <p>{members.length} {members.length === 1 ? "socio activo" : "socios activos"}</p>}
        </header>
        {loading && <p className="report-message">Cargando socios…</p>}
        {error && <p className="report-error" role="alert"><CircleAlert size={17} />{error}</p>}
        {!loading && !error && !members.length && <p className="report-message">No hay socios activos para mostrar.</p>}
        {!loading && !error && members.length > 0 && <div className="report-table-wrap">
          <table className="report-table">
            <thead>
              <tr>
                <th>N.º de socio</th>
                <th>N.º de legajo</th>
                <th>Apellido</th>
                <th>Nombre</th>
                <th>DNI</th>
                <th>Teléfono</th>
                <th>Dirección</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => <tr key={member.id}>
                <td data-label="N.º de socio">{String(member.numeroSocio).padStart(3, "0")}</td>
                <td data-label="N.º de legajo">{member.numeroLegajo || "—"}</td>
                <td data-label="Apellido">{member.apellido || "—"}</td>
                <td data-label="Nombre">{member.nombre || "—"}</td>
                <td data-label="DNI">{member.dni}</td>
                <td data-label="Teléfono">{member.telefono || "—"}</td>
                <td data-label="Dirección">{member.domicilio || "—"}</td>
              </tr>)}
            </tbody>
          </table>
        </div>}
      </section>
    </main>
  );
}
