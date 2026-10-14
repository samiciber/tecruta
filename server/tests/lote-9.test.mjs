import { test } from 'node:test'
import assert from 'node:assert/strict'
import { serializeCustomerOrder } from '../src/lib/customerOrders.js'
import { downloadReceipt, receiptType, trustedReceiptUrl } from '../src/lib/receiptDownload.js'
const url = 'https://res.cloudinary.com/qa-test/image/upload/v1/comprobante.png'
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64')
const tooLarge = 8 * 1024 * 1024 + 1

test('customer DTO omits internal notes, delivery URLs and capability/idempotency hashes', () => {
  const dto = serializeCustomerOrder({ id: 'qa-order', status: 'PAID', receiptUrl: url, receiptTokenHash: 'qa-secret-hash', requestHash: 'qa-request-hash',
    statusHistory: [{ id: 'qa-event', status: 'PAID', createdAt: '2026-10-12T15:00:00Z', note: 'QA internal note', orderId: 'qa-order' }] })
  assert.equal(dto.hasReceipt, true)
  assert.deepEqual(dto.statusHistory, [{ id: 'qa-event', status: 'PAID', createdAt: '2026-10-12T15:00:00Z' }])
  for (const field of ['receiptUrl','receiptTokenHash','requestHash']) assert.ok(!Object.hasOwn(dto, field))
  assert.ok(!JSON.stringify(dto).includes('QA internal note'))
  const empty = serializeCustomerOrder({ id: 'qa-old-order' }); assert.equal(empty.hasReceipt, false); assert.deepEqual(empty.statusHistory, [])
})
test('receipt URLs require the exact HTTPS Cloudinary upload host without credentials or redirects', () => {
  assert.equal(trustedReceiptUrl(url), url)
  assert.ok(trustedReceiptUrl('https://res.cloudinary.com/qa-test/raw/upload/v1/file.pdf'))
  for (const value of [null, '', '//res.cloudinary.com/a/image/upload/x', 'http://res.cloudinary.com/a/image/upload/x',
    'https://res.cloudinary.com.evil.invalid/a/image/upload/x', 'https://res.cloudinary.com@evil.invalid/a/image/upload/x',
    'https://evil.invalid@res.cloudinary.com/a/image/upload/x', 'https://res.cloudinary.com:444/a/image/upload/x',
    'https://127.0.0.1/a/image/upload/x', 'https://res.cloudinary.com/a/image/fetch/https://evil.invalid/file',
    url+'#fragment', url+'\n', url+'\\bad']) assert.equal(trustedReceiptUrl(value), null)
})
test('magic bytes allow raster images and PDF, reject HTML/SVG and unknown content', () => {
  for (const [bytes, mime] of [[png,'image/png'],[Buffer.from([255,216,255]),'image/jpeg'],[Buffer.from('GIF89a'),'image/gif'],
    [Buffer.from('RIFF0000WEBP'),'image/webp'],[Buffer.from('%PDF-1.7'),'application/pdf']]) assert.equal(receiptType(bytes),mime)
  for (const value of ['','<html>','<svg xmlns="http://www.w3.org/2000/svg">','not an image']) assert.equal(receiptType(Buffer.from(value)),null)
})
test('download validates type and uses a no-redirect request with cancellation', async () => {
  let options
  const file = await downloadReceipt(url,{fetcher:async (_url,opts)=>{options=opts;return new Response(png,{headers:{'content-type':'image/png'}})}})
  assert.equal(options.redirect,'error'); assert.ok(options.signal.aborted)
  assert.deepEqual(file.bytes,png); assert.equal(file.type,'image/png'); assert.equal(file.extension,'png')
  const pdf = await downloadReceipt(url,{fetcher:async()=>new Response('%PDF-1.7 QA',{headers:{'content-type':'application/octet-stream'}})})
  assert.equal(pdf.type,'application/pdf')
})
test('unsafe URL, HTTP failures and MIME mismatch return safe errors without provider details', async () => {
  let fetched = false
  await assert.rejects(downloadReceipt('https://evil.invalid/private',{fetcher:async()=>{fetched=true}}),{status:502});assert.equal(fetched,false)
  for (const fetcher of [async()=>new Response('QA provider private detail',{status:403}),
    async()=>new Response(png,{headers:{'content-type':'text/html'}}),async()=>new Response('<svg/>',{headers:{'content-type':'image/svg+xml'}}),
    async()=>{throw new Error('QA provider private detail '+url)}]) {
    await assert.rejects(downloadReceipt(url,{fetcher}),err=>err.status===502&&!String(err).includes('QA provider private detail')&&!String(err).includes(url))
  }
})
test('declared and streamed decoded sizes are both bounded to 8 MiB', async () => {
  await assert.rejects(downloadReceipt(url,{fetcher:async()=>new Response(png,{headers:{'content-length':String(tooLarge)}})}),{status:502})
  await assert.rejects(downloadReceipt(url,{fetcher:async()=>new Response(Buffer.alloc(tooLarge))}),{status:502})
})
test('slow receipt providers are aborted within the configured deadline', async () => {
  let aborted = false
  await assert.rejects(downloadReceipt(url,{timeout:20,fetcher:async (_url,{signal})=>new Promise((_resolve,reject)=>{
    signal.addEventListener('abort',()=>{aborted=true;reject(new Error('QA timeout'))},{once:true})
  })}),{status:502})
  assert.equal(aborted,true)
})
