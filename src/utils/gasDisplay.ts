import { storage } from './storage'

export type GasDisplayPreference = 'gwei' | 'gwei-usd'

const STORAGE_KEY = 'settings.gasDisplay'
const DEFAULT_PREFERENCE: GasDisplayPreference = 'gwei-usd'

const isGasDisplayPreference = (value: unknown): value is GasDisplayPreference =>
  value === 'gwei' || value === 'gwei-usd'

export const getGasDisplayPreference = (): GasDisplayPreference => {
  const stored = storage.get<unknown>(STORAGE_KEY)
  return isGasDisplayPreference(stored) ? stored : DEFAULT_PREFERENCE
}

export const setGasDisplayPreference = (preference: GasDisplayPreference): void => {
  storage.set(STORAGE_KEY, preference)
}
