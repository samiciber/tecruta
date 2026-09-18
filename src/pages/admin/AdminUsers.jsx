import React, { useContext, useEffect, useState } from 'react'
import { api } from '../../services/api.js'
import { useAuth } from '../../hooks/useAuth.js'
import { ToastContext } from '../../components/ui/ToastProvider.jsx'

export default function AdminUsers() {
  const { token } = useAuth()
  const toast = useContext(ToastContext)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.admin
      .getUsers(token)
      .then(setUsers)
      .catch((err) => toast?.showToast(err.message, 'error'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-sm text-ink-soft dark:text-paper/60">Cargando clientes…</p>

  return (
    <div className="overflow-x-auto rounded-xl2 border border-paper-line dark:border-night-line">
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
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    u.role === 'ADMIN'
                      ? 'bg-route-soft text-route dark:bg-route-softDark'
                      : 'bg-paper-line text-ink-soft dark:bg-night-line dark:text-paper/50'
                  }`}
                >
                  {u.role === 'ADMIN' ? 'Administrador' : 'Cliente'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {users.length === 0 && <p className="p-4 text-sm text-ink-soft dark:text-paper/60">No hay clientes registrados todavía.</p>}
    </div>
  )
}