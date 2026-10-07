import React from 'react'
import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../../hooks/useTheme.js'

// onBlue: versión para la franja azul del header (borde/texto blancos).
export default function ThemeToggle({ className = '', onBlue = false }) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      aria-pressed={isDark}
      className={`flex items-center justify-center rounded-full border transition-colors ${onBlue ? 'h-8 w-8' : 'h-10 w-10'} ${
        onBlue
          ? 'border-white/40 text-white hover:bg-white/10'
          : 'border-paper-line text-ink-soft hover:border-ink/30 hover:text-ink dark:border-night-line dark:text-paper/60 dark:hover:border-paper/30 dark:hover:text-paper'
      } ${className}`}
    >
      {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
    </button>
  )
}