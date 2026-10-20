import React, { useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.js'
import AuthCard from '../../components/auth/AuthCard.jsx'
import PasswordInput from '../../components/auth/PasswordInput.jsx'
import SessionUnavailable from '../../components/auth/SessionUnavailable.jsx'
import { safePanelReturn, staffHome, STAFF_ROLES, STORE_ORIGIN } from '../../app/urls.js'

export default function PanelLogin(){
 const auth=useAuth(),[params]=useSearchParams(),[form,setForm]=useState({identifier:'',password:'',remember:false})
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[proof,setProof]=useState(null),[code,setCode]=useState('')
 if(auth.authError)return <SessionUnavailable onRetry={auth.retrySession}/>
 if(auth.authLoading)return <p role="status" className="p-10">Comprobando sesión…</p>
 if(auth.user&&STAFF_ROLES.includes(auth.user.role))return <Navigate to={auth.user.mustChangePassword?'/seguridad?obligatorio=1':safePanelReturn(params.get('volver'),staffHome(auth.user.role))} replace/>
 async function submit(event){event.preventDefault();if(busy)return;setBusy(true);setError('');const result=proof?await auth.completeStaffMfa(proof,code,form.remember):await auth.login(form);if(!result.ok)setError(result.error);else if(result.requiresMfa){setProof(result.challenge);setForm({...form,password:''})}setBusy(false)}
 return <AuthCard title="Panel TecRuta" subtitle="Acceso exclusivo del personal autorizado." footer={<a href={STORE_ORIGIN} className="text-sm text-route underline">Ir a la tienda pública ↗</a>}>
 {auth.user?<><p role="alert">Acceso denegado. Tu cuenta no tiene permisos para este panel.</p><button className="btn-primary mt-4" onClick={auth.logout}>Usar otra cuenta</button></>:<form onSubmit={submit} className="space-y-4">
 {error&&<p role="alert" className="text-sm text-signal-red">{error}</p>}
 {proof?<><label className="block text-sm">Código de la aplicación o código de respaldo<input required autoComplete="one-time-code" maxLength={80} className="input-tr mt-1 w-full" value={code} onChange={e=>setCode(e.target.value)}/></label><p className="text-sm">Introduce un código de tu aplicación autenticadora o uno de tus códigos de respaldo de un solo uso.</p><button type="button" className="text-route underline" onClick={()=>{setProof(null);setCode('');setError('')}}>Volver al usuario y contraseña</button></>:<>
 <label className="block text-sm">Usuario<input required autoCapitalize="none" spellCheck={false} autoComplete="username" maxLength={32} className="input-tr mt-1 w-full" value={form.identifier} onChange={e=>setForm({...form,identifier:e.target.value})}/></label>
 <label className="block text-sm">Contraseña<PasswordInput autoComplete="current-password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></label>
 <p className="text-xs">La sesión se conserva en esta pestaña.</p></>}
 <button disabled={busy} className="btn-primary w-full">{busy?'Ingresando…':proof?'Verificar código':'Ingresar al panel'}</button>
 <p className="text-sm text-ink-soft dark:text-paper/70">¿Olvidaste tu contraseña? Contacta a tu administrador para restablecer tu acceso.</p>
 <Link className="block text-xs text-route underline" to="/recuperar-contrasena">Recuperación del administrador principal</Link>
 </form>}</AuthCard>
}
