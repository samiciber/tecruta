import React from 'react'
import { Wallet } from 'lucide-react'
import AccountShell from '../../components/account/AccountShell.jsx'
import ComingSoonPanel from '../../components/account/ComingSoonPanel.jsx'

export default function MyCard() {
  return (
    <AccountShell title="Mi tarjeta de crédito" description="Administra tu tarjeta TecRuta y sus beneficios." requireLogin>
      <ComingSoonPanel icon={Wallet} heading="La tarjeta TecRuta llegará pronto" text="Estamos preparando beneficios para quienes compran con nosotros. Te avisaremos aquí cuando esté disponible." features={['Solicitud en línea', 'Saldo y movimientos', 'Beneficios en tus compras']} />
    </AccountShell>
  )
}