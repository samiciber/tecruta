import React from 'react'
import { Link } from 'react-router-dom'
import { Instagram, MessageCircle, Music2, Mail } from 'lucide-react'
import { storeConfig } from '../../config/storeConfig.js'

export default function Footer() {
  return (
    <footer className="border-t border-paper-line bg-paper-surface dark:border-night-line dark:bg-night-surface">
      <div className="container-tr grid grid-cols-2 gap-8 py-12 sm:grid-cols-4">
        <div className="col-span-2 flex flex-col gap-3 sm:col-span-1">
          <span className="font-display text-lg font-bold text-ink dark:text-paper">
            Tec<span className="text-route">Ruta</span>
          </span>
          <p className="text-sm text-ink-soft dark:text-paper/60">{storeConfig.description}</p>
        </div>

        <div>
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-soft/70 dark:text-paper/50">Comprar</h4>
          <ul className="flex flex-col gap-2 text-sm">
            <li><Link to="/catalogo" className="text-ink-soft hover:text-route dark:text-paper/70">Productos</Link></li>
            <li><Link to="/catalogo" className="text-ink-soft hover:text-route dark:text-paper/70">Categorías</Link></li>
            <li><Link to="/catalogo?ordenar=discount" className="text-ink-soft hover:text-route dark:text-paper/70">Ofertas</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-soft/70 dark:text-paper/50">Ayuda</h4>
          <ul className="flex flex-col gap-2 text-sm">
            <li><Link to="/ayuda#envios" className="text-ink-soft hover:text-route dark:text-paper/70">Envíos</Link></li>
            <li><Link to="/ayuda#pagos" className="text-ink-soft hover:text-route dark:text-paper/70">Métodos de pago</Link></li>
            <li>
              <a href={`https://wa.me/${storeConfig.whatsapp.number}`} target="_blank" rel="noopener noreferrer" className="text-ink-soft hover:text-route dark:text-paper/70">
                Contacto
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-soft/70 dark:text-paper/50">Redes</h4>
          <ul className="flex flex-col gap-2 text-sm">
            <li>
              <a href={storeConfig.social.instagram} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-ink-soft hover:text-route dark:text-paper/70">
                <Instagram className="h-4 w-4" /> Instagram
              </a>
            </li>
            <li>
              <a href={storeConfig.social.tiktok} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-ink-soft hover:text-route dark:text-paper/70">
                <Music2 className="h-4 w-4" /> TikTok
              </a>
            </li>
            <li>
              <a href={`https://wa.me/${storeConfig.whatsapp.number}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-ink-soft hover:text-route dark:text-paper/70">
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </a>
            </li>
            <li>
              <a href={`mailto:${storeConfig.social.email}`} className="inline-flex items-center gap-2 text-ink-soft hover:text-route dark:text-paper/70">
                <Mail className="h-4 w-4" /> {storeConfig.social.email}
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-paper-line dark:border-night-line">
        <div className="container-tr flex flex-col items-center justify-between gap-2 py-5 text-xs text-ink-soft/70 dark:text-paper/40 sm:flex-row">
          <span>© {new Date().getFullYear()} {storeConfig.name}. {storeConfig.location.city}.</span>
          <div className="flex gap-4">
            <Link to="/legal/terminos" className="hover:text-route">Términos</Link>
            <Link to="/legal/privacidad" className="hover:text-route">Privacidad</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
