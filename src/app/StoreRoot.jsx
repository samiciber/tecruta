import React from 'react'
import App from '../App.jsx'
import '../storefront.css'
import {ShopWhatsApp} from '../components/layout/ShopInformation.jsx'
import { CartProvider } from '../context/CartContext.jsx'
import { SavedProvider } from '../context/SavedContext.jsx'

export default function StoreRoot() {
  return <CartProvider><SavedProvider><div className="storefront"><App /><ShopWhatsApp/></div></SavedProvider></CartProvider>
}
