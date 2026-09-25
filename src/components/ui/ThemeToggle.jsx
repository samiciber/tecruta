import React from 'react'
import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../../hooks/useTheme.js'

export default function ThemeToggle({ className = '', transparent = false }) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      aria-pressed={isDark}
      className={`flex h-10 w-10 items-center justify-center rounded-full border transition-colors ${
        transparent
          ? 'lg:border-white/30 lg:text-white lg:hover:border-white/60 lg:hover:text-white border-paper-line text-ink-soft hover:border-ink/30 hover:text-ink dark:border-night-line dark:text-paper/60 dark:hover:border-paper/30 dark:hover:text-paper'
          : 'border-paper-line text-ink-soft hover:border-ink/30 hover:text-ink dark:border-night-line dark:text-paper/60 dark:hover:border-paper/30 dark:hover:text-paper'
      } ${className}`}
    >
      {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
    </button>
  )
}