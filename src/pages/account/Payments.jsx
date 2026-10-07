import React from 'react'
import { CreditCard } from 'lucide-react'
import AccountShell from '../../components/account/AccountShell.jsx'
import ComingSoonPanel from '../../components/account/ComingSoonPanel.jsx'

export default function Payments() {
  return (
    <AccountShell title="Pagos" description="Tus métodos de pago guardados para comprar más rápido." requireLogin>
      <ComingSoonPanel icon={CreditCard} heading="Aún no tienes pagos guardados" text="Pronto podrás guardar tus métodos de pago y ver tu historial. Por ahora, el pago se coordina por WhatsApp al finalizar tu pedido." features={['Métodos de pago guardados', 'Historial de pagos', 'Pago en un paso']} />
    </AccountShell>
  )
}