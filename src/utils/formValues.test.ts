import { getFormStorageKey, getFormValues, saveFormValues } from '~/utils/formValues'
import { storage } from '~/utils/storage'

describe('formValues', () => {
  beforeEach(() => {
    // `storage.remove` only handles top-level keys, so reset the nested form values instead.
    storage.set('form.ethereum.transfer', {})
    storage.set('form.ethereum.exchange', {})
  })

  it('builds the storage key from the network and form name', () => {
    expect(getFormStorageKey('ethereum', 'transfer')).toBe('form.ethereum.transfer')
    expect(getFormStorageKey('ethereum', 'exchange')).toBe('form.ethereum.exchange')
    expect(getFormStorageKey('tron', 'transfer')).toBe('form.tron.transfer')
  })

  it('returns an empty object when nothing is stored', () => {
    expect(getFormValues('ethereum', 'transfer')).toEqual({})
  })

  it('saves and reads form values', () => {
    saveFormValues('ethereum', 'transfer', {
      walletFrom: 'main',
      walletTo: '0xabc',
      token: 'ETH'
    })

    expect(getFormValues('ethereum', 'transfer')).toEqual({
      walletFrom: 'main',
      walletTo: '0xabc',
      token: 'ETH'
    })
    expect(storage.get('form.ethereum.transfer')).toEqual({
      walletFrom: 'main',
      walletTo: '0xabc',
      token: 'ETH'
    })
  })

  it('merges fields and ignores empty values', () => {
    saveFormValues('ethereum', 'transfer', { walletFrom: 'main', token: 'ETH' })
    saveFormValues('ethereum', 'transfer', { walletFrom: 'savings', walletTo: '', token: '' })

    expect(getFormValues('ethereum', 'transfer')).toEqual({
      walletFrom: 'savings',
      token: 'ETH'
    })
  })

  it('trims stored values', () => {
    saveFormValues('ethereum', 'transfer', { walletTo: '  0xabc  ' })

    expect(getFormValues('ethereum', 'transfer')).toEqual({ walletTo: '0xabc' })
  })

  it('ignores malformed stored data', () => {
    storage.set('form.ethereum.transfer', {
      walletFrom: 'main',
      walletTo: 42,
      token: null
    })
    expect(getFormValues('ethereum', 'transfer')).toEqual({ walletFrom: 'main' })

    storage.set('form.ethereum.exchange', 'not-an-object')
    expect(getFormValues('ethereum', 'exchange')).toEqual({})

    storage.set('form.ethereum.exchange', ['walletFrom', 'main'])
    expect(getFormValues('ethereum', 'exchange')).toEqual({})
  })
})
