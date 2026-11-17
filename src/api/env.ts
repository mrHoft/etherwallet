/// <reference types="vite/client" />

/**
 * Vite only exposes environment variables through `import.meta.env`.
 * Keeping that access in one module makes it possible to replace the
 * environment in tests, where `import.meta` is not available.
 */
export const env = import.meta.env
