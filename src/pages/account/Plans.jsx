import React from 'react'
import { ShieldCheck } from 'lucide-react'
import AccountShell from '../../components/account/AccountShell.jsx'
import ComingSoonPanel from '../../components/account/ComingSoonPanel.jsx'

export default function Plans() {
  return (
    <AccountShell title="Planes y suscripciones" description="Protección, membresías y suscripciones de tus productos." requireLogin>
      <ComingSoonPanel icon={ShieldCheck} heading="No tienes planes activos" text="Pronto podrás contratar planes de protección y membresías desde aquí." features={['Planes de protección', 'Membresía TecRuta', 'Renovaciones y facturación']} />
    </AccountShell>
  )
}