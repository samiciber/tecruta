import React from 'react'
import App from '../App.jsx'
import '../storefront.css'
import {ShopWhatsApp} from '../components/layout/ShopInformation.jsx'
import { CartProvider } from '../context/CartContext.jsx'
import { SavedProvider } from '../context/SavedContext.jsx'
import StoreSeo from '../components/layout/StoreSeo.jsx'
import OptionalStoreTelemetry from '../components/layout/OptionalStoreTelemetry.jsx'

export default function StoreRoot() {
  return <CartProvider><SavedProvider><div className="storefront"><StoreSeo/><OptionalStoreTelemetry/><App /><ShopWhatsApp/></div></SavedProvider></CartProvider>
}
