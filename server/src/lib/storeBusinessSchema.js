import {z} from 'zod'
const text = max => z.string().trim().max(max).default('')
export const storeBusinessSchema = z.object({
  legalName:text(200),ruc:text(11).refine(value=>!value||/^\d{11}$/.test(value),'Indica 11 dígitos de RUC.'),address:text(400),
  complaintsUrl:text(500).refine(value=>{if(!value)return true;try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password}catch{return false}},'Usa una URL HTTPS válida.'),
  warrantyText:text(2000),shippingText:text(2000),benefits:z.array(z.string().trim().min(3).max(160)).max(6).default([]),
}).strict()
