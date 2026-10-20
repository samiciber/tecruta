import { canonicalUrl, DEFAULT_STORE_ORIGIN } from './seo.js'
export function reviewJsonLd(product, data, origin = DEFAULT_STORE_ORIGIN) {
  if (!data?.summary?.count) return null
  return JSON.stringify({'@context':'https://schema.org','@type':'Product','@id':canonicalUrl('/producto/'+encodeURIComponent(product.slug),origin)+'#product',name:product.name,
    aggregateRating:{'@type':'AggregateRating',ratingValue:Number(data.summary.average.toFixed(2)),reviewCount:data.summary.count,bestRating:5,worstRating:1},
    review:data.items.map(row=>({'@type':'Review',author:{'@type':'Person',name:row.name},datePublished:row.createdAt,reviewBody:row.text,...(row.title?{name:row.title}:{}),reviewRating:{'@type':'Rating',ratingValue:row.rating,bestRating:5,worstRating:1}}))
  }).replaceAll('<','\\u003c').replaceAll('>','\\u003e').replaceAll('&','\\u0026')
}
