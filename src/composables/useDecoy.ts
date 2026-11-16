import { ref } from 'vue'
import {
  getDecoyLandingPage,
  getUnlockCode,
  setDecoyLandingPage,
  setUnlockCode as persistUnlockCode,
  type DecoyLandingPage
} from '~/utils/decoy'

export const useDecoy = () => {
  const landingPage = ref<DecoyLandingPage>(getDecoyLandingPage())
  const unlockCode = ref<string>(getUnlockCode())

  const setLandingPage = (next: DecoyLandingPage): void => {
    landingPage.value = next
    setDecoyLandingPage(next)
  }

  const setUnlockCode = (next: string): void => {
    unlockCode.value = next
    persistUnlockCode(next)
  }

  return {
    landingPage,
    setLandingPage,
    unlockCode,
    setUnlockCode
  }
}
