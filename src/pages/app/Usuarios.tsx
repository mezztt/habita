import { useCallback, useEffect, useState } from "react";
import { appApi, getSessionUser, ROLES, ROLE_HINTS, ROLE_LABELS } from "../../config";
import { Empty, Field, Loading, Modal, PageHeader, Pill, useFlash } from "../../components/ui";

interface UserItem { id: number; name: string; email: string; role: string; active: boolean }

const ROLE_TONE: Record<string, string> = { ADMINISTRADOR: "violet", ENCARGADO: "brand", COBRANZAS: "green", AGENTE: "blue", CONTADOR: "gray" };

function Usuarios() {
  const me = getSessionUser();
  const { show, fail, node: flash } = useFlash();
  const [users, setUsers] = useState<UserItem[] | null>(null);
  const [editing, setEditing] = useState<UserItem | "new" | null>(null);

  const load = useCallback(() => { appApi<UserItem[]>("/users").then(setUsers).catch(fail); }, [fail]);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="products-page">
      <PageHeader eyebrow="USUARIOS" title="Usuarios" subtitle="Quién entra al sistema y qué puede hacer cada uno.">
        <button className="primary-button" onClick={() => setEditing("new")}>+ Nuevo usuario</button>
      </PageHeader>
      <div className="hb-grid-3" style={{ marginBottom: 16 }}>
        {ROLES.map((r) => (
          <div key={r} className="hb-card" style={{ padding: 14 }}><strong>{ROLE_LABELS[r]}</strong><p className="hb-muted" style={{ margin: "4px 0 0" }}>{ROLE_HINTS[r]}</p></div>
        ))}
      </div>
      {!users ? <Loading /> : users.length === 0 ? <Empty title="Sin usuarios">Creá el primero con «Nuevo usuario».</Empty> : (
        <div className="hb-table-wrap">
          <table className="hb-table">
            <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Estado</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="is-click" onClick={() => setEditing(u)}>
                  <td><strong>{u.name}</strong>{u.id === me?.id && <small>Vos</small>}</td>
                  <td>{u.email}</td>
                  <td><Pill tone={ROLE_TONE[u.role] || "gray"}>{ROLE_LABELS[u.role] || u.role}</Pill></td>
                  <td>{u.active ? <Pill tone="green">Activo</Pill> : <Pill tone="gray">Inactivo</Pill>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && <UserForm user={editing === "new" ? null : editing} isMe={editing !== "new" && editing.id === me?.id}
        onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); show("Usuario guardado"); }} />}
      {flash}
    </section>
  );
}

function UserForm({ user, isMe, onClose, onSaved }: {
  user: UserItem | null; isMe: boolean; onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(user?.role || "AGENTE");
  const [active, setActive] = useState(user?.active ?? true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setError("");
    setSaving(true);
    try {
      if (user) await appApi(`/users/${user.id}`, { method: "PUT", body: { name, role, active, password: password || null } });
      else await appApi("/users", { method: "POST", body: { name, email, password, role } });
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar"); } finally { setSaving(false); }
  }

  return (
    <Modal eyebrow={user ? "EDITAR USUARIO" : "NUEVO USUARIO"} title={user ? user.name : "Nuevo usuario"} onClose={onClose}
      footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" onClick={save} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</button></>}>
      <div className="product-form">
        <Field label="Nombre"><input value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
        <Field label="Email (para entrar)"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!!user} /></Field>
        <Field label={user ? "Contraseña nueva (opcional)" : "Contraseña"} hint="Mínimo 6 caracteres"><input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <Field label="Rol">
          <select value={role} onChange={(e) => setRole(e.target.value)} disabled={isMe}>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]} — {ROLE_HINTS[r]}</option>)}
          </select>
        </Field>
        {user && !isMe && (
          <div className="hb-inline-checks"><label><input type="checkbox" checked={!active} onChange={(e) => setActive(!e.target.checked)} /> Desactivar (no puede entrar)</label></div>
        )}
        {error && <div className="hb-note hb-note-error">{error}</div>}
      </div>
    </Modal>
  );
}

export default Usuarios;
