import { ref } from 'vue'
import {
  getGasDisplayPreference,
  setGasDisplayPreference as persistGasDisplayPreference,
  type GasDisplayPreference
} from '~/utils/gasDisplay'

export const useGasDisplay = () => {
  const preference = ref<GasDisplayPreference>(getGasDisplayPreference())

  const setPreference = (next: GasDisplayPreference): void => {
    preference.value = next
    persistGasDisplayPreference(next)
  }

  return {
    preference,
    setPreference
  }
}
