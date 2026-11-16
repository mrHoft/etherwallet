import { storage } from './storage'

export type DecoyLandingPage = 'tip-calculator' | 'default'

const LANDING_PAGE_STORAGE_KEY = 'settings.decoyLandingPage'
const UNLOCK_CODE_STORAGE_KEY = 'settings.decoyUnlockCode'

export const DEFAULT_DECOY_LANDING_PAGE: DecoyLandingPage = 'default'
export const DEFAULT_UNLOCK_CODE = '256'

const isDecoyLandingPage = (value: unknown): value is DecoyLandingPage =>
  value === 'tip-calculator' || value === 'default'

export const getDecoyLandingPage = (): DecoyLandingPage => {
  const stored = storage.get<unknown>(LANDING_PAGE_STORAGE_KEY)
  return isDecoyLandingPage(stored) ? stored : DEFAULT_DECOY_LANDING_PAGE
}

export const setDecoyLandingPage = (page: DecoyLandingPage): void => {
  storage.set(LANDING_PAGE_STORAGE_KEY, page)
}

export const isDecoyEnabled = (): boolean => getDecoyLandingPage() === 'tip-calculator'

export const getUnlockCode = (): string => {
  const stored = storage.get<unknown>(UNLOCK_CODE_STORAGE_KEY)
  return typeof stored === 'string' ? stored : DEFAULT_UNLOCK_CODE
}

export const setUnlockCode = (code: string): void => {
  storage.set(UNLOCK_CODE_STORAGE_KEY, code)
}
