import React, { useCallback, useEffect, useState } from 'react'
import { api } from '../../services/api.js'
import { useAuth } from '../../hooks/useAuth.js'
export default function AdminNewsletter() {
  const { token } = useAuth()
  const [data, setData] = useState(null), [page, setPage] = useState(1), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const load = useCallback(async () => { setError(''); try { setData(await api.admin.getNewsletter(page, token)) } catch (err) { setError(err.message) } }, [page, token])
  useEffect(() => { load() }, [load])
  const download = async () => { setBusy(true); setError(''); try { const blob = await api.admin.exportNewsletter(token); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'newsletter-subscribers.csv'; a.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000) } catch (err) { setError(err.message) } finally { setBusy(false) } }
  return <section><div className="mb-5 flex flex-wrap items-center justify-between gap-4"><h2 className="font-display text-xl font-bold">Suscriptores</h2><button className="btn-primary px-4 py-2" onClick={download} disabled={busy}>{busy ? 'Exportando…' : 'Exportar CSV'}</button></div>
    {error && <p role="alert" className="my-4 text-sm text-red-700 dark:text-red-300">{error} <button onClick={load} className="underline">Reintentar</button></p>}
    {!data && !error && <p role="status">Cargando suscriptores…</p>}
    {data && <><p className="mb-4 text-sm">{data.total} suscriptores registrados. No se envían correos desde esta pantalla.</p><div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Correos suscritos y fecha de registro</caption><thead><tr><th className="p-3">Correo</th><th className="p-3">Registro</th></tr></thead><tbody>{data.items.map(item => <tr key={item.id}><td className="break-all p-3">{item.email}</td><td className="p-3">{new Date(item.createdAt).toLocaleString('es-PE', { timeZone: 'America/Lima' })}</td></tr>)}</tbody></table></div><div className="mt-4 flex gap-4"><button className="btn-secondary px-3 py-2" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</button><span>Página {page}</span><button className="btn-secondary px-3 py-2" disabled={page * data.pageSize >= data.total} onClick={() => setPage(p => p + 1)}>Siguiente</button></div></>}
  </section>
}
