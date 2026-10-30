import React, { useEffect, useRef, useState } from 'react'

export default function HeroVideo({ slide, active, paused, reduced, preview, size, onEnded, onFailed }) {
  const video = useRef(null)
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches)
  const [blocked, setBlocked] = useState(false)
  const [started, setStarted] = useState(false)
  const [waiting, setWaiting] = useState(true)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const change = () => setMobile(mq.matches)
    mq.addEventListener('change', change)
    return () => mq.removeEventListener('change', change)
  }, [])
  const isMobile = size === 'mobile' || size === 'auto' && mobile
  const src = isMobile && slide.videoMobile ? slide.videoMobile : slide.videoDesktop
  useEffect(() => { setStarted(false); setBlocked(false); setWaiting(true); setFailed(false) }, [src, active])
  useEffect(() => {
    const el = video.current
    if (!el) return
    if (!active || paused || (reduced && !started) || preview) { el.pause(); return }
    let live = true
    el.play()?.catch(() => { if (live) setBlocked(true) })
    return () => { live = false; el.pause() }
  }, [active, paused, reduced, started, src, preview])
  useEffect(() => {
    if (!active || !waiting || paused || reduced || preview || blocked || failed) return
    const timer = setTimeout(() => { setFailed(true); onFailed?.() }, 20000)
    return () => clearTimeout(timer)
  }, [active, waiting, paused, reduced, preview, blocked, failed, onFailed])
  const play = () => {
    setStarted(true)
    video.current?.play()?.then(() => setBlocked(false)).catch(() => setBlocked(true))
  }
  return <>
    <video key={src + String(active)} ref={video} src={active ? src : undefined}
      poster={(isMobile ? slide.imageMobile : null) || slide.imageDesktop || undefined}
      muted playsInline preload={active ? 'metadata' : 'none'} controls={preview}
      aria-label={slide.imageAlt || slide.title || 'Video destacado'}
      className="absolute inset-0 h-full w-full bg-black object-contain"
      onEnded={onEnded} onError={() => { setFailed(true); onFailed?.() }} onWaiting={() => setWaiting(true)}
      onPlaying={() => { setWaiting(false); setBlocked(false) }} onCanPlay={() => setWaiting(false)} />
    {active && failed && <p role="status" className="absolute right-4 top-4 z-20 rounded bg-black/80 p-3 text-sm text-white">No se pudo reproducir el video. Puedes cambiar de diapositiva.</p>}
    {active && !preview && !failed && (blocked || reduced && !started) && <button type="button" onClick={play}
      className="absolute right-4 top-4 z-20 rounded bg-white px-4 py-2 text-sm font-semibold text-black focus-visible:ring-4 focus-visible:ring-route">
      Reproducir video
    </button>}
  </>
}
