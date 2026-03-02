'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

export type Theme = 'dark' | 'light' | 'purple'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Apply theme immediately on mount
    const savedTheme = localStorage.getItem('theme') as Theme
    const initialTheme = (savedTheme && ['dark', 'light', 'purple'].includes(savedTheme)) 
      ? savedTheme 
      : 'dark'
    
    setThemeState(initialTheme)
    // Apply theme class immediately
    document.documentElement.classList.remove('theme-dark', 'theme-light', 'theme-purple')
    document.documentElement.classList.add(`theme-${initialTheme}`)
    
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    
    // Remove all theme classes
    document.documentElement.classList.remove('theme-dark', 'theme-light', 'theme-purple')
    // Add current theme class
    document.documentElement.classList.add(`theme-${theme}`)
    
    // Save to localStorage
    localStorage.setItem('theme', theme)
  }, [theme, mounted])

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
  }

  // Always provide context, even before mount
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

