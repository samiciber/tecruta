import React from 'react'
import { HomeView } from '../home/HomeView.jsx'
import { CartContext } from '../../context/CartContext.jsx'
import { SavedContext } from '../../context/SavedContext.jsx'

// Snapshot contexts for the existing visual renderer: no CartProvider or
// SavedProvider, storage, API mutation or commercial navigation is mounted.
const cart = Object.freeze({ canAdd: () => true, addItem: () => {}, addItemVerified: async () => {} })
const saved = Object.freeze({ isSaved: () => false, toggle: () => {} })
export default function HomePreview(props) {
  return <div inert="" aria-hidden="true"><CartContext.Provider value={cart}><SavedContext.Provider value={saved}><HomeView {...props} /></SavedContext.Provider></CartContext.Provider></div>
}
