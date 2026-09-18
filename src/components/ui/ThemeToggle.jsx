import React from 'react'
import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../../hooks/useTheme.js'

export default function ThemeToggle({ className = '' }) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      aria-pressed={isDark}
      className={`flex h-10 w-10 items-center justify-center rounded-full border border-paper-line text-ink-soft transition-colors hover:border-ink/30 hover:text-ink dark:border-night-line dark:text-paper/60 dark:hover:border-paper/30 dark:hover:text-paper ${className}`}
    >
      {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
    </button>
  )
}
