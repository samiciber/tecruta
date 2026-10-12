import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ShoppingBag, Truck, Pencil } from 'lucide-react'
import EmptyState from '../components/ui/EmptyState.jsx'
import CheckoutSection from '../components/checkout/CheckoutSection.jsx'
import CustomerForm from '../components/checkout/CustomerForm.jsx'
import DeliveryForm from '../components/checkout/DeliveryForm.jsx'
import PaymentMethodSelector from '../components/checkout/PaymentMethodSelector.jsx'
import ReceiptUpload from '../components/checkout/ReceiptUpload.jsx'
import WhatsAppButton from '../components/checkout/WhatsAppButton.jsx'
import TrustBadges from '../components/checkout/TrustBadges.jsx'
import FreeShippingBar from '../components/cart/FreeShippingBar.jsx'
import { useCart } from '../hooks/useCart.js'
import { useAuth } from '../hooks/useAuth.js'
import { usePaymentMethods } from '../hooks/usePaymentMethods.js'
import { api } from '../services/api.js'
import { loadAttempt, saveAttempt, forgetAttempt, submitAttempt, definitelyNotCreated } from '../services/checkoutOrder.js'
import { buildConfirmedWhatsAppLink } from '../utils/whatsapp.js'
import { formatCurrency } from '../utils/formatCurrency.js'
import { storeConfig } from '../config/storeConfig.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export default function Checkout() {
  const { items, subtotal, itemCount, clearCart } = useCart()
  const { user, token, authLoading } = useAuth()
  const { methods: paymentMethods, getMethodByKey } = usePaymentMethods()

  const [attempt, setAttempt] = useState(() => loadAttempt(window.sessionStorage))
  const [submitting, setSubmitting] = useState(false)
  const busy = useRef(false)
  const receiptBusy = useRef(false)
  const confirmationHeading = useRef(null)
  const [confirmedOrder, setConfirmedOrder] = useState(null)
  const [orderError, setOrderError] = useState('')
  const [receiptError, setReceiptError] = useState('')
  const [receiptUploading, setReceiptUploading] = useState(false)
  const [activeStep, setActiveStep] = useState(attempt ? 3 : 1)
  const [customer, setCustomer] = useState({
    nombre: user?.nombre || '',
    apellido: user?.apellido || '',
    correo: user?.email || '',
    celular: '',
    ...attempt?.payload.customer,
  })
  const [delivery, setDelivery] = useState({
    tipoEntrega: 'envio',
    departamento: '',
    provincia: '',
    distrito: '',
    direccion: '',
    numero: '',
    interior: '',
    referencia: '',
    quiereComprobante: false,
    documento: '',
    otraPersona: false,
    personaNombre: '',
    personaCelular: '',
    aceptaTerminos: false,
    ...attempt?.payload.delivery,
  })
  const [paymentMethod, setPaymentMethod] = useState(attempt?.payload.paymentMethod ?? null)
  const [savedAddresses, setSavedAddresses] = useState([])
  const [selectedAddressId, setSelectedAddressId] = useState(null)
  const [saveNewAddress, setSaveNewAddress] = useState(false)
  const [receipt, setReceipt] = useState(null)

  useEffect(() => { confirmationHeading.current?.focus() }, [confirmedOrder?.id])

  // La sesión ahora se restaura de forma asíncrona (contra la API), así
  // que "user" puede llegar después del primer render (por ejemplo, si el
  // cliente entra directo a /checkout con una sesión ya iniciada). Cuando
  // eso pasa, completamos los campos vacíos del formulario — pero nunca
  // pisamos algo que el cliente ya haya escrito a mano.
  useEffect(() => {
    if (!user) return
    setCustomer((c) => ({
      nombre: c.nombre || user.nombre || '',
      apellido: c.apellido || user.apellido || '',
      correo: c.correo || user.email || '',
      celular: c.celular,
    }))
  }, [user])

  // Carga las direcciones guardadas del cliente (si tiene sesión) para
  // ofrecerlas como acceso rápido en el paso de entrega, en vez de
  // obligarlo a escribir todo de nuevo.
  useEffect(() => {
    if (!user || !token) {
      setSavedAddresses([])
      return
    }
    api.addresses
      .list(token)
      .then((addresses) => {
        setSavedAddresses(addresses)
        // Si el cliente todavía no completó nada de la dirección, se la
        // precargamos con su predeterminada (si tiene una).
        const defaultAddress = addresses.find((a) => a.isDefault)
        if (defaultAddress && !delivery.departamento) {
          applySavedAddress(defaultAddress)
        }
      })
      .catch((err) => console.warn('No se pudieron cargar las direcciones guardadas:', err.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, token])

  function applySavedAddress(address) {
    setDelivery((prev) => ({
      ...prev,
      departamento: address.departamento,
      provincia: address.provincia,
      distrito: address.distrito,
      direccion: address.direccion || '',
      numero: address.numero || '',
      interior: address.interior || '',
      referencia: address.referencia || '',
    }))
    setSelectedAddressId(address.id)
    setSaveNewAddress(false)
  }

  function handleUseNewAddress() {
    setDelivery((prev) => ({
      ...prev,
      departamento: '',
      provincia: '',
      distrito: '',
      direccion: '',
      numero: '',
      interior: '',
      referencia: '',
    }))
    setSelectedAddressId(null)
  }

  function handleContinueToPayment() {
    // Si el cliente marcó "guardar esta dirección" y escribió una nueva
    // (no eligió una ya guardada), la guardamos en paralelo — nunca
    // bloquea el avance al siguiente paso ni el checkout si falla.
    if (saveNewAddress && !selectedAddressId && user && token) {
      api.addresses
        .create(
          {
            departamento: delivery.departamento,
            provincia: delivery.provincia,
            distrito: delivery.distrito,
            direccion: delivery.direccion,
            numero: delivery.numero,
            interior: delivery.interior,
            referencia: delivery.referencia,
            isDefault: savedAddresses.length === 0,
          },
          token,
        )
        .catch((err) => console.warn('No se pudo guardar la dirección:', err.message))
    }
    setActiveStep(3)
  }

  async function uploadConfirmedReceipt(order) {
    if (!receipt || receiptBusy.current) return
    receiptBusy.current = true
    setReceiptUploading(true)
    setReceiptError('')
    try {
      const file = await fileToDataUrl(receipt)
      const result = await api.orders.uploadReceipt(order.id, file, {
        token: order.receiptToken ? undefined : token, receiptToken: order.receiptToken,
      })
      setConfirmedOrder(prev => ({ ...prev, receiptUrl: result.receiptUrl }))
    } catch (error) {
      setReceiptError(error.message || 'No pudimos subir el comprobante.')
    } finally { receiptBusy.current = false; setReceiptUploading(false) }
  }

  async function handleConfirm() {
    if (busy.current || authLoading) return
    const principal = user?.id ?? 'guest'
    if (attempt && attempt.principal !== principal) {
      setOrderError('Este intento pertenece a otra sesión. Vuelve a esa sesión para comprobarlo antes de crear otro pedido.')
      return
    }
    busy.current = true
    setSubmitting(true)
    setOrderError('')
    try {
      const current = attempt ?? saveAttempt(window.sessionStorage, {
        customer, delivery, paymentMethod,
        items: items.map(item => ({ productId: item.id, quantity: item.quantity })),
      }, principal)
      setAttempt(current)
      const order = await submitAttempt(current, api.orders.create, token)
      setConfirmedOrder(order)
      if (order.status !== 'CANCELLED') clearCart()
      try { forgetAttempt(window.sessionStorage) } catch {}
      setAttempt(null)
      if (receipt && order.status !== 'CANCELLED') void uploadConfirmedReceipt(order)
    } catch (error) {
      setOrderError(error.message || 'No pudimos confirmar el pedido. Reintenta para comprobar el mismo intento.')
      if (definitelyNotCreated(error, { retry: Boolean(attempt) })) {
        try { forgetAttempt(window.sessionStorage) } catch {}
        setAttempt(null)
      }
    } finally {
      busy.current = false
      setSubmitting(false)
    }
  }

  if (confirmedOrder) {
    return (
      <div className="container-tr py-8">
        <div className="mx-auto flex max-w-2xl min-w-0 flex-col gap-4 rounded-xl2 border border-paper-line p-5 dark:border-night-line" role="status">
          <h1 ref={confirmationHeading} tabIndex={-1} className="font-display text-2xl font-bold text-ink dark:text-paper">{confirmedOrder.status === 'CANCELLED' ? 'Pedido cancelado' : 'Pedido registrado'}</h1>
          <p className="break-all text-sm text-ink-soft dark:text-paper/60">Pedido: {confirmedOrder.id}</p>
          <ul className="space-y-3">
            {confirmedOrder.items.map(item => (
              <li key={item.id} className="flex min-w-0 flex-wrap justify-between gap-2 text-sm text-ink dark:text-paper">
                <span className="min-w-0 flex-1 break-words">{item.quantity}x {item.name}</span>
                <span className="shrink-0 font-mono">{formatCurrency(item.unitPrice * item.quantity)}</span>
              </li>
            ))}
          </ul>
          <p className="text-lg font-semibold text-ink dark:text-paper">Total confirmado: {formatCurrency(confirmedOrder.total)}</p>
          <p className="text-sm text-ink-soft dark:text-paper/60">El costo de envío y la confirmación del pago se coordinan por WhatsApp.</p>
          {receiptUploading && <p>Subiendo comprobante…</p>}
          {confirmedOrder.receiptUrl && <p className="text-sm text-ink dark:text-paper">Comprobante adjuntado.</p>}
          {receiptError && <div className="space-y-2" role="alert">
            <p className="text-sm text-ink dark:text-paper">{receiptError} Tu pedido ya está registrado.</p>
            <button type="button" className="btn-primary" disabled={receiptUploading} onClick={() => uploadConfirmedReceipt(confirmedOrder)}>Reintentar comprobante</button>
          </div>}
          {confirmedOrder.status !== 'CANCELLED' && <fieldset className="min-w-0" disabled={receiptUploading}><ReceiptUpload file={receipt} onChange={setReceipt} /></fieldset>}
          {receipt && !receiptError && confirmedOrder.status !== 'CANCELLED' && <button type="button" className="btn-primary" disabled={receiptUploading} onClick={() => uploadConfirmedReceipt(confirmedOrder)}>{confirmedOrder.receiptUrl ? 'Reemplazar comprobante' : 'Adjuntar comprobante'}</button>}
          {confirmedOrder.status !== 'CANCELLED'
            ? <a href={buildConfirmedWhatsAppLink(confirmedOrder)} target="_blank" rel="noopener noreferrer" className="btn-primary text-center">Continuar por WhatsApp</a>
            : <Link to="/carrito" className="btn-primary text-center">Revisar carrito</Link>}
          <Link to="/catalogo" className="text-center text-sm font-medium text-route hover:underline">Seguir comprando</Link>
        </div>
      </div>
    )
  }

  if (items.length === 0 && !attempt) {
    return (
      <div className="container-tr py-16">
        <EmptyState
          icon={ShoppingBag}
          title="Tu carrito está vacío"
          description="Agrega productos al carrito antes de continuar con el checkout."
          action={
            <Link to="/catalogo" className="btn-primary mt-2">
              Ver catálogo
            </Link>
          }
        />
      </div>
    )
  }

  const step1Valid = Boolean(
    customer.nombre.trim() && customer.apellido.trim() && EMAIL_RE.test(customer.correo.trim()) && customer.celular.trim(),
  )
  const step2Valid = Boolean(
    delivery.departamento &&
      delivery.provincia &&
      delivery.distrito &&
      (delivery.tipoEntrega === 'recojo' || (delivery.direccion.trim() && delivery.numero.trim())) &&
      delivery.aceptaTerminos,
  )
  const step3Valid = Boolean(paymentMethod)

  const statusFor = (step, valid) => {
    if (activeStep === step) return 'active'
    if (step < activeStep && valid) return 'done'
    return 'upcoming'
  }

  const paymentMethodLabel = paymentMethod ? getMethodByKey(paymentMethod)?.label : undefined
  const savings = items.reduce((sum, item) => {
    if (!item.compareAtPrice || item.compareAtPrice <= item.price) return sum
    return sum + (item.compareAtPrice - item.price) * item.quantity
  }, 0)

  return (
    <div className="container-tr py-8">
      <h1 className="mb-8 font-display text-2xl font-bold text-ink dark:text-paper sm:text-3xl">Checkout</h1>

      {attempt && <p role="status" className="mb-4 text-sm text-ink dark:text-paper">Hay un intento pendiente. Reintentar comprobará ese mismo pedido; sus datos permanecen bloqueados hasta confirmar el resultado.</p>}
      {orderError && <p role="alert" className="mb-4 break-words text-sm text-ink dark:text-paper">{orderError}</p>}
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-4">
          <CheckoutSection
            step={1}
            title="Datos de cliente"
            status={statusFor(1, step1Valid)}
            onEdit={attempt || submitting ? undefined : () => setActiveStep(1)}
            summary={
              <>
                <p className="text-sm font-medium text-ink dark:text-paper">
                  {customer.nombre} {customer.apellido}
                </p>
                <p className="text-sm text-ink-soft dark:text-paper/60">{customer.correo}</p>
                <p className="text-sm text-ink-soft dark:text-paper/60">{customer.celular}</p>
              </>
            }
          >
            <fieldset className="min-w-0" disabled={Boolean(attempt) || submitting}>
            <CustomerForm data={customer} onChange={setCustomer} />
            <button
              type="button"
              disabled={!step1Valid}
              onClick={() => setActiveStep(2)}
              className="btn-primary mt-4 w-full sm:w-auto"
            >
              Continuar
            </button>
            </fieldset>
          </CheckoutSection>

          <CheckoutSection
            step={2}
            title="Dirección de entrega"
            status={statusFor(2, step2Valid)}
            onEdit={attempt || submitting ? undefined : () => setActiveStep(2)}
            summary={
              <>
                <p className="text-sm font-medium text-ink dark:text-paper">
                  {delivery.tipoEntrega === 'recojo' ? 'Punto de recojo' : 'Envío a domicilio'}
                </p>
                <p className="text-sm text-ink-soft dark:text-paper/60">
                  {[delivery.distrito, delivery.provincia, delivery.departamento].filter(Boolean).join(', ')}
                </p>
                {delivery.tipoEntrega !== 'recojo' && (
                  <p className="text-sm text-ink-soft dark:text-paper/60">
                    {[delivery.direccion, delivery.numero].filter(Boolean).join(' ')}
                  </p>
                )}
              </>
            }
          >
            <fieldset className="min-w-0" disabled={Boolean(attempt) || submitting}>
            <DeliveryForm data={delivery} onChange={setDelivery} />

            {user && savedAddresses.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-medium text-ink-soft dark:text-paper/60">Direcciones guardadas</p>
                <div className="flex flex-wrap gap-2">
                  {savedAddresses.map((address) => (
                    <button
                      key={address.id}
                      type="button"
                      onClick={() => applySavedAddress(address)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                        selectedAddressId === address.id
                          ? 'border-route bg-route-soft text-route dark:bg-route-softDark'
                          : 'border-paper-line text-ink-soft hover:border-ink/30 dark:border-night-line dark:text-paper/60'
                      }`}
                    >
                      {address.etiqueta || `${address.distrito}, ${address.provincia}`}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleUseNewAddress}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      selectedAddressId === null
                        ? 'border-route bg-route-soft text-route dark:bg-route-softDark'
                        : 'border-paper-line text-ink-soft hover:border-ink/30 dark:border-night-line dark:text-paper/60'
                    }`}
                  >
                    Nueva dirección
                  </button>
                </div>
              </div>
            )}

            {user && delivery.tipoEntrega !== 'recojo' && !selectedAddressId && (
              <label className="mt-3 flex items-center gap-2 text-sm text-ink-soft dark:text-paper/60">
                <input
                  type="checkbox"
                  checked={saveNewAddress}
                  onChange={(e) => setSaveNewAddress(e.target.checked)}
                  className="h-4 w-4 rounded text-route focus:ring-route"
                />
                Guardar esta dirección para la próxima compra
              </label>
            )}

            <button
              type="button"
              disabled={!step2Valid}
              onClick={handleContinueToPayment}
              className="btn-primary mt-4 w-full sm:w-auto"
            >
              Continuar con los métodos de pago
            </button>
            </fieldset>
          </CheckoutSection>

          <CheckoutSection
            step={3}
            title="Pago"
            status={statusFor(3, step3Valid)}
            onEdit={attempt || submitting ? undefined : () => setActiveStep(3)}
            summary={<p className="text-sm font-medium text-ink dark:text-paper">{paymentMethodLabel}</p>}
          >
            <p className="mb-3 text-sm font-medium text-ink-soft dark:text-paper/60">Pago único</p>
            <fieldset className="min-w-0" disabled={Boolean(attempt) || submitting}>
            <PaymentMethodSelector methods={paymentMethods} value={paymentMethod} onChange={setPaymentMethod} />
            </fieldset>

            {paymentMethod && paymentMethod !== 'cashOnDelivery' && (
              <div className="mt-4">
                <p className="mb-2 text-sm font-medium text-ink dark:text-paper">Comprobante de pago</p>
                <ReceiptUpload file={receipt} onChange={setReceipt} />
              </div>
            )}

            <div className="mt-5 border-t border-paper-line pt-5 dark:border-night-line">
              <p className="mb-3 text-sm text-ink-soft dark:text-paper/60">
                {step3Valid
                  ? 'Primero registraremos tu pedido. Después podrás continuar por WhatsApp con los datos confirmados.'
                  : 'Elige un método de pago para poder enviar el pedido.'}
              </p>
              <WhatsAppButton onConfirm={handleConfirm} submitting={submitting} retry={Boolean(orderError) || Boolean(attempt)}
                disabled={authLoading || (!attempt && (!step1Valid || !step2Valid || !step3Valid))} />
              <div className="mt-4">
                <TrustBadges />
              </div>
            </div>
          </CheckoutSection>
        </div>

        <aside className="flex h-fit flex-col gap-4 lg:sticky lg:top-24">
          <FreeShippingBar subtotal={subtotal} />

          <div className="rounded-xl2 border border-paper-line p-5 dark:border-night-line">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold text-ink dark:text-paper">
                Tienes {itemCount} producto{itemCount === 1 ? '' : 's'} en tu carrito
              </h2>
              <Link to="/carrito" className="flex shrink-0 items-center gap-1 text-sm font-medium text-route hover:underline">
                <Pencil className="h-3.5 w-3.5" />
                Editar
              </Link>
            </div>

            <ul className="mb-4 flex flex-col gap-3">
              {items.map((item) => (
                <li key={item.id} className="flex items-center gap-3 text-sm">
                  <img src={item.image} alt={item.name} className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                  <span className="flex-1 line-clamp-2 text-ink dark:text-paper">
                    {item.quantity}x {item.name}
                  </span>
                  <span className="shrink-0 font-mono text-ink dark:text-paper">{formatCurrency(item.price * item.quantity)}</span>
                </li>
              ))}
            </ul>

            <div className="flex flex-col gap-1.5 border-t border-paper-line pt-4 text-sm dark:border-night-line">
              <div className="flex items-center justify-between">
                <span className="text-ink-soft dark:text-paper/60">Subtotal</span>
                <span className="font-mono text-ink dark:text-paper">{formatCurrency(subtotal)}</span>
              </div>
              {savings > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-signal-green">Ahorro total</span>
                  <span className="font-mono text-signal-green">-{formatCurrency(savings)}</span>
                </div>
              )}
              <div className="mt-1 flex items-center justify-between border-t border-paper-line pt-3 dark:border-night-line">
                <span className="font-medium text-ink dark:text-paper">Total</span>
                <span className="font-mono text-lg font-semibold text-ink dark:text-paper">{formatCurrency(subtotal)}</span>
              </div>
            </div>
            <p className="mt-2 text-xs text-ink-soft/60 dark:text-paper/40">
              El costo de envío se coordina según tu ubicación antes de confirmar el pago.
            </p>
          </div>

          <div className="rounded-xl2 border border-paper-line p-4 dark:border-night-line">
            <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold text-ink dark:text-paper">
              <Truck className="h-4 w-4 text-route" />
              Entrega
            </h2>
            <ul className="space-y-2 text-sm text-ink-soft dark:text-paper/60">
              {Object.values(storeConfig.shipping).map((option) => (
                <li key={option.label}>
                  <span className="font-medium text-ink dark:text-paper">{option.label}:</span> {option.detail}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}
