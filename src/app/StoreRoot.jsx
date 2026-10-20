import React from 'react'
import App from '../App.jsx'
import '../storefront.css'
import { CartProvider } from '../context/CartContext.jsx'
import { SavedProvider } from '../context/SavedContext.jsx'

export default function StoreRoot() {
  return <CartProvider><SavedProvider><div className="storefront"><App /></div></SavedProvider></CartProvider>
}
