import { orderEmailsEnabled, processOrderEmails } from '../src/lib/orderEmails.js'
if (!orderEmailsEnabled()) {
  console.log(JSON.stringify({ enabled: false, sent: 0 }))
} else {
  const { PrismaClient } = await import('@prisma/client')
  const db = new PrismaClient()
  try { console.log(JSON.stringify(await processOrderEmails({ db }))) }
  finally { await db.$disconnect() }
}
