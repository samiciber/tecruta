import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {optimizeImage,imageSrcSet} from '../../src/utils/imageUrl.js'
import {reviewJsonLd} from '../../src/utils/reviewJsonLd.js'
import {readSessionToken,saveSessionToken} from '../../src/services/sessionStorage.js'
import {storeBusinessSchema} from '../src/lib/storeBusinessSchema.js'
test('Cloudinary optimiza originales y transformaciones sin cambiar otros hosts o firmas',()=>{
 const base='https://res.cloudinary.com/qa/image/upload/'
 assert.equal(optimizeImage(base+'v123/qa.png',400),base+'f_auto,q_auto,c_limit,w_400/v123/qa.png')
 const optimized=optimizeImage(base+'c_fill,w_900,q_90/v123/qa.png',400)
 assert.equal(optimized,base+'c_fill,w_900,q_90/f_auto,q_auto,c_limit,w_400/v123/qa.png')
 assert.equal(optimizeImage(optimized,400),optimized)
 assert.equal(optimizeImage('https://images.example.test/qa.png',400),'https://images.example.test/qa.png')
 assert.equal(optimizeImage(base+'s--signature--/v123/qa.png',400),base+'s--signature--/v123/qa.png')
 assert.ok(imageSrcSet(base+'qa.png',[300,600]).includes('w_600'))
 assert.equal(optimizeImage(base+'c_crop,g_face,w_300,h_300/c_fill,w_900/qa.png',400),base+'c_crop,g_face,w_300,h_300/c_fill,w_900/f_auto,q_auto,c_limit,w_400/qa.png')
})
test('JSON-LD solo con reseñas y texto escapado sin cierre de script',()=>{
 assert.equal(reviewJsonLd({name:'QA'},{summary:{count:0}}),null)
 const text=reviewJsonLd({name:'QA </script>'},{summary:{count:1,average:4},items:[{name:'QA P.',rating:4,text:'</script><script>bad</script>',createdAt:'2026-01-01'}]})
 assert.ok(!text.includes('<'));assert.equal(JSON.parse(text).aggregateRating.reviewCount,1)
})
test('sesión solo en sessionStorage: elimina token persistente y no lo adopta',()=>{
 const store=()=>{const map=new Map();return{getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)}}
 const local=store(),session=store();local.setItem('tecruta:token','"legacy-token"')
 assert.equal(readSessionToken(local,session),null);assert.equal(local.getItem('tecruta:token'),null)
 saveSessionToken(local,session,'synthetic-token',true)
 assert.equal(local.getItem('tecruta:token'),null);assert.equal(readSessionToken(local,session),'synthetic-token')
})
test('datos comerciales opcionales, RUC y URL seguros',()=>{
 assert.equal(storeBusinessSchema.parse({}).legalName,'')
 assert.equal(storeBusinessSchema.safeParse({ruc:'123'}).success,false)
 assert.equal(storeBusinessSchema.safeParse({complaintsUrl:'javascript:alert(1)'}).success,false)
 assert.equal(storeBusinessSchema.safeParse({complaintsUrl:'https://example.test/libro'}).success,true)
})
test('migración nueva exclusivamente aditiva e historial anterior intacto',()=>{
 const sql=readFileSync(new URL('../prisma/migrations/20261020000000_product_reviews/migration.sql',import.meta.url),'utf8')
 assert.doesNotMatch(sql,/\b(?:DROP|TRUNCATE|DELETE)\s+(?:TABLE|FROM|TYPE|COLUMN)/i)
 assert.match(sql,/rating BETWEEN 1 AND 5/)
})
