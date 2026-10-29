import { useQuery } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Badge, Button, Drawer, Empty, ErrorBox, Field, Input, Loading, PageHeader, Section, Select, Toggle } from '../components/ui'
import { api } from '../lib/api'
import { dateTime } from '../lib/format'
import { useAction } from '../lib/hooks'
import type { Permission, Role, Staff } from '../lib/types'

export default function Team() {
  const users = useQuery({ queryKey: ['staff'], queryFn: () => api.get<Staff[]>('/api/admin/team/users') })
  const roles = useQuery({ queryKey: ['roles'], queryFn: () => api.get<Role[]>('/api/admin/team/roles') })
  const perms = useQuery({ queryKey: ['permissions'], queryFn: () => api.get<Permission[]>('/api/admin/team/permissions'), staleTime: Infinity })
  const [editUser, setEditUser] = useState<Partial<Staff> & { password?: string } | null>(null)
  const [editRole, setEditRole] = useState<Partial<Role> | null>(null)

  const saveUser = useAction((u: Partial<Staff> & { password?: string }) => {
    const body = { name: u.name, email: u.email, phone: u.phone || undefined, roleId: u.roleId, isActive: u.isActive ?? true, password: u.password || undefined }
    return u.id ? api.put(`/api/admin/team/users/${u.id}`, body) : api.post('/api/admin/team/users', body)
  }, { success: 'Team member saved', invalidate: ['staff', 'roles', 'managers'], onSuccess: () => setEditUser(null) })
  const saveRole = useAction((r: Partial<Role>) => {
    const body = { name: r.name, description: r.description, permissions: r.permissions ?? [] }
    return r.id ? api.put(`/api/admin/team/roles/${r.id}`, body) : api.post('/api/admin/team/roles', body)
  }, { success: 'Role saved', invalidate: ['roles'], onSuccess: () => setEditRole(null) })
  const delRole = useAction((id: number) => api.del(`/api/admin/team/roles/${id}`), { success: 'Role deleted', invalidate: ['roles'], onSuccess: () => setEditRole(null) })

  const groups = (perms.data ?? []).reduce<Record<string, Permission[]>>((a, p) => ({ ...a, [p.group]: [...(a[p.group] ?? []), p] }), {})

  return (
    <>
      <PageHeader title="Team & roles" subtitle="Who can sign in to this admin and what each role can do." />
      <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <Section title="Team members" pad={false} actions={<Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setEditUser({ isActive: true })}>Add member</Button>}>
          <ErrorBox error={users.error} />
          {users.isLoading ? <Loading /> : !users.data?.length ? <Empty title="No team members" /> : (
            <table className="tbl">
              <thead><tr><th>Name</th><th>Role</th><th className="text-right">Partners managed</th><th>Last sign-in</th><th /></tr></thead>
              <tbody>
                {users.data.map((u) => (
                  <tr key={u.id} className={u.isActive ? '' : 'opacity-50'}>
                    <td><div className="font-semibold">{u.name}</div><div className="text-2xs text-ink-faint">{u.email}{u.phone && ` · ${u.phone}`}</div></td>
                    <td>{u.roleName}{!u.isActive && <Badge className="ml-2">Disabled</Badge>}</td>
                    <td className="num text-right">{u.partnerCount}</td>
                    <td className="text-ink-soft">{u.lastLoginAt ? dateTime(u.lastLoginAt) : 'Never'}</td>
                    <td className="text-right"><Button size="sm" variant="ghost" onClick={() => setEditUser(u)}>Edit</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
        <Section title="Roles" pad={false} actions={<Button size="sm" variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={() => setEditRole({ permissions: [] })}>Add role</Button>}>
          <ul className="divide-y divide-line">
            {roles.data?.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-2 px-4 py-3">
                <div><div className="font-semibold">{r.name} <span className="text-xs font-normal text-ink-faint">· {r.userCount} {r.userCount === 1 ? 'person' : 'people'}</span></div>
                  <div className="text-sm text-ink-soft">{r.description}</div></div>
                {!r.isSystem && <Button size="sm" variant="ghost" onClick={() => setEditRole(r)}>Edit</Button>}
              </li>
            ))}
          </ul>
        </Section>
      </div>

      {editUser && (
        <Drawer open onClose={() => setEditUser(null)} title={editUser.id ? 'Edit team member' : 'Add team member'}
          footer={<><Button variant="secondary" onClick={() => setEditUser(null)}>Cancel</Button><Button busy={saveUser.isPending} onClick={() => saveUser.mutate(editUser)}>Save</Button></>}>
          <div className="space-y-3">
            <Field label="Name"><Input autoFocus value={editUser.name ?? ''} onChange={(e) => setEditUser({ ...editUser, name: e.target.value })} /></Field>
            <Field label="Email (used to sign in)"><Input type="email" value={editUser.email ?? ''} onChange={(e) => setEditUser({ ...editUser, email: e.target.value })} /></Field>
            <Field label="Mobile"><Input inputMode="tel" value={editUser.phone ?? ''} onChange={(e) => setEditUser({ ...editUser, phone: e.target.value })} /></Field>
            <Field label="Role"><Select value={editUser.roleId ?? ''} onChange={(e) => setEditUser({ ...editUser, roleId: Number(e.target.value) })}><option value="">Choose…</option>{roles.data?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</Select></Field>
            <Field label={editUser.id ? 'New password (leave blank to keep)' : 'Password'} hint="At least 8 characters"><Input type="password" autoComplete="new-password" value={editUser.password ?? ''} onChange={(e) => setEditUser({ ...editUser, password: e.target.value })} /></Field>
            <Toggle checked={editUser.isActive ?? true} onChange={(v) => setEditUser({ ...editUser, isActive: v })} label="Can sign in" />
          </div>
        </Drawer>
      )}

      {editRole && (
        <Drawer open onClose={() => setEditRole(null)} title={editRole.id ? `Edit role: ${editRole.name}` : 'New role'}
          footer={<>
            {editRole.id && <Button variant="danger" className="mr-auto" icon={<Trash2 className="h-4 w-4" />} busy={delRole.isPending} onClick={() => delRole.mutate(editRole.id!)}>Delete</Button>}
            <Button variant="secondary" onClick={() => setEditRole(null)}>Cancel</Button><Button busy={saveRole.isPending} onClick={() => saveRole.mutate(editRole)}>Save</Button>
          </>}>
          <div className="space-y-3">
            <Field label="Role name"><Input autoFocus value={editRole.name ?? ''} onChange={(e) => setEditRole({ ...editRole, name: e.target.value })} /></Field>
            <Field label="Description"><Input value={editRole.description ?? ''} onChange={(e) => setEditRole({ ...editRole, description: e.target.value })} /></Field>
            {Object.entries(groups).map(([g, ps]) => (
              <fieldset key={g} className="rounded-md border border-line p-3">
                <legend className="px-1 text-xs font-semibold text-ink-soft">{g}</legend>
                <div className="space-y-1.5">
                  {ps.map((p) => (
                    <label key={p.key} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={editRole.permissions?.includes(p.key) ?? false}
                        onChange={(e) => setEditRole({ ...editRole, permissions: e.target.checked ? [...(editRole.permissions ?? []), p.key] : (editRole.permissions ?? []).filter((x) => x !== p.key) })} />
                      {p.label}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
        </Drawer>
      )}
    </>
  )
}
