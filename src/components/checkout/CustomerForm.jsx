import React from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.js'

export default function CustomerForm({ data, onChange }) {
  const { isAuthenticated, user } = useAuth()
  const set = (field) => (e) => onChange({ ...data, [field]: e.target.value })

  return (
    <div className="flex flex-col gap-3">
      {isAuthenticated ? (
        <p className="text-xs text-ink-soft dark:text-paper/50">
          Usando los datos de tu cuenta (<span className="font-medium text-ink dark:text-paper">{user.email}</span>). Puedes editarlos
          solo para este pedido.
        </p>
      ) : (
        <p className="text-xs text-ink-soft dark:text-paper/50">
          ¿Ya tienes cuenta?{' '}
          <Link to="/iniciar-sesion" className="font-medium text-route hover:underline">
            Inicia sesión
          </Link>{' '}
          para completar tus datos automáticamente.
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-soft dark:text-paper/60">Nombre *</span>
          <input type="text" value={data.nombre} onChange={set('nombre')} placeholder="Tu nombre" className="input-tr" required />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-soft dark:text-paper/60">Apellido *</span>
          <input type="text" value={data.apellido} onChange={set('apellido')} placeholder="Tu apellido" className="input-tr" required />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-soft dark:text-paper/60">Correo electrónico *</span>
          <input
            type="email"
            value={data.correo}
            onChange={set('correo')}
            placeholder="tucorreo@ejemplo.com"
            className="input-tr"
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-soft dark:text-paper/60">Celular *</span>
          <input type="tel" value={data.celular} onChange={set('celular')} placeholder="9XX XXX XXX" className="input-tr" required />
        </label>
      </div>
    </div>
  )
}