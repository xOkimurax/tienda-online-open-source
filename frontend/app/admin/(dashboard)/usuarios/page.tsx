'use client';

import { useEffect, useMemo, useState } from 'react';
import { adminJson, ApiError } from '@/lib/adminApi';
import { useToast } from '@/lib/ToastContext';
import { useAdminAuth } from '@/lib/AdminAuthContext';
import { Dialog } from '@/components/Dialog';
import { Icon } from '@/components/Icon';
import { useConfirm } from '@/components/useConfirm';
import { EDIT_ICON, DELETE_ICON } from '@/lib/icons';
import { ADMIN_ROLES, ADMIN_ROLE_LABEL, AdminRole, AdminUserRow, canManageAdminRole } from '@/lib/types';

type InviteDraft = { nombre: string; email: string; rol: AdminRole };
type EditDraft = { id: string; nombre: string; email: string; isSelf: boolean };
const ESTADO_FILTERS = [
  { value: '', label: 'Todos' },
  { value: 'activo', label: 'Activos' },
  { value: 'suspendido', label: 'Suspendidos' },
] as const;

export default function UsuariosPage() {
  const flash = useToast();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const { user } = useAdminAuth();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [invite, setInvite] = useState<InviteDraft | null>(null);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [rolFilter, setRolFilter] = useState<'' | AdminRole>('');
  const [estadoFilter, setEstadoFilter] = useState<(typeof ESTADO_FILTERS)[number]['value']>('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);

  function reload() {
    adminJson<AdminUserRow[]>('/api/admin/users', 'GET').then(setUsers);
  }
  useEffect(reload, []);

  const myRole = user!.rol;
  const isManager = myRole === 'SUPER_ADMIN' || myRole === 'ADMIN';
  const assignableRoles = useMemo(() => ADMIN_ROLES.filter((r) => canManageAdminRole(myRole, r)), [myRole]);

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase();
    const matchesSearch = !q || u.nombre.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    const matchesRol = !rolFilter || u.rol === rolFilter;
    const matchesEstado = !estadoFilter || (estadoFilter === 'activo' ? u.activo : !u.activo);
    return matchesSearch && matchesRol && matchesEstado;
  });

  async function changeRole(u: AdminUserRow, rol: AdminRole) {
    try {
      await adminJson(`/api/admin/users/${u.id}/rol`, 'PATCH', { rol });
      flash(`Rol de ${u.nombre} actualizado a ${ADMIN_ROLE_LABEL[rol]}`);
      reload();
    } catch (err) {
      flash(err instanceof ApiError ? err.message : 'No se pudo cambiar el rol', 'error');
    }
  }

  async function toggleActive(u: AdminUserRow) {
    try {
      await adminJson(`/api/admin/users/${u.id}/toggle-activo`, 'PATCH');
      reload();
    } catch (err) {
      flash(err instanceof ApiError ? err.message : 'No se pudo cambiar el estado', 'error');
    }
  }

  async function removeUser(u: AdminUserRow) {
    if (!(await confirm(`¿Eliminar a "${u.nombre}" del panel? Esta acción no se puede deshacer.`))) return;
    try {
      await adminJson(`/api/admin/users/${u.id}`, 'DELETE');
      flash('Usuario eliminado');
      reload();
    } catch (err) {
      flash(err instanceof ApiError ? err.message : 'No se pudo eliminar el usuario', 'error');
    }
  }

  async function sendInvite() {
    if (!invite?.email || sendingInvite) {
      if (!invite?.email) flash('Ingresá un email', 'error');
      return;
    }
    setSendingInvite(true);
    try {
      await adminJson('/api/admin/users/invite', 'POST', invite);
      flash('Invitación enviada a ' + invite.email);
      setInvite(null);
      reload();
    } catch (err) {
      flash(err instanceof ApiError ? err.message : 'No se pudo enviar la invitación', 'error');
    } finally {
      setSendingInvite(false);
    }
  }

  function openEditDialog(u: AdminUserRow, isSelf: boolean) {
    setEditError(null);
    setEditDraft({ id: u.id, nombre: u.nombre, email: u.email, isSelf });
  }

  async function saveEdit() {
    if (!editDraft || savingEdit) return;
    if (!editDraft.nombre.trim() || !editDraft.email.trim()) {
      setEditError('Nombre y email son obligatorios');
      return;
    }
    setSavingEdit(true);
    setEditError(null);
    try {
      await adminJson(`/api/admin/users/${editDraft.id}`, 'PATCH', { nombre: editDraft.nombre.trim(), email: editDraft.email.trim() });
      flash('Usuario actualizado');
      setEditDraft(null);
      reload();
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : 'No se pudo actualizar el usuario');
    } finally {
      setSavingEdit(false);
    }
  }

  function openPasswordDialog() {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError(null);
    setShowPasswordDialog(true);
  }

  async function changePassword() {
    if (changingPassword) return;
    setPasswordError(null);
    if (newPassword !== confirmPassword) {
      setPasswordError('Las contraseñas nuevas no coinciden');
      return;
    }
    setChangingPassword(true);
    try {
      await adminJson('/api/admin/auth/change-password', 'POST', { currentPassword, newPassword });
      setShowPasswordDialog(false);
      flash('Contraseña actualizada');
    } catch (err) {
      setPasswordError(err instanceof ApiError ? err.message : 'No se pudo cambiar la contraseña');
    } finally {
      setChangingPassword(false);
    }
  }

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 'var(--space-4)' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 30, margin: '0 0 4px' }}>Usuarios y roles</h1>
          <p style={{ margin: 0, opacity: 0.6, fontSize: 14 }}>
            Acceso al panel controlado por rol asignado — cada rol solo puede gestionar a quienes tengan un rol inferior al suyo
          </p>
        </div>
        {isManager && (
          <div className="page-header-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setInvite({ nombre: '', email: '', rol: assignableRoles[assignableRoles.length - 1] })}
            >
              + Invitar usuario
            </button>
          </div>
        )}
      </div>

      <div className="card elev-sm" style={{ marginBottom: 'var(--space-4)' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, opacity: 0.6, flex: '1 1 200px' }}>
            Buscar
            <input className="input" placeholder="Nombre o email…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, opacity: 0.6 }}>
            Rol
            <select className="input" value={rolFilter} onChange={(e) => setRolFilter(e.target.value as typeof rolFilter)} style={{ width: 'auto', padding: '8px 12px', fontSize: 12.5 }}>
              <option value="">Todos</option>
              {ADMIN_ROLES.map((r) => <option key={r} value={r}>{ADMIN_ROLE_LABEL[r]}</option>)}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, opacity: 0.6 }}>
            Estado
            <select className="input" value={estadoFilter} onChange={(e) => setEstadoFilter(e.target.value as typeof estadoFilter)} style={{ width: 'auto', padding: '8px 12px', fontSize: 12.5 }}>
              {ESTADO_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="card elev-sm" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="table table-responsive">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', opacity: 0.6, padding: 'var(--space-4)' }}>
                  Ningún usuario coincide con estos filtros.
                </td>
              </tr>
            )}
            {filteredUsers.map((u) => {
              const isSelf = u.id === user!.id;
              const canEditThis = isManager && !isSelf && canManageAdminRole(myRole, u.rol);
              return (
                <tr key={u.id}>
                  <td data-label="Usuario">{u.nombre}{isSelf && <span className="text-muted"> (vos)</span>}</td>
                  <td className="text-muted" data-label="Email">{u.email}</td>
                  <td data-label="Rol">
                    {canEditThis ? (
                      <select
                        className="input"
                        value={u.rol}
                        onChange={(e) => changeRole(u, e.target.value as AdminRole)}
                        style={{ padding: '6px 10px', fontSize: 12.5, width: 'auto' }}
                      >
                        {ADMIN_ROLES.filter((r) => canManageAdminRole(myRole, r) || r === u.rol).map((r) => (
                          <option key={r} value={r}>{ADMIN_ROLE_LABEL[r]}</option>
                        ))}
                      </select>
                    ) : (
                      ADMIN_ROLE_LABEL[u.rol]
                    )}
                  </td>
                  <td data-label="Estado">
                    <span className={`tag ${u.activo ? 'tag-accent' : 'tag-neutral'}`}>{u.activo ? 'Activo' : 'Suspendido'}</span>
                  </td>
                  <td className="td-actions" data-label="" style={{ whiteSpace: 'nowrap' }}>
                    {(isSelf || canEditThis) && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-icon"
                        aria-label="Editar usuario"
                        title="Editar usuario"
                        onClick={() => openEditDialog(u, isSelf)}
                      >
                        <Icon path={EDIT_ICON} size={14} />
                      </button>
                    )}
                    {canEditThis && (
                      <>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ padding: '6px 10px', fontSize: 12.5 }}
                          onClick={() => toggleActive(u)}
                        >
                          {u.activo ? 'Suspender' : 'Reactivar'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-icon"
                          aria-label="Eliminar"
                          title="Eliminar usuario"
                          onClick={() => removeUser(u)}
                        >
                          <Icon path={DELETE_ICON} size={14} />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {invite && (
        <Dialog
          title="Invitar usuario al panel"
          actions={
            <>
              <button type="button" className="btn btn-secondary" disabled={sendingInvite} onClick={() => setInvite(null)}>Cancelar</button>
              <button type="button" className="btn btn-primary" disabled={sendingInvite} onClick={sendInvite}>{sendingInvite ? 'Enviando…' : 'Enviar invitación'}</button>
            </>
          }
        >
          <div className="field">
            <label>Nombre<span className="field-optional">(opcional)</span></label>
            <input className="input" value={invite.nombre} onChange={(e) => setInvite({ ...invite, nombre: e.target.value })} />
          </div>
          <div className="field">
            <label>Email<span className="field-required">*</span></label>
            <input className="input" type="email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} />
          </div>
          <div className="field">
            <label>Rol</label>
            <select className="input" value={invite.rol} onChange={(e) => setInvite({ ...invite, rol: e.target.value as AdminRole })}>
              {assignableRoles.map((r) => (
                <option key={r} value={r}>{ADMIN_ROLE_LABEL[r]}</option>
              ))}
            </select>
          </div>
          <p style={{ fontSize: 12, opacity: 0.55 }}>Se enviará una invitación por email para configurar su acceso.</p>
        </Dialog>
      )}

      {editDraft && (
        <Dialog
          title="Editar usuario"
          width={400}
          actions={
            <>
              <button type="button" className="btn btn-secondary" disabled={savingEdit} onClick={() => setEditDraft(null)}>Cancelar</button>
              <button type="button" className="btn btn-primary" disabled={savingEdit} onClick={saveEdit}>
                {savingEdit ? 'Guardando…' : 'Guardar'}
              </button>
            </>
          }
        >
          <div className="field">
            <label>Nombre<span className="field-required">*</span></label>
            <input className="input" value={editDraft.nombre} onChange={(e) => setEditDraft({ ...editDraft, nombre: e.target.value })} />
          </div>
          <div className="field">
            <label>Email<span className="field-required">*</span></label>
            <input className="input" type="email" value={editDraft.email} onChange={(e) => setEditDraft({ ...editDraft, email: e.target.value })} />
          </div>
          {editDraft.isSelf && (
            <button
              type="button"
              className="btn btn-ghost"
              style={{ padding: '4px 0' }}
              onClick={() => {
                setEditDraft(null);
                openPasswordDialog();
              }}
            >
              Cambiar mi contraseña →
            </button>
          )}
          {editError && <p style={{ color: 'var(--color-accent-700)', fontSize: 13, margin: 'var(--space-2) 0 0' }}>{editError}</p>}
        </Dialog>
      )}

      {showPasswordDialog && (
        <Dialog
          title="Cambiar mi contraseña"
          width={400}
          actions={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setShowPasswordDialog(false)}>Cancelar</button>
              <button type="button" className="btn btn-primary" disabled={changingPassword || !currentPassword || newPassword.length < 8} onClick={changePassword}>
                Cambiar contraseña
              </button>
            </>
          }
        >
          <p style={{ fontSize: 12.5, opacity: 0.65, marginTop: 0 }}>
            Solo afecta a tu propia cuenta — pedimos la contraseña actual para confirmar que sos vos.
          </p>
          <div className="field">
            <label>Contraseña actual<span className="field-required">*</span></label>
            <input className="input" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </div>
          <div className="field">
            <label>Nueva contraseña<span className="field-required">*</span></label>
            <input className="input" type="password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div className="field">
            <label>Confirmar nueva contraseña<span className="field-required">*</span></label>
            <input className="input" type="password" minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
          {passwordError && <p style={{ color: 'var(--color-accent-700)', fontSize: 13, margin: 0 }}>{passwordError}</p>}
        </Dialog>
      )}
      {confirmDialog}
    </div>
  );
}
