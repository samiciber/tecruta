// Deliberately does not load dotenv. Disabled means no DB connection or email.
if (process.env.REVIEW_INVITATIONS_ENABLED !== 'true') {
  console.log('Invitaciones desactivadas. No se envió ningún correo.')
} else {
  const { prisma } = await import('../src/lib/prisma.js')
  const { runReviewInvitations } = await import('../src/lib/reviewInvitations.js')
  try { const result = await runReviewInvitations({db:prisma}); console.log(`Invitaciones enviadas: ${result.sent}`) }
  catch { console.error('No se completaron las invitaciones. Revisa configuración y proveedor; no se muestran destinatarios ni secretos.'); process.exitCode=1 }
  finally { await prisma.$disconnect() }
}
