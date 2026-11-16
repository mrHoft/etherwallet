import { storage } from './storage'

export type BalanceDeltaPeriod = '24h' | '7d' | '30d' | 'off'

const STORAGE_KEY = 'settings.balanceDeltaPeriod'
const DEFAULT_PERIOD: BalanceDeltaPeriod = '24h'

const isBalanceDeltaPeriod = (value: unknown): value is BalanceDeltaPeriod =>
  value === '24h' || value === '7d' || value === '30d' || value === 'off'

export const getBalanceDeltaPeriod = (): BalanceDeltaPeriod => {
  const stored = storage.get<unknown>(STORAGE_KEY)
  return isBalanceDeltaPeriod(stored) ? stored : DEFAULT_PERIOD
}

export const setBalanceDeltaPeriod = (period: BalanceDeltaPeriod): void => {
  storage.set(STORAGE_KEY, period)
}
