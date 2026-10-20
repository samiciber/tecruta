import React from 'react'
import Rating from './Rating.jsx'
export default function ReviewCard({ review, onHelpful, disabled, voted }) {
  return (
    <article className="review-card">
      <div className="review-row">
        <strong>{review.name}</strong>
        <time dateTime={review.createdAt}>
          {new Date(review.createdAt).toLocaleDateString('es-PE', { timeZone: 'America/Lima' })}
        </time>
      </div>
      <Rating rating={review.rating} />
      <p className="review-verified">Compra verificada</p>
      {review.title && <h3>{review.title}</h3>}
      <p className="review-text">{review.text}</p>
      {review.storeReply && (
        <blockquote>
          <strong>Respuesta de TecRuta</strong>
          <p>{review.storeReply}</p>
        </blockquote>
      )}
      {onHelpful && (
        <button
          type="button"
          className="review-button"
          disabled={disabled || voted}
          onClick={() => onHelpful(review.id)}
        >
          {voted ? 'Marcada como útil' : '¿Te fue útil?'} ({review.helpfulCount})
        </button>
      )}
    </article>
  )
}
