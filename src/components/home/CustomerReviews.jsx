import React,{useEffect,useState} from 'react'
import {Link} from 'react-router-dom'
import {api} from '../../services/api.js'
import ReviewCard from '../product/ReviewCard.jsx'
export default function CustomerReviews(){
  const [items,setItems]=useState([])
  useEffect(()=>{let active=true;api.reviews.recent().then(data=>{if(active)setItems(data.items)}).catch(()=>{});return()=>{active=false}},[])
  if(items.length<3)return null
  return <section className="container-tr shop-customer-reviews" aria-labelledby="customer-reviews-title"><h2 id="customer-reviews-title">Opiniones de compras entregadas</h2><div className="review-home-grid">{items.map(row=><div key={row.id}><Link to={`/producto/${row.product.slug}#resenas`}>{row.product.name}</Link><ReviewCard review={row}/></div>)}</div></section>
}
