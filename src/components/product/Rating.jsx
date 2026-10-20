import { reviewCountLabel } from '../../utils/reviewLabels.js'
import React from 'react'
export default function Rating({ count, sum, rating }) {
  const value = rating ?? (count > 0 && sum >= count && sum <= count * 5 ? sum / count : null)
  if (!value) return null
  return (
    <span
      className="review-rating"
      aria-label={`${value.toFixed(1)} de 5 estrellas${count ? `, ${reviewCountLabel(count)}` : ''}`}
    >
      <span aria-hidden="true" className="review-stars">
        {[1, 2, 3, 4, 5].map((n) => (
          <svg
            key={n}
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill={n <= Math.round(value) ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z" />
          </svg>
        ))}
      </span>
      {count > 0 && (
        <span aria-hidden="true">
          {value.toFixed(1)} ({count})
        </span>
      )}
    </span>
  )
}
