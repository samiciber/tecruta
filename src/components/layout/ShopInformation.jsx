import React from 'react'
import {MessageCircle} from 'lucide-react'
import {api} from '../../services/api.js'
import {useCachedResource} from '../../hooks/useCachedResource.js'
import {useSiteSettings} from '../../hooks/useSiteContent.js'
import {useLocation} from 'react-router-dom'
export function ShopTopStrip(){
 const {data:footer}=useCachedResource('footer',api.getFooter,{fallback:null})
 const {data:methods}=useCachedResource('shop-payment-labels',api.getPaymentMethods,{fallback:[]})
 const labels=methods.filter(m=>m.active!==false).map(m=>m.label)
 const whatsapp=/^\d{7,15}$/.test(footer?.whatsapp||'')?footer.whatsapp:null
 if(!labels.length&&!whatsapp)return null
 return <div className="shop-top-strip"><div className="container-tr"><span>{labels.length ? `Medios de pago: ${labels.join(' · ')}` : ''}</span>{whatsapp&&<a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer">Consultas por WhatsApp</a>}</div></div>
}
export function ShopWhatsApp(){
 const {pathname}=useLocation()
 const {data}=useCachedResource('footer',api.getFooter,{fallback:null})
 if(pathname==='/checkout')return null
 if(!/^\d{7,15}$/.test(data?.whatsapp||''))return null
 return <a className="shop-whatsapp" href={`https://wa.me/${data.whatsapp}`} target="_blank" rel="noopener noreferrer" aria-label="Consultar por WhatsApp"><MessageCircle aria-hidden="true" width="24" height="24"/></a>
}
export function BusinessDetails(){
 const {settings}=useSiteSettings(),business=settings.storeBusiness
 if(!business)return null
 const fields=[['Razón social',business.legalName],['RUC',business.ruc],['Dirección',business.address],['Garantía',business.warrantyText],['Envíos',business.shippingText]].filter(([,v])=>v?.trim())
 if(!fields.length&&!business.complaintsUrl)return null
 return <section className="shop-business container-tr" aria-label="Información comercial"><dl>{fields.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>{business.complaintsUrl&&<a href={business.complaintsUrl} target="_blank" rel="noopener noreferrer">Libro de Reclamaciones</a>}</section>
}
