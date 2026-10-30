import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { createAuthMiddleware, requireRole } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/errorHandler.js'
import { authActionRateLimiter } from '../middleware/rateLimit.js'
import { validate } from '../middleware/validate.js'
import { lockUser, version } from '../lib/authCodes.js'
import { AuthError, randomSecret } from '../lib/authSecurity.js'
import { normalizeAdminUsername } from '../lib/adminUsername.js'
import { audit, revokeStaff, STAFF_ROLES } from '../lib/staffSecurity.js'
import { isStrongStaffPassword, STAFF_PASSWORD_HELP } from '../../../src/utils/staffPassword.js'

const profile = z.enum(['ADMIN','CASHIER','WAREHOUSE'])
const username = z.string().trim().min(4).max(32).refine(value => { try { normalizeAdminUsername(value); return true } catch { return false } }, 'Usuario no válido.')
const assignedPassword = z.string().refine(isStrongStaffPassword, STAFF_PASSWORD_HELP)
// Accept the former field during an API-first rollout. Both names together
// are rejected, so there is exactly one unambiguous credential per request.
const credentialFields = { password: assignedPassword.optional(), temporaryPassword: assignedPassword.optional() }
const onePassword = value => (value.password !== undefined) !== (value.temporaryPassword !== undefined)
const creation = z.object({ username, nombre: z.string().trim().min(1).max(100), apellido: z.string().trim().min(1).max(100), role: profile, ...credentialFields }).strict().refine(onePassword, 'Indica una sola contraseña asignada.').refine(value => (value.password ?? value.temporaryPassword)?.toLowerCase() !== value.username.toLowerCase(), 'La contraseña debe ser diferente del usuario.')
const change = z.object({ username: username.optional(), role: profile.optional(), isSuspended: z.boolean().optional(), reason: z.string().trim().min(5).max(500) }).strict().refine(data => ['username','role','isSuspended'].some(key => data[key] !== undefined),'Indica un cambio.')
const reset = z.object({ ...credentialFields, reason: z.string().trim().min(5).max(500) }).strict().refine(onePassword, 'Indica una sola contraseña asignada.')
const publicStaff = user => ({ id:user.id, username:user.adminUsername, nombre:user.nombre, apellido:user.apellido, role:user.role, isSuspended:user.isSuspended, mustChangePassword:user.mustChangePassword, temporaryPasswordExpiresAt:user.temporaryPasswordExpiresAt, ownerRecoveryEnabled:user.ownerRecoveryEnabled, mfaEnabled:user.mfaEnabled })
export function createStaffRouter({ db = prisma } = {}) {
  const router = Router(), { requireAuth } = createAuthMiddleware({db})
  router.use(requireAuth, requireRole('ADMIN'))
  router.use((_req,res,next) => { res.set('Cache-Control','no-store'); next() })
  async function actor(tx, requestUser) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('tecruta:staff-access',0))`
    const fresh = await lockUser(tx,requestUser.id)
    if (!fresh || fresh.role !== 'ADMIN' || fresh.isSuspended || fresh.mustChangePassword || version(fresh) !== version(requestUser)) throw new AuthError(403,'Tu autorización cambió. Inicia sesión nuevamente.')
  }
  router.get('/',asyncHandler(async (_req,res) => res.json((await db.user.findMany({where:{role:{in:STAFF_ROLES}},orderBy:{createdAt:'desc'}})).map(publicStaff))))
  router.get('/audit',asyncHandler(async (req,res) => {
    const page = Math.max(1, Math.min(10000, Number(req.query.page)||1))
    const action = typeof req.query.action === 'string' ? req.query.action.slice(0,80) : ''
    const where = action ? {action} : {}
    const [items,total] = await Promise.all([db.staffAuditEvent.findMany({where,orderBy:[{createdAt:'desc'},{id:'desc'}],take:50,skip:(page-1)*50,include:{actor:{select:{nombre:true,apellido:true,adminUsername:true}}}}),db.staffAuditEvent.count({where})])
    res.json({items,total,page})
  }))
  router.post('/',authActionRateLimiter,validate(creation),asyncHandler(async (req,res) => {
    const alias=normalizeAdminUsername(req.body.username),passwordHash=await bcrypt.hash(req.body.password ?? req.body.temporaryPassword,12)
    const user=await db.$transaction(async tx => {
      await actor(tx,req.user)
      if(await tx.user.findUnique({where:{adminUsername:alias}}))throw new AuthError(409,'Ese usuario ya está asignado.')
      const created=await tx.user.create({data:{adminUsername:alias,email:null,nombre:req.body.nombre,apellido:req.body.apellido,role:req.body.role,passwordHash,verified:true,mustChangePassword:false,temporaryPasswordExpiresAt:null}})
      await audit(tx,req.user.id,'STAFF_CREATED',created.id,{username:alias,role:created.role,credentialPolicy:'ADMIN_ASSIGNED'})
      return created
    })
    res.status(201).json(publicStaff(user))
  }))
  router.patch('/:id',authActionRateLimiter,validate(change),asyncHandler(async (req,res) => {
    if(req.params.id===req.user.id)throw new AuthError(409,'Otro administrador debe cambiar tu acceso; no puedes suspenderte ni modificar tu propio perfil de permisos.')
    const user=await db.$transaction(async tx => {
      await actor(tx,req.user)
      const target=await lockUser(tx,req.params.id)
      if(!target||!STAFF_ROLES.includes(target.role))throw new AuthError(404,'Trabajador no encontrado.')
      // The primary recovery administrator cannot be demoted or suspended accidentally.
      if(target.ownerRecoveryEnabled && (req.body.isSuspended===true || req.body.role && req.body.role!=='ADMIN'))throw new AuthError(409,'Conserva activo al administrador principal de recuperación.')
      if(req.body.role && req.body.role!==target.role && await tx.cashSession.count({where:{userId:target.id,status:'OPEN'}}))throw new AuthError(409,'El trabajador debe cerrar su caja antes de cambiar de rol. Puedes suspender el acceso inmediatamente.')
      const data={}
      if(req.body.username!==undefined)data.adminUsername=normalizeAdminUsername(req.body.username)
      if(req.body.role!==undefined)data.role=req.body.role
      if(req.body.isSuspended!==undefined)data.isSuspended=req.body.isSuspended
      const updated=await revokeStaff(tx,target,data)
      await audit(tx,req.user.id,'STAFF_ACCESS_CHANGED',target.id,{reason:req.body.reason,before:{role:target.role,isSuspended:target.isSuspended,username:target.adminUsername},after:{role:updated.role,isSuspended:updated.isSuspended,username:updated.adminUsername},openCashPreserved:target.isSuspended!==updated.isSuspended})
      return updated
    })
    res.json(publicStaff(user))
  }))
  router.post('/:id/reset-password',authActionRateLimiter,validate(reset),asyncHandler(async(req,res)=>{
    if(req.params.id===req.user.id)throw new AuthError(409,'Otro administrador debe restablecer tu contraseña. El administrador principal conserva su recuperación.')
    const passwordHash=await bcrypt.hash(req.body.password ?? req.body.temporaryPassword,12)
    const user=await db.$transaction(async tx=>{
      await actor(tx,req.user)
      const target=await lockUser(tx,req.params.id)
      if(!target||!STAFF_ROLES.includes(target.role))throw new AuthError(404,'Trabajador no encontrado.')
      const assigned=req.body.password ?? req.body.temporaryPassword
      if(assigned.toLowerCase()===target.adminUsername?.toLowerCase()||await bcrypt.compare(assigned,target.passwordHash))throw new AuthError(400,'Usa una contraseña nueva, diferente de la anterior y del usuario.')
      const updated=await revokeStaff(tx,target,{passwordHash,mustChangePassword:false,temporaryPasswordExpiresAt:null,resetCode:null,resetCodeHash:null,resetCodeExpiresAt:null,resetCodeAttempts:0,resetCodeLockedUntil:null,mfaPendingSecretEncrypted:null})
      await audit(tx,req.user.id,'STAFF_PASSWORD_RESET',target.id,{reason:req.body.reason,credentialPolicy:'ADMIN_ASSIGNED'})
      return updated
    })
    res.json(publicStaff(user))
  }))
  router.post('/:id/revoke-sessions',authActionRateLimiter,asyncHandler(async(req,res)=>{
    await db.$transaction(async tx=>{await actor(tx,req.user);const target=await lockUser(tx,req.params.id);if(!target||!STAFF_ROLES.includes(target.role))throw new AuthError(404,'Trabajador no encontrado.');await revokeStaff(tx,target);await audit(tx,req.user.id,'STAFF_SESSIONS_REVOKED',target.id)})
    res.json({ok:true})
  }))
  // No legacy mail-invitation or generic role-assignment route remains here.
  return router
}
export const staffRouter=createStaffRouter()
