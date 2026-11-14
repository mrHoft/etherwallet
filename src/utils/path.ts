export const BASE_PATH = '/etherwallet/'

export const withBase = (path: string): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  if (normalizedPath === BASE_PATH.slice(0, -1)) return BASE_PATH
  if (normalizedPath.startsWith(BASE_PATH)) return normalizedPath

  return normalizedPath === '/' ? BASE_PATH : `${BASE_PATH}${normalizedPath.slice(1)}`
}

export const normalizePath = (path: string): string => {
  if (path.length <= 1) return path
  return path.replace(/\/+$/, '') || '/'
}
