import React from 'react'
import { SearchX } from 'lucide-react'
import ProductCard from './ProductCard.jsx'
import ProductSkeleton from './ProductSkeleton.jsx'
import EmptyState from '../ui/EmptyState.jsx'

export default function ProductGrid({ products, loading = false, emptyAction }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <ProductSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (!products || products.length === 0) {
    return (
      <EmptyState
        icon={SearchX}
        title="No encontramos productos"
        description="Intenta limpiar los filtros o buscar con otras palabras."
        action={emptyAction}
      />
    )
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  )
}
