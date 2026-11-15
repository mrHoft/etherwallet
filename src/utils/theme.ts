import { storage } from './storage'

export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'settings.theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'

const isThemePreference = (value: unknown): value is ThemePreference =>
  value === 'light' || value === 'dark' || value === 'system'

export const getThemePreference = (): ThemePreference => {
  const stored = storage.get<unknown>(STORAGE_KEY)
  return isThemePreference(stored) ? stored : 'system'
}

const getDarkMediaQuery = (): MediaQueryList | null => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null
  return window.matchMedia(DARK_QUERY)
}

export const getSystemTheme = (): ResolvedTheme => {
  const mediaQuery = getDarkMediaQuery()
  return mediaQuery?.matches ? 'dark' : 'light'
}

export const resolveTheme = (preference: ThemePreference): ResolvedTheme =>
  preference === 'system' ? getSystemTheme() : preference

const applyResolvedTheme = (theme: ResolvedTheme): void => {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = theme
}

let systemMediaQuery: MediaQueryList | null = null
let systemListener: (() => void) | null = null

const detachSystemListener = (): void => {
  if (!systemMediaQuery || !systemListener) return

  systemMediaQuery.removeEventListener('change', systemListener)
  systemMediaQuery = null
  systemListener = null
}

const attachSystemListener = (): void => {
  const mediaQuery = getDarkMediaQuery()
  if (!mediaQuery) return

  systemMediaQuery = mediaQuery
  systemListener = () => applyResolvedTheme(getSystemTheme())
  mediaQuery.addEventListener('change', systemListener)
}

export const applyTheme = (preference: ThemePreference = getThemePreference()): ResolvedTheme => {
  const theme = resolveTheme(preference)
  applyResolvedTheme(theme)
  detachSystemListener()

  if (preference === 'system') attachSystemListener()

  return theme
}

export const setThemePreference = (preference: ThemePreference): ResolvedTheme => {
  storage.set(STORAGE_KEY, preference)
  return applyTheme(preference)
}
