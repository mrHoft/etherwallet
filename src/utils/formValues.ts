import { storage } from '~/utils/storage'

export type FormName = 'transfer' | 'exchange'
export type FormValues = Record<string, string>

export const getFormStorageKey = (network: string, form: FormName): string =>
  `form.${network}.${form}`

const isFilledString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== ''

export const getFormValues = (network: string, form: FormName): FormValues => {
  const storedValues = storage.get<unknown>(getFormStorageKey(network, form))

  if (!storedValues || typeof storedValues !== 'object' || Array.isArray(storedValues)) {
    return {}
  }

  const values: FormValues = {}

  for (const [field, value] of Object.entries(storedValues)) {
    if (isFilledString(value)) values[field] = value.trim()
  }

  return values
}

/**
 * Merges the given fields into the stored form values. Empty values are ignored
 * so resetting a form after a successful submit does not erase what was last used.
 */
export const saveFormValues = (network: string, form: FormName, values: FormValues): void => {
  const storedValues = getFormValues(network, form)
  let hasChanges = false

  for (const [field, value] of Object.entries(values)) {
    if (!isFilledString(value)) continue

    const trimmedValue = value.trim()
    if (storedValues[field] === trimmedValue) continue

    storedValues[field] = trimmedValue
    hasChanges = true
  }

  if (hasChanges) storage.set(getFormStorageKey(network, form), storedValues)
}
