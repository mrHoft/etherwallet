import { ref } from 'vue'
import {
  getBalanceDeltaPeriod,
  setBalanceDeltaPeriod as persistBalanceDeltaPeriod,
  type BalanceDeltaPeriod
} from '~/utils/balanceDeltaPeriod'

export const useBalanceDeltaPeriod = () => {
  const period = ref<BalanceDeltaPeriod>(getBalanceDeltaPeriod())

  const setPeriod = (next: BalanceDeltaPeriod): void => {
    period.value = next
    persistBalanceDeltaPeriod(next)
  }

  return {
    period,
    setPeriod
  }
}
