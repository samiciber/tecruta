import React, {useCallback,useEffect,useState} from 'react'
import {Link} from 'react-router-dom'
import {api} from '../../services/api.js'
import {useAuth} from '../../hooks/useAuth.js'
import Rating from './Rating.jsx'
import ReviewCard from './ReviewCard.jsx'
import {reviewJsonLd} from '../../utils/reviewJsonLd.js'

export default function ProductReviews({product}) {
  const {token,user}=useAuth(), [data,setData]=useState(null),[eligibility,setEligibility]=useState(null)
  const [sort,setSort]=useState('recent'),[rating,setRating]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[message,setMessage]=useState(''),[voted,setVoted]=useState([]),[reload,setReload]=useState(0)
  const [form,setForm]=useState({rating:5,title:'',text:''})
  useEffect(()=>{let active=true;setData(null);setError('');setLoading(true)
    api.reviews.list(product.id,{sort,rating}).then(value=>{if(active)setData(value)}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)})
    return()=>{active=false}
  },[product.id,sort,rating,reload])
  useEffect(()=>{let active=true;setEligibility(null)
    if(token)api.reviews.eligibility(product.id,token).then(value=>{if(active)setEligibility(value)}).catch(e=>{if(active)setEligibility({eligible:false,message:e.message})})
    return()=>{active=false}
  },[product.id,token,reload])
  useEffect(()=>{setMessage('');setVoted([]);setForm({rating:5,title:'',text:''})},[product.id])
  async function submit(e){e.preventDefault();if(busy)return;setBusy(true);setError('');try{await api.reviews.create(product.id,{...form,orderItemId:eligibility.orderItemId},token);setMessage('Reseña enviada. Se publicará después de la revisión de la tienda.');setReload(v=>v+1)}catch(e){setError(e.message)}finally{setBusy(false)}}
  const helpful=useCallback(async id=>{if(!token){setError('Inicia sesión como cliente para marcar una reseña como útil.');return}setBusy(true);setError('');try{const result=await api.reviews.helpful(id,token);setVoted(v=>[...v,id]);setData(value=>({...value,items:value.items.map(row=>row.id===id?{...row,helpfulCount:result.helpfulCount}:row)}))}catch(e){setError(e.message)}finally{setBusy(false)}},[token])
  async function more(){setBusy(true);try{const page=await api.reviews.list(product.id,{sort,rating,cursor:data.nextCursor});setData(value=>({...page,items:[...value.items,...page.items.filter(row=>!value.items.some(old=>old.id===row.id))]}))}catch(e){setError(e.message)}finally{setBusy(false)}}
  const schema=reviewJsonLd(product,data)
  return <section id="resenas" className="product-reviews" aria-labelledby="reviews-title">
    {schema && <script type="application/ld+json" dangerouslySetInnerHTML={{__html:schema}}/>}
    <h2 id="reviews-title">Opiniones de clientes</h2>
    {loading && <p role="status">Cargando reseñas…</p>}
    {error && <p role="alert">{error} <button type="button" className="review-button" onClick={()=>setReload(v=>v+1)}>Reintentar</button></p>}
    {message && <p role="status">{message}</p>}
    {data && <>
      {data.summary.count > 0 ? <div className="review-summary"><div><strong className="review-average">{data.summary.average.toFixed(1)}</strong><p>de 5 · {data.summary.count} reseñas</p><Rating count={data.summary.count} sum={data.summary.sum}/></div><div>{data.summary.distribution.map(row=><div className="review-distribution" key={row.rating}><span>{row.rating} estrellas</span><meter min="0" max={data.summary.count} value={row.count} aria-label={`${row.rating} estrellas: ${row.count} reseñas`}/><span>{row.count}</span></div>)}</div></div> : <p>Sé el primero en opinar</p>}
      {data.summary.count > 0 && <><div className="review-filters"><label>Ordenar<select value={sort} onChange={e=>setSort(e.target.value)} disabled={busy}><option value="recent">Más recientes</option><option value="helpful">Más útiles</option></select></label><label>Calificación<select value={rating} onChange={e=>setRating(e.target.value)} disabled={busy}><option value="">Todas las estrellas</option>{[5,4,3,2,1].map(n=><option key={n} value={n}>{n} estrellas</option>)}</select></label></div>
        {data.items.map(review=><ReviewCard key={review.id} review={review} onHelpful={helpful} disabled={busy || user?.role && user.role !== 'CUSTOMER'} voted={voted.includes(review.id)}/>)}
        {!data.items.length && <p>No hay reseñas con esa calificación.</p>}{data.nextCursor && <button type="button" className="review-button" disabled={busy} onClick={more}>Ver más reseñas</button>}</>}
    </>}
    {!token ? <p><Link to="/iniciar-sesion">Inicia sesión</Link> para consultar si puedes opinar sobre tu compra.</p> : !eligibility ? <p role="status">Comprobando tu compra…</p> : eligibility.eligible ? <form className="review-form" onSubmit={submit}><h3>Comparte tu experiencia</h3><label>Calificación<select value={form.rating} onChange={e=>setForm({...form,rating:Number(e.target.value)})}>{[5,4,3,2,1].map(n=><option key={n} value={n}>{n} estrellas</option>)}</select></label><label>Título (opcional)<input maxLength={80} value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label><label>Tu opinión<textarea required minLength={10} maxLength={1000} rows={4} value={form.text} onChange={e=>setForm({...form,text:e.target.value})}/></label><p>Entre 10 y 1000 caracteres, sin enlaces ni HTML. La tienda revisa las reseñas antes de publicarlas.</p><button className="review-button" disabled={busy} type="submit">{busy?'Enviando…':'Enviar reseña'}</button></form> : <p>{eligibility.message}</p>}
  </section>
}
