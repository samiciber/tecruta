import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { createAuthMiddleware } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/errorHandler.js'
import { loginRateLimiter, authActionRateLimiter } from '../middleware/rateLimit.js'
import { validate } from '../middleware/validate.js'
import { normalizeAdminUsername } from '../lib/adminUsername.js'
import { AuthError, hash, randomSecret } from '../lib/authSecurity.js'
import { lockUser, version } from '../lib/authCodes.js'
import { serializeUser } from '../lib/serializers.js'
import { isStaff, panelSession, mfaChallenge, audit, revokeStaff, base32, encryptSecret, decryptSecret, acceptedStep, recoveryHash, verifyFactor } from '../lib/staffSecurity.js'

const credentials=z.object({identifier:z.string().trim().min(1).max(32),password:z.string().min(1).max(1024)}).strict()
const password=z.string().min(12,'Usa una contraseña de al menos 12 caracteres.').max(72).refine(value=>Buffer.byteLength(value,'utf8')<=72,'La contraseña no debe superar 72 bytes UTF-8.')
const change=z.object({currentPassword:z.string().min(1).max(1024),newPassword:password}).strict()
const factor=z.object({code:z.string().trim().min(6).max(80)}).strict()
const invalid={error:'Usuario o contraseña incorrectos, o acceso no autorizado.'}
export function createStaffAuthRouter({db=prisma}={}) {
 const router=Router(),{requireAuth}=createAuthMiddleware({db}),dummy=bcrypt.hash(randomSecret(),12)
 router.use((_req,res,next)=>{res.set('Cache-Control','no-store').set('Referrer-Policy','no-referrer');next()})
 const panelOnly=(req,res,next)=>{if(!isStaff(req.user)||req.authChannel!=='panel')return res.status(403).json({error:'Inicia sesión con tu usuario del panel.'});next()}
 router.post('/staff-login',loginRateLimiter,validate(credentials),asyncHandler(async(req,res)=>{
   let alias;try{alias=normalizeAdminUsername(req.body.identifier)}catch{}
   const found=alias?await db.user.findUnique({where:{adminUsername:alias}}):null
   const matches=await bcrypt.compare(req.body.password,found?.passwordHash??await dummy)
   if(!found||!matches||!isStaff(found)||!found.verified||found.isSuspended||found.temporaryPasswordExpiresAt&&found.temporaryPasswordExpiresAt<=new Date())return res.status(401).json(invalid)
   const result=await db.$transaction(async tx=>{
     const user=await lockUser(tx,found.id)
     if(user.isSuspended||!isStaff(user)||version(user)!==version(found))throw new AuthError(401,invalid.error)
     if(user.mfaEnabled)return {requiresMfa:true,challenge:await mfaChallenge(tx,user)}
     await audit(tx,user.id,'STAFF_LOGIN',user.id)
     return {token:await panelSession(tx,user),user:serializeUser(user)}
   })
   res.json(result)
 }))
 router.post('/staff-mfa/login',loginRateLimiter,validate(z.object({challenge:z.string().regex(/^[A-Za-z0-9_-]{43}$/),code:z.string().trim().min(6).max(80)}).strict()),asyncHandler(async(req,res)=>{
   const result=await db.$transaction(async tx=>{
     const initialProof=await tx.staffLoginChallenge.findUnique({where:{tokenHash:hash(req.body.challenge)}})
     if(!initialProof)return null
     const user=await lockUser(tx,initialProof.userId)
     await tx.$queryRaw`SELECT id FROM staff_login_challenges WHERE "tokenHash"=${hash(req.body.challenge)} FOR UPDATE`
     const proof=await tx.staffLoginChallenge.findUnique({where:{tokenHash:hash(req.body.challenge)}})
     if(!proof||proof.expiresAt<=new Date()||proof.attempts>=5)return null
     if(!user||user.isSuspended||!isStaff(user)||!user.mfaEnabled||version(user)!==proof.tokenVersion)return null
     const accepted=verifyFactor(user,req.body.code)
     if(!accepted){await tx.staffLoginChallenge.update({where:{id:proof.id},data:{attempts:{increment:1}}});return null}
     await tx.user.update({where:{id:user.id},data:accepted});await tx.staffLoginChallenge.delete({where:{id:proof.id}})
     await audit(tx,user.id,'STAFF_LOGIN_MFA',user.id)
     return {token:await panelSession(tx,user),user:serializeUser(user)}
   })
   if(!result)return res.status(401).json({error:'El código no es válido o el acceso venció. Inicia nuevamente.'})
   res.json(result)
 }))
 router.post('/staff-change-password',requireAuth,panelOnly,loginRateLimiter,validate(change),asyncHandler(async(req,res)=>{
   if(req.body.currentPassword===req.body.newPassword)throw new AuthError(400,'La nueva contraseña debe ser diferente.')
   const passwordHash=await bcrypt.hash(req.body.newPassword,12)
   await db.$transaction(async tx=>{
     const user=await lockUser(tx,req.user.id)
     if(version(user)!==version(req.user)||!await bcrypt.compare(req.body.currentPassword,user.passwordHash))throw new AuthError(400,'La contraseña actual no es correcta o tu sesión cambió.')
     await revokeStaff(tx,user,{passwordHash,mustChangePassword:false,temporaryPasswordExpiresAt:null,resetCode:null,resetCodeHash:null,resetCodeExpiresAt:null})
     await audit(tx,user.id,'STAFF_PASSWORD_CHANGED',user.id)
   })
   res.json({ok:true,reauthenticate:true})
 }))
 router.post('/staff-mfa/setup',requireAuth,panelOnly,authActionRateLimiter,validate(z.object({currentPassword:z.string().min(1).max(1024)}).strict()),asyncHandler(async(req,res)=>{
   const secret=base32(randomBytes(20))
   await db.$transaction(async tx=>{
     const user=await lockUser(tx,req.user.id)
     if(user.role!=='ADMIN'||!user.ownerRecoveryEnabled||user.mfaEnabled)throw new AuthError(403,'Esta configuración corresponde al administrador principal sin segundo factor activo.')
     if(version(user)!==version(req.user)||!await bcrypt.compare(req.body.currentPassword,user.passwordHash))throw new AuthError(400,'La contraseña no es correcta.')
     await tx.user.update({where:{id:user.id},data:{mfaPendingSecretEncrypted:encryptSecret(secret)}})
     await audit(tx,user.id,'MFA_SETUP_STARTED',user.id)
   })
   res.json({secret,uri:`otpauth://totp/${encodeURIComponent('TecRuta:'+req.user.adminUsername)}?secret=${secret}&issuer=TecRuta&algorithm=SHA1&digits=6&period=30`})
 }))
 router.post('/staff-mfa/enable',requireAuth,panelOnly,loginRateLimiter,validate(factor),asyncHandler(async(req,res)=>{
   const codes=Array.from({length:8},()=>randomBytes(8).toString('hex'))
   await db.$transaction(async tx=>{
     const user=await lockUser(tx,req.user.id)
     if(version(user)!==version(req.user)||!user.ownerRecoveryEnabled||!user.mfaPendingSecretEncrypted||user.mfaEnabled)throw new AuthError(409,'Inicia primero la configuración del segundo factor.')
     const step=acceptedStep(decryptSecret(user.mfaPendingSecretEncrypted),req.body.code)
     if(step===null)throw new AuthError(400,'El código no es válido.')
     await revokeStaff(tx,user,{mfaEnabled:true,mfaSecretEncrypted:user.mfaPendingSecretEncrypted,mfaPendingSecretEncrypted:null,mfaLastStep:step,mfaRecoveryHashes:codes.map(recoveryHash)})
     await audit(tx,user.id,'MFA_ENABLED',user.id)
   })
   res.json({recoveryCodes:codes,reauthenticate:true})
 }))
 router.post('/staff-mfa/disable',requireAuth,panelOnly,loginRateLimiter,validate(z.object({currentPassword:z.string().min(1).max(1024),code:z.string().trim().min(6).max(80)}).strict()),asyncHandler(async(req,res)=>{
   await db.$transaction(async tx=>{
     const user=await lockUser(tx,req.user.id)
     if(version(user)!==version(req.user)||!user.mfaEnabled||!await bcrypt.compare(req.body.currentPassword,user.passwordHash)||!verifyFactor(user,req.body.code))throw new AuthError(400,'Credenciales o código no válidos.')
     await revokeStaff(tx,user,{mfaEnabled:false,mfaSecretEncrypted:null,mfaPendingSecretEncrypted:null,mfaLastStep:null,mfaRecoveryHashes:[]})
     await audit(tx,user.id,'MFA_DISABLED',user.id)
   })
   res.json({ok:true,reauthenticate:true})
 }))
 return router
}
export const staffAuthRouter=createStaffAuthRouter()
