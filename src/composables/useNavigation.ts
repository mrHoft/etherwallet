import { withBase } from '~/utils/path'

export const useNavigation = () => {
  const navigateTo = (path: string) => {
    const target = withBase(path)
    const current = `${window.location.pathname}${window.location.search}`

    if (current !== target) {
      window.history.pushState({}, '', target)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }
  }

  const getCurrentPath = () => window.location.pathname

  return {
    navigateTo,
    getCurrentPath
  }
}
