import React, { useEffect, useState } from 'react'
import { api } from '../../services/api.js'
export default function WebOrdersQueue({ token, onSelect, disabled = false }) {
  const [page, setPage] = useState(1), [data, setData] = useState({ items: [], total: 0 }), [error, setError] = useState(''), [reload, setReload] = useState(0), [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true; setError(''); setLoading(true)
    api.pos.webOrders(page, token).then(value => { if (active) setData(value) }).catch(e => { if (active) setError(e.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [token, page, reload])
  return <section className="pos-panel">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">Seleccionar pedido</h2><button disabled={loading} className="pos-secondary" onClick={() => setReload(value => value + 1)}>Actualizar pedidos</button></div>
    <p className="my-3 text-sm text-slate-500 dark:text-slate-400">El cobro utiliza la reserva de inventario del pedido sin descontar nuevamente.</p>
    {loading && <p role="status" className="py-6 text-sm">Cargando pedidos…</p>}
    {error && <p role="alert" className="py-4 text-red-700 dark:text-red-300">{error} <button className="underline" onClick={() => setReload(value => value + 1)}>Reintentar</button></p>}
    {!loading && !error && <><div className="overflow-x-auto"><table className="pos-table"><thead><tr><th>Referencia</th><th>Cliente</th><th>Total</th><th>Acción</th></tr></thead><tbody>{data.items.map(order => <tr key={order.id}><td className="max-w-48 break-all font-mono text-xs">{order.id}</td><td>{order.customerNombre} {order.customerApellido}</td><td className="whitespace-nowrap">S/ {Number(order.total).toFixed(2)}</td><td><button disabled={disabled} className="pos-secondary" onClick={() => onSelect(order.id)}>Atender pedido</button></td></tr>)}</tbody></table></div>{!data.items.length && <p className="py-8 text-center text-sm">No hay pedidos pendientes por cobrar en esta página.</p>}</>}
    <div className="mt-4 flex flex-wrap items-center gap-4"><button className="pos-secondary" disabled={loading || page === 1} onClick={() => setPage(value => value - 1)}>Anterior</button><span className="text-sm">Página {page} · {data.total} pedidos por cobrar</span><button className="pos-secondary" disabled={loading || page * 20 >= data.total} onClick={() => setPage(value => value + 1)}>Siguiente</button></div>
  </section>
}
