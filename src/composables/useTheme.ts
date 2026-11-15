import { ref } from 'vue'
import {
  getThemePreference,
  setThemePreference as persistThemePreference,
  type ThemePreference
} from '~/utils/theme'

export const useTheme = () => {
  const preference = ref<ThemePreference>(getThemePreference())

  const setPreference = (next: ThemePreference): void => {
    preference.value = next
    persistThemePreference(next)
  }

  return {
    preference,
    setPreference
  }
}
