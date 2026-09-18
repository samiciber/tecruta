import React, { useEffect, useState } from 'react'
import departamentos from '../../data/ubigeo/departamentos.json'

// Mapa de slug de departamento -> función de importación perezosa de su archivo.
// Vite necesita ver el patrón import() de forma explícita para poder
// generar un archivo separado por cada departamento.
const cargarDepartamento = (slug) => import(`../../data/ubigeo/${slug}.json`)

export default function UbigeoSelector({ value, onChange }) {
  const [datosDepartamento, setDatosDepartamento] = useState(null)
  const [cargando, setCargando] = useState(false)

  const { departamento, provincia, distrito } = value

  useEffect(() => {
    if (!departamento) {
      setDatosDepartamento(null)
      return
    }
    setCargando(true)
    const dep = departamentos.find((d) => d.name === departamento)
    if (!dep) {
      setCargando(false)
      return
    }
    cargarDepartamento(dep.slug)
      .then((mod) => setDatosDepartamento(mod.default))
      .finally(() => setCargando(false))
  }, [departamento])

  const provincias = datosDepartamento?.provincias || []
  const distritos = provincias.find((p) => p.nombre === provincia)?.distritos || []

  const handleDepartamento = (e) => {
    onChange({ ...value, departamento: e.target.value, provincia: '', distrito: '' })
  }
  const handleProvincia = (e) => {
    onChange({ ...value, provincia: e.target.value, distrito: '' })
  }
  const handleDistrito = (e) => {
    onChange({ ...value, distrito: e.target.value })
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-soft dark:text-paper/60">Departamento *</span>
        <select value={departamento} onChange={handleDepartamento} className="input-tr" required>
          <option value="">Selecciona...</option>
          {departamentos.map((d) => (
            <option key={d.slug} value={d.name}>
              {d.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-soft dark:text-paper/60">Provincia *</span>
        <select value={provincia} onChange={handleProvincia} className="input-tr" required disabled={!departamento || cargando}>
          <option value="">{cargando ? 'Cargando...' : 'Selecciona...'}</option>
          {provincias.map((p) => (
            <option key={p.nombre} value={p.nombre}>
              {p.nombre}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-ink-soft dark:text-paper/60">Distrito *</span>
        <select value={distrito} onChange={handleDistrito} className="input-tr" required disabled={!provincia}>
          <option value="">Selecciona...</option>
          {distritos.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}