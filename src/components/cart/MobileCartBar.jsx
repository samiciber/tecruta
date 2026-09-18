import React from 'react'
import { useLocation } from 'react-router-dom'
import { ShoppingCart } from 'lucide-react'
import { useCart } from '../../hooks/useCart.js'
import { formatCurrency } from '../../utils/formatCurrency.js'

export default function MobileCartBar() {
  const { itemCount, subtotal, setIsOpen, isOpen } = useCart()
  const location = useLocation()

  if (itemCount === 0 || isOpen || location.pathname === '/checkout') return null

  return (
    <button
      type="button"
      onClick={() => setIsOpen(true)}
      className="fixed inset-x-3 bottom-3 z-30 flex items-center justify-between rounded-full bg-ink px-5 py-3 text-white shadow-lg dark:bg-paper dark:text-ink lg:hidden"
    >
      <span className="flex items-center gap-2 text-sm font-medium">
        <ShoppingCart className="h-4 w-4" />
        {itemCount} producto{itemCount === 1 ? '' : 's'}
      </span>
      <span className="font-mono text-sm font-semibold">{formatCurrency(subtotal)}</span>
    </button>
  )
}