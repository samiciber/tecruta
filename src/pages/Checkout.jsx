import React, { useEffect, useState } from 'react'
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

// Sube el comprobante a Cloudinary (vía POST /api/orders/:orderId/receipt)
// y lo asocia al pedido ya creado. Falla en silencio (solo advertencia en
// consola) a propósito: si esto no funciona, la compra ya se concretó por
// WhatsApp de todos modos — el cliente siempre puede mandar el
// comprobante por ese medio, o el admin subirlo manualmente después.
async function uploadReceiptFile(orderId, file) {
  try {
    const dataUrl = await fileToDataUrl(file)
    await api.orders.uploadReceipt(orderId, dataUrl)
  } catch (err) {
    console.warn('No se pudo subir el comprobante de pago (el pedido ya se envió por WhatsApp igual):', err.message)
  }
}

export default function Checkout() {
  const { items, subtotal, itemCount, clearCart } = useCart()
  const { user, token } = useAuth()
  const { methods: paymentMethods, getMethodByKey } = usePaymentMethods()

  const [activeStep, setActiveStep] = useState(1)
  const [customer, setCustomer] = useState({
    nombre: user?.nombre || '',
    apellido: user?.apellido || '',
    correo: user?.email || '',
    celular: '',
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
  })
  const [paymentMethod, setPaymentMethod] = useState(null)
  const [savedAddresses, setSavedAddresses] = useState([])
  const [selectedAddressId, setSelectedAddressId] = useState(null)
  const [saveNewAddress, setSaveNewAddress] = useState(false)
  const [receipt, setReceipt] = useState(null)

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

  if (items.length === 0) {
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

  // Se dispara al hacer clic en "Comprar por WhatsApp", EN PARALELO a esa
  // acción — nunca la bloquea ni la retrasa. Si el backend está caído o
  // falla por cualquier motivo, el pedido se envía por WhatsApp igual;
  // esto solo deja el registro en la base de datos para el historial de
  // compras del cliente.
  const handleBeforeSend = () => {
    const orderPromise = api.orders.create(
      {
        customer,
        delivery,
        paymentMethod,
        items: items.map((item) => ({ productId: item.id, quantity: item.quantity })),
      },
      token,
    )

    orderPromise
      .then((order) => {
        // El comprobante (si el cliente adjuntó uno) se sube DESPUÉS de
        // crear el pedido, porque el endpoint de subida necesita el id
        // del pedido — pero sigue siendo "en paralelo" al WhatsApp: nada
        // de esto se espera (await) antes de continuar.
        if (receipt) uploadReceiptFile(order.id, receipt)
      })
      .catch((err) => {
        console.warn('No se pudo registrar el pedido en el sistema (el envío por WhatsApp no se ve afectado):', err.message)
      })

    // Vaciamos el carrito apenas se envía el pedido por WhatsApp — la
    // intención de compra ya se concretó, sin importar si el registro en
    // la base de datos (arriba) tuvo éxito o no.
    clearCart()
  }

  return (
    <div className="container-tr py-8">
      <h1 className="mb-8 font-display text-2xl font-bold text-ink dark:text-paper sm:text-3xl">Checkout</h1>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-4">
          <CheckoutSection
            step={1}
            title="Datos de cliente"
            status={statusFor(1, step1Valid)}
            onEdit={() => setActiveStep(1)}
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
            <CustomerForm data={customer} onChange={setCustomer} />
            <button
              type="button"
              disabled={!step1Valid}
              onClick={() => setActiveStep(2)}
              className="btn-primary mt-4 w-full sm:w-auto"
            >
              Continuar
            </button>
          </CheckoutSection>

          <CheckoutSection
            step={2}
            title="Dirección de entrega"
            status={statusFor(2, step2Valid)}
            onEdit={() => setActiveStep(2)}
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
          </CheckoutSection>

          <CheckoutSection
            step={3}
            title="Pago"
            status={statusFor(3, step3Valid)}
            onEdit={() => setActiveStep(3)}
            summary={<p className="text-sm font-medium text-ink dark:text-paper">{paymentMethodLabel}</p>}
          >
            <p className="mb-3 text-sm font-medium text-ink-soft dark:text-paper/60">Pago único</p>
            <PaymentMethodSelector methods={paymentMethods} value={paymentMethod} onChange={setPaymentMethod} />

            {paymentMethod && paymentMethod !== 'cashOnDelivery' && (
              <div className="mt-4">
                <p className="mb-2 text-sm font-medium text-ink dark:text-paper">Comprobante de pago</p>
                <ReceiptUpload file={receipt} onChange={setReceipt} />
              </div>
            )}

            <div className="mt-5 border-t border-paper-line pt-5 dark:border-night-line">
              <p className="mb-3 text-sm text-ink-soft dark:text-paper/60">
                {step3Valid
                  ? 'Confirma tu pedido por WhatsApp para coordinar el pago y la entrega.'
                  : 'Elige un método de pago para poder enviar el pedido.'}
              </p>
              <WhatsAppButton
                items={items}
                paymentMethodDetails={paymentMethod ? getMethodByKey(paymentMethod) : undefined}
                customer={customer}
                delivery={delivery}
                onBeforeSend={handleBeforeSend}
                disabled={!step3Valid}
              />
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