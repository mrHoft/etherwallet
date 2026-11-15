import { RPC_URLS } from './const'
import { storage } from '../utils/storage'

const STORAGE_KEY = 'rpcUrls'

const sanitizeUrls = (value: unknown): string[] | null => {
  if (!Array.isArray(value)) return null

  return value.filter((url): url is string => typeof url === 'string' && url.trim().length > 0)
}

export const getRpcUrls = (): string[] => {
  const storedUrls = sanitizeUrls(storage.get<unknown>(STORAGE_KEY))
  return storedUrls ?? [...RPC_URLS]
}

export const validateRpcUrl = (value: string): string => {
  const trimmedValue = value.trim()

  if (!trimmedValue) return 'RPC URL is required'

  let parsedUrl: URL
  try {
    parsedUrl = new URL(trimmedValue)
  } catch {
    return 'Enter a valid URL'
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return 'RPC URL must start with http:// or https://'
  }

  return ''
}

export const addRpcUrl = (url: string): string => {
  const normalizedUrl = url.trim()
  const validationError = validateRpcUrl(normalizedUrl)
  if (validationError) throw new Error(validationError)

  const urls = getRpcUrls()
  if (urls.includes(normalizedUrl)) {
    throw new Error('This provider is already configured')
  }

  storage.set(STORAGE_KEY, [...urls, normalizedUrl])
  return normalizedUrl
}

export const removeRpcUrl = (url: string): void => {
  const urls = getRpcUrls()
  storage.set(STORAGE_KEY, urls.filter(existingUrl => existingUrl !== url))
}
