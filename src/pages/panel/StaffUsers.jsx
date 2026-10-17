import React, { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth.js'
import { api } from '../../services/api.js'

const roles = { ADMIN: 'Administrador', CASHIER: 'Cajero', WAREHOUSE: 'Almacén', CUSTOMER: 'Sin acceso al panel' }
const empty = { nombre: '', apellido: '', email: '', role: 'CASHIER' }
export default function StaffUsers() {
  const { user, token } = useAuth()
  const [rows, setRows] = useState([]), [form, setForm] = useState(empty)
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true)
  const [error, setError] = useState(''), [message, setMessage] = useState('')
  const refresh = () => api.admin.getStaff(token).then(setRows)
  useEffect(() => { refresh().catch(e => setError(e.message)).finally(() => setLoading(false)) }, [token])
  async function run(operation) {
    setBusy(true); setError(''); setMessage('')
    try { await operation(); await refresh() } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  const deliveryMessage = delivery => delivery === 'SENT'
    ? 'El proveedor de correo recibió la solicitud de envío. El trabajador debe establecer su contraseña; revisa también spam.'
    : 'La cuenta quedó pendiente, pero el envío de correo falló. Revisa la configuración y reenvía la activación. No se ha confirmado la entrega.'
  async function invite(event) {
    event.preventDefault()
    await run(async () => { const result = await api.admin.inviteStaff(form, token); setForm(empty); setMessage(deliveryMessage(result.delivery)) })
  }
  async function changeRole(row, role) {
    if (!window.confirm(`¿Cambiar el acceso de ${row.email} a «${roles[role]}»? Sus sesiones actuales se invalidarán.`)) return
    await run(async () => { await api.admin.changeUserRole(row.id, role, token); setMessage('Acceso actualizado. La persona debe iniciar sesión nuevamente. Se conserva su historial.') })
  }
  return <div className="space-y-6">
    <div><h1 className="text-2xl font-bold">Usuarios y permisos</h1><p className="mt-2 text-sm text-ink-soft dark:text-paper/60">Cuentas individuales del personal. Administrador: todas las funciones; cajero: POS y consulta de inventario; almacén: inventario.</p></div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">{error}</p>}
    {message && <p role="status" className="rounded-lg bg-blue-50 p-4 text-sm text-blue-900 dark:bg-blue-950 dark:text-blue-200">{message}</p>}
    <section className="card-surface p-5"><h2 className="mb-4 text-lg font-bold">Invitar trabajador</h2><form onSubmit={invite} className="grid gap-4 sm:grid-cols-2">
      {[['nombre', 'Nombre'], ['apellido', 'Apellido'], ['email', 'Correo del trabajador']].map(([key, label]) => <label key={key} className="text-sm">{label}<input required maxLength={key === 'email' ? 254 : 100} type={key === 'email' ? 'email' : 'text'} className="input-tr mt-1 w-full" value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} /></label>)}
      <label className="text-sm">Perfil del trabajador<select className="input-tr mt-1 w-full" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>{Object.entries(roles).filter(([key]) => key !== 'CUSTOMER').map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <p className="text-sm text-ink-soft dark:text-paper/60 sm:col-span-2">La persona define su contraseña mediante un código enviado a su correo. Si ya tiene una cuenta, asigna su perfil desde Clientes.</p><button disabled={busy} className="btn-primary justify-self-start">Crear cuenta y enviar activación</button>
    </form></section>
    <section className="card-surface overflow-hidden"><h2 className="p-5 text-lg font-bold">Personal autorizado</h2>{loading ? <p role="status" className="p-5">Cargando personal…</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-paper-line dark:border-night-line">{['Persona', 'Correo', 'Estado', 'Acceso', 'Activación'].map(label => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.id} className="border-b border-paper-line last:border-0 dark:border-night-line"><td className="px-4 py-3">{row.nombre} {row.apellido}{row.id === user.id && ' (tú)'}</td><td className="px-4 py-3">{row.email}</td><td className="px-4 py-3">{row.verified ? 'Activada' : 'Activación pendiente'}</td><td className="px-4 py-3"><select aria-label={`Acceso de ${row.email}`} className="input-tr min-w-44" value={row.role} disabled={busy || row.id === user.id} onChange={e => changeRole(row, e.target.value)}>{Object.entries(roles).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></td><td className="px-4 py-3">{!row.verified && <button className="text-route underline" disabled={busy} onClick={() => run(async () => { const result = await api.admin.resendStaffActivation(row.id, token); setMessage(deliveryMessage(result.delivery)) })}>Reenviar activación</button>}</td></tr>)}</tbody></table></div>}</section>
    <p className="text-sm text-ink-soft dark:text-paper/60">«Sin acceso al panel» retira el rol de trabajo y conserva la cuenta de cliente y todos sus registros. Para cambiar un acceso con caja abierta, el trabajador debe cerrar primero su turno. No puedes retirar tu propio acceso.</p>
  </div>
}
