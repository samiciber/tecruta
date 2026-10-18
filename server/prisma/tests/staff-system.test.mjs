import {before,after,beforeEach,test} from 'node:test'
import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {join} from 'node:path'
import {readFileSync} from 'node:fs'
import {createInventoryRuntime} from './helpers/inventory-runtime.mjs'
import {runPrisma,runDocker,createPrismaWorkspace} from './helpers/isolated-runtime.mjs'
import {totp,base32} from '../../src/lib/staffSecurity.js'
import {hash,challenge} from '../../src/lib/authSecurity.js'
let rt,base,limits,bcrypt,adminToken,worker,workerToken,permanent,mail=[],owner
const initial=randomBytes(20).toString('hex'),nextPassword=randomBytes(20).toString('hex')
async function request(path,{body,token=adminToken,method=body?'POST':'GET'}={}){
 const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined,redirect:'manual'})
 return {status:response.status,data:await response.json().catch(()=>null),location:response.headers.get('location')}
}
const login=(identifier,password=initial)=>request('/api/auth/staff-login',{token:null,body:{identifier,password}})
before(async()=>{
 process.env.CORS_ORIGINS='http://127.0.0.1:5181,http://127.0.0.1:5180';process.env.STORE_ORIGIN='http://127.0.0.1:5181';process.env.PANEL_ORIGIN='http://127.0.0.1:5180'
 process.env.MFA_ENCRYPTION_KEY=randomBytes(32).toString('base64')
 rt=await createInventoryRuntime({appOptions:async runtime=>{
  const {pathToFileURL}=await import('node:url'),load=p=>import(pathToFileURL(join(runtime.root,p)))
  const {createAuthRouter}=await load('server/src/routes/auth.routes.js')
  return {auth:createAuthRouter({db:runtime.db,mailer:{reset:async m=>mail.push(m),verification:async m=>mail.push(m)}})}
 }})
 bcrypt=(await rt.load('server/node_modules/bcryptjs/index.js')).default
 limits=await rt.load('server/src/middleware/rateLimit.js')
 await rt.db.user.update({where:{id:rt.admin.id},data:{adminUsername:'admin1234',passwordHash:await bcrypt.hash(initial,10),ownerRecoveryEnabled:true}})
 owner=await rt.db.user.findUnique({where:{id:rt.admin.id}})
 base=await rt.start();adminToken=(await login('ADMIN1234')).data.token
})
beforeEach(()=>{limits.loginRateLimiter.resetKey('127.0.0.1');limits.authActionRateLimiter.resetKey('127.0.0.1')})
after(async()=>{await rt?.close()})
test('crear personal sin correo, alias único y auditoría sin credenciales',async()=>{
 const result=await request('/api/admin/staff',{body:{username:' VENDEDOR01 ',nombre:'QA',apellido:'Caja',role:'CASHIER',temporaryPassword:initial}})
 assert.equal(result.status,201);worker=result.data;assert.equal(worker.username,'vendedor01');assert.equal(worker.mustChangePassword,true)
 const row=await rt.db.user.findUnique({where:{id:worker.id}});assert.equal(row.email,null);assert.ok(await bcrypt.compare(initial,row.passwordHash))
 assert.equal(JSON.stringify(result.data).includes(initial),false)
 assert.equal((await request('/api/admin/staff',{body:{username:'VENDEDOR01',nombre:'QA',apellido:'Otro',role:'WAREHOUSE',temporaryPassword:initial}})).status,409)
 const events=await rt.db.staffAuditEvent.findMany({where:{subjectId:worker.id}});assert.equal(events.length,1);assert.equal(JSON.stringify(events).includes(initial),false)
 assert.equal((await request('/api/admin/users/'+rt.customer.id+'/role',{method:'PATCH',body:{role:'CASHIER'}})).status,410)
})
test('actualización de personal conserva cuentas reales previas y solo habilita recuperación del titular',()=>{
 const name='qa_staff_upgrade'
 runDocker(['exec',rt.container,'psql','-X','-v','ON_ERROR_STOP=1','-U','qa_final_home','-d','qa_final_home','-c','CREATE DATABASE '+name])
 const sql=input=>runDocker(['exec','-i',rt.container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','qa_final_home','-d',name],{input}).trim()
 const url=new URL(process.env.DATABASE_URL);url.pathname='/'+name
 const workspace=createPrismaWorkspace({tempRoot:rt.tempRoot,name:'staff-upgrade-previous',schemaSource:join(rt.root,'server/prisma/schema.prisma'),migrationsSource:join(rt.root,'server/prisma/migrations'),excludedMigrations:['20261019000000_staff_credentials_security']})
 runPrisma({root:rt.root,tempRoot:rt.tempRoot,schemaPath:workspace.schemaPath,dotenvPath:process.env.DOTENV_CONFIG_PATH,databaseUrl:url.href,args:['migrate','deploy','--schema',workspace.schemaPath]})
 sql(`INSERT INTO users(id,email,"passwordHash",nombre,apellido,role,verified,"adminUsername","googleId","updatedAt") VALUES
 ('qa-old-owner','qa-owner@example.test','qa-hash-owner','QA','Titular','ADMIN',true,'admin1234','qa-google-owner','2026-01-01'),
 ('qa-old-admin','qa-admin2@example.test','qa-hash-admin','QA','Otro','ADMIN',true,'otroadmin','qa-google-other','2026-01-01'),
 ('qa-old-worker','qa-worker@example.test','qa-hash-worker','QA','Trabajador','CASHIER',true,'vendedor','qa-google-worker','2026-01-01'),
 ('qa-old-customer','qa-buyer@example.test','qa-hash-buyer','QA','Cliente','CUSTOMER',true,null,'qa-google-buyer','2026-01-01');`)
 const snapshot=`SELECT jsonb_agg(jsonb_build_object('id',id,'email',email,'passwordHash',"passwordHash",'role',role,'username',"adminUsername",'googleId',"googleId") ORDER BY id) FROM users;`
 const before=JSON.parse(sql(snapshot))
 sql(readFileSync(join(rt.root,'server/prisma/migrations/20261019000000_staff_credentials_security/migration.sql'),'utf8'))
 assert.deepEqual(JSON.parse(sql(snapshot)),before)
 assert.equal(sql(`SELECT count(*) FROM users WHERE "ownerRecoveryEnabled"`),'1')
 assert.equal(sql(`SELECT id FROM users WHERE "ownerRecoveryEnabled"`),'qa-old-owner')
 assert.equal(sql(`SELECT count(*) FROM users WHERE role<>'CUSTOMER' AND "mustChangePassword" AND "tokenVersion"=1`),'3')
 assert.equal(sql(`SELECT count(*) FROM users WHERE role='CUSTOMER' AND NOT "mustChangePassword" AND "tokenVersion"=0`),'1')
})
test('usuario obligatorio, cambio forzado de contraseña y revocación del acceso temporal',async()=>{
 for(const value of ['vendedor01',' VENDEdor01 ']){const r=await login(value);assert.equal(r.status,200);assert.equal(r.data.user.id,worker.id);workerToken=r.data.token}
 assert.equal((await login(owner.email)).status,401)
 assert.equal((await request('/api/pos/config',{token:workerToken})).status,403)
 assert.equal((await request('/api/auth/me',{token:workerToken})).status,200)
 assert.equal((await request('/api/auth/staff-change-password',{token:workerToken,body:{currentPassword:initial,newPassword:initial}})).status,400)
 assert.equal((await request('/api/auth/staff-change-password',{token:workerToken,body:{currentPassword:initial,newPassword:nextPassword}})).status,200)
 assert.equal((await request('/api/auth/me',{token:workerToken})).status,401)
 assert.equal((await login('vendedor01')).status,401)
 workerToken=(await login('vendedor01',nextPassword)).data.token
 assert.equal((await request('/api/pos/config',{token:workerToken})).status,200)
 assert.equal((await request('/api/admin/staff',{token:workerToken})).status,403)
 assert.equal((await request('/api/admin/inventory/summary',{token:workerToken})).status,200)
})
test('sin Google ni recuperación para trabajadores; clientes conservan recuperación',async()=>{
 assert.equal((await request('/api/auth/google?app=panel&challenge='+challenge(randomBytes(32).toString('base64url')),{token:null})).status,403)
 assert.equal((await request('/api/auth/staff-google/exchange',{token:null,body:{code:'irrelevante'}})).status,403)
 await rt.db.user.update({where:{id:worker.id},data:{email:'worker-legacy@example.test'}})
 const count=mail.length
 for(const email of ['worker-legacy@example.test','no-existe@example.test'])assert.equal((await request('/api/auth/forgot-password',{token:null,body:{email}})).status,202)
 await new Promise(r=>setTimeout(r,20));assert.equal(mail.length,count)
 assert.equal((await request('/api/auth/forgot-password',{token:null,body:{email:rt.customer.email}})).status,202)
 await new Promise(r=>setTimeout(r,20));assert.equal(mail.at(-1).to,rt.customer.email)
 const store=await request('/api/auth/login',{token:null,body:{email:owner.email,password:initial}});assert.equal(store.status,401)
})
test('restablecimiento administrativo no revela contraseñas y exige cambio nuevamente',async()=>{
 const reset=await request(`/api/admin/staff/${worker.id}/reset-password`,{body:{temporaryPassword:initial,reason:'Identidad verificada por titular'}})
 assert.equal(reset.status,200);assert.equal(reset.data.mustChangePassword,true)
 assert.equal((await request('/api/pos/config',{token:workerToken})).status,401)
 const temp=await login('vendedor01');assert.equal(temp.status,200)
 assert.equal((await request('/api/auth/staff-change-password',{token:temp.data.token,body:{currentPassword:initial,newPassword:nextPassword}})).status,200)
 workerToken=(await login('vendedor01',nextPassword)).data.token
})
test('suspender con caja abierta revoca todas las sesiones y conserva caja/historial',async()=>{
 const cash=await request('/api/pos/cash',{token:workerToken,body:{requestId:crypto.randomUUID(),openingAmount:'10.00'}});assert.equal(cash.status,200)
 const other=(await login('vendedor01',nextPassword)).data.token
 const suspend=await request('/api/admin/staff/'+worker.id,{method:'PATCH',body:{isSuspended:true,reason:'Baja de acceso solicitada'}});assert.equal(suspend.status,200)
 assert.equal((await request('/api/pos/config',{token:workerToken})).status,401);assert.equal((await request('/api/pos/config',{token:other})).status,401)
 assert.equal((await login('vendedor01',nextPassword)).status,401)
 assert.equal((await rt.db.cashSession.findUnique({where:{id:cash.data.id}})).status,'OPEN')
 assert.equal((await request('/api/admin/staff/'+worker.id,{method:'PATCH',body:{isSuspended:false,reason:'Reincorporación autorizada'}})).status,200)
 workerToken=(await login('vendedor01',nextPassword)).data.token
 assert.equal((await request('/api/admin/staff/'+worker.id,{method:'PATCH',body:{role:'WAREHOUSE',reason:'Reasignación de funciones'}})).status,409)
 assert.equal((await request(`/api/pos/cash/${cash.data.id}/close`,{token:workerToken,body:{requestId:crypto.randomUUID(),countedAmount:'10.00',reason:'Conciliación de turno QA'}})).status,200)
 assert.equal((await request('/api/admin/staff/'+worker.id,{method:'PATCH',body:{role:'WAREHOUSE',reason:'Reasignación de funciones'}})).status,200)
 workerToken=(await login('vendedor01',nextPassword)).data.token
 assert.equal((await request('/api/pos/config',{token:workerToken})).status,403)
 assert.equal((await request('/api/admin/inventory/summary',{token:workerToken})).status,200)
})
test('temporal caducada, sesiones inactivas y protección de administrador principal',async()=>{
 assert.equal((await request('/api/admin/staff/'+owner.id,{method:'PATCH',body:{isSuspended:true,reason:'No permitir perder titular'}})).status,409)
 await rt.db.user.update({where:{id:worker.id},data:{temporaryPasswordExpiresAt:new Date(Date.now()-1000)}})
 assert.equal((await login('vendedor01',nextPassword)).status,401)
 await rt.db.user.update({where:{id:worker.id},data:{temporaryPasswordExpiresAt:null}})
 const result=await login('vendedor01',nextPassword)
 const {verifyToken}=await rt.load('server/src/lib/token.js');const payload=verifyToken(result.data.token)
 await rt.db.staffSession.update({where:{tokenHash:hash(payload.sid)},data:{lastSeenAt:new Date(Date.now()-31*60000)}})
 assert.equal((await request('/api/auth/me',{token:result.data.token})).status,401)
})
test('conciliación administrativa de caja suspendida deja responsable, conteo y un único cierre',async()=>{
 await request('/api/admin/staff/'+worker.id,{method:'PATCH',body:{role:'CASHIER',reason:'Preparar conciliación QA'}})
 const cashier=(await login('vendedor01',nextPassword)).data.token
 const cash=await request('/api/pos/cash',{token:cashier,body:{requestId:crypto.randomUUID(),openingAmount:'25.00'}})
 await request('/api/admin/staff/'+worker.id,{method:'PATCH',body:{isSuspended:true,reason:'Salida de personal QA'}})
 const body={requestId:crypto.randomUUID(),countedAmount:'24.00',reason:'Conteo presencial de administrador QA'}
 const a=await request(`/api/pos/cash/${cash.data.id}/reconcile`,{body});assert.equal(a.status,200);assert.equal(String(a.data.difference),'-1')
 const b=await request(`/api/pos/cash/${cash.data.id}/reconcile`,{body});assert.equal(b.status,200);assert.equal(b.data.id,a.data.id)
 assert.equal(await rt.db.staffAuditEvent.count({where:{action:'CASH_RECONCILED_BY_ADMIN',subjectId:worker.id}}),1)
 assert.equal((await request(`/api/pos/cash/${cash.data.id}/reconcile`,{body:{...body,requestId:crypto.randomUUID()}})).status,409)
})
test('auditoría paginada inmutable y sin secretos; migraciones coinciden con Prisma',async()=>{
 const events=await request('/api/admin/staff/audit');assert.equal(events.status,200);assert.ok(events.data.items.length>0)
 assert.equal(JSON.stringify(events.data).includes(nextPassword),false)
 const event=events.data.items[0];await assert.rejects(rt.db.staffAuditEvent.delete({where:{id:event.id}}))
 const schema=join(rt.tempRoot,'schema/schema.prisma')
 try{const diff=runPrisma({root:rt.root,tempRoot:rt.tempRoot,schemaPath:schema,dotenvPath:join(rt.tempRoot,'qa-empty-dotenv'),databaseUrl:process.env.DATABASE_URL,args:['migrate','diff','--from-url',process.env.DATABASE_URL,'--to-schema-datamodel',schema,'--exit-code']});assert.match(diff,/No difference detected/)}catch(error){console.log(String(error.stdout||''));throw error}
})
test('recuperación exclusiva del titular conserva usuario y revoca sesiones anteriores',async()=>{
 const old=adminToken
 assert.equal((await request('/api/auth/forgot-password',{token:null,body:{email:owner.email}})).status,202)
 for(let i=0;i<20&&mail.at(-1)?.to!==owner.email;i++)await new Promise(r=>setTimeout(r,10))
 assert.equal(mail.at(-1).to,owner.email)
 assert.equal((await request('/api/auth/reset-password',{token:null,body:{email:owner.email,code:mail.at(-1).code,newPassword:initial}})).status,200)
 assert.equal((await request('/api/auth/me',{token:old})).status,401)
 adminToken=(await login('admin1234')).data.token
 assert.equal((await request('/api/admin/staff')).status,200)
})
test('Google comercial no vincula personal y mantiene acceso de clientes',async()=>{
 const {resolveGoogleUser}=await rt.load('server/src/lib/oauthService.js')
 await assert.rejects(resolveGoogleUser(rt.db,{sub:'qa-google-owner',email:owner.email,email_verified:true},{customersOnly:true}),{status:403})
 assert.equal((await rt.db.user.findUnique({where:{id:owner.id}})).googleId,null)
 const customer=await resolveGoogleUser(rt.db,{sub:'qa-google-customer',email:rt.customer.email,email_verified:true},{customersOnly:true})
 assert.equal(customer.id,rt.customer.id);assert.equal(customer.role,'CUSTOMER')
})
test('TOTP RFC 6238, alta real, desafío, códigos de respaldo de un uso y desactivación',async()=>{
 assert.equal(totp(base32(Buffer.from('12345678901234567890')),1),'287082')
 const setup=await request('/api/auth/staff-mfa/setup',{body:{currentPassword:initial}});assert.equal(setup.status,200)
 const step=Math.floor(Date.now()/30000),secret=setup.data.secret
 const enabled=await request('/api/auth/staff-mfa/enable',{body:{code:totp(secret,step)}});assert.equal(enabled.status,200);assert.equal(enabled.data.recoveryCodes.length,8)
 assert.equal((await request('/api/auth/me')).status,401)
 let attempt=await login('ADMIN1234');assert.equal(attempt.data.requiresMfa,true);assert.equal(attempt.data.token,undefined)
 const failed=await request('/api/auth/staff-mfa/login',{token:null,body:{challenge:attempt.data.challenge,code:'000000'}});assert.equal(failed.status,401)
 const accepted=await request('/api/auth/staff-mfa/login',{token:null,body:{challenge:attempt.data.challenge,code:totp(secret,step+1)}});assert.equal(accepted.status,200);adminToken=accepted.data.token
 assert.equal((await request('/api/auth/staff-mfa/login',{token:null,body:{challenge:attempt.data.challenge,code:totp(secret,step+1)}})).status,401)
 attempt=await login('ADMIN1234');const backup=enabled.data.recoveryCodes[0]
 assert.equal((await request('/api/auth/staff-mfa/login',{token:null,body:{challenge:attempt.data.challenge,code:backup}})).status,200)
 attempt=await login('ADMIN1234');assert.equal((await request('/api/auth/staff-mfa/login',{token:null,body:{challenge:attempt.data.challenge,code:backup}})).status,401)
 assert.equal((await request('/api/auth/staff-mfa/disable',{body:{currentPassword:initial,code:enabled.data.recoveryCodes[1]}})).status,200)
 adminToken=(await login('ADMIN1234')).data.token
 const user=await rt.db.user.findUnique({where:{id:owner.id}});assert.equal(user.mfaEnabled,false);assert.equal(user.mfaSecretEncrypted,null)
})
