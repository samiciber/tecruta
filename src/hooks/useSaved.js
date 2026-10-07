import { useContext } from 'react'
import { SavedContext } from '../context/SavedContext.jsx'

export function useSaved() {
  const ctx = useContext(SavedContext)
  if (!ctx) throw new Error('useSaved debe usarse dentro de <SavedProvider>')
  return ctx
}