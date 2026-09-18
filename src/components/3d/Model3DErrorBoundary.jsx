import React from 'react'

// Error boundary mínimo: si el modelo GLB falla al cargar (URL rota, 404,
// archivo corrupto, CORS, lo que sea), React lanza el error dentro del
// Canvas. Sin esto, ese error tumbaría toda la página. Con esto, se lo
// pasamos a Product3DViewer para que haga el fallback a la imagen normal.
export default class Model3DErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error) {
    console.warn('No se pudo cargar el modelo 3D, usando imagen de respaldo:', error?.message || error)
    this.props.onError?.()
  }

  render() {
    if (this.state.hasError) return null
    return this.props.children
  }
}
