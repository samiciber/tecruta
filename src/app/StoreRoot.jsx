import React from 'react'
import App from '../App.jsx'
import { CartProvider } from '../context/CartContext.jsx'
import { SavedProvider } from '../context/SavedContext.jsx'

export default function StoreRoot() {
  return <CartProvider><SavedProvider><App /></SavedProvider></CartProvider>
}
