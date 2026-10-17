import React, { useContext, useEffect, useState } from 'react'
import { api } from '../../services/api.js'
import { useAuth } from '../../hooks/useAuth.js'
import { ToastContext } from '../../components/ui/ToastProvider.jsx'

export default function AdminUsers() {
  const { token } = useAuth()
  const toast = useContext(ToastContext)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)

  const changeRole = async (user, role) => {
    if (!window.confirm(`¿Cambiar el rol de ${user.email}? La persona deberá iniciar sesión nuevamente.`)) return
    setSavingId(user.id)
    try {
      const updated = await api.admin.changeUserRole(user.id, role, token)
      setUsers(rows => rows.map(row => row.id === updated.id ? updated : row))
      toast?.showToast(`Rol actualizado para ${updated.email}.`, 'success')
    } catch (err) {
      toast?.showToast(err.message, 'error')
    } finally {
      setSavingId(null)
    }
  }

  useEffect(() => {
    api.admin
      .getUsers(token)
      .then(setUsers)
      .catch((err) => toast?.showToast(err.message, 'error'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-sm text-ink-soft dark:text-paper/60">Cargando clientes…</p>

  return (
    <div><h1 className="mb-2 text-2xl font-bold">Clientes y cuentas existentes</h1><p className="mb-5 text-sm text-ink-soft dark:text-paper/60">Puedes autorizar una cuenta existente para trabajar en el panel. Gestiona después su acceso desde Usuarios y permisos.</p><div className="overflow-x-auto rounded-xl2 border border-paper-line dark:border-night-line">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-paper-line bg-paper text-xs uppercase tracking-wide text-ink-soft dark:border-night-line dark:bg-night dark:text-paper/50">
            <th className="px-3 py-2.5 font-medium">Nombre</th>
            <th className="px-3 py-2.5 font-medium">Correo</th>
            <th className="px-3 py-2.5 font-medium">Rol</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-paper-line last:border-0 dark:border-night-line">
              <td className="px-3 py-2.5 text-sm text-ink dark:text-paper">
                {u.nombre} {u.apellido}
              </td>
              <td className="px-3 py-2.5 text-sm text-ink-soft dark:text-paper/60">{u.email}</td>
              <td className="px-3 py-2.5">
                {u.role === 'ADMIN' ? (
                  <span className="rounded-full bg-route-soft px-2.5 py-1 text-xs font-medium text-route dark:bg-route-softDark">Administrador</span>
                ) : (
                  <select
                    aria-label={`Rol de ${u.email}`}
                    value={u.role}
                    disabled={savingId === u.id}
                    onChange={event => changeRole(u, event.target.value)}
                    className="input-tr h-9 min-w-36 py-0 text-xs"
                  >
                    <option value="CUSTOMER">Cliente</option>
                    <option value="WAREHOUSE">Almacén</option>
                    <option value="CASHIER">Vendedor / cajero</option>
                    <option value="ADMIN">Administrador</option>
                  </select>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {users.length === 0 && <p className="p-4 text-sm text-ink-soft dark:text-paper/60">No hay clientes registrados todavía.</p>}
    </div></div>
  )
}
