export const useNavigation = () => {
  const navigateTo = (path: string) => {
    console.log('navigateTo', path, window.location.pathname)
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }
  }

  const getCurrentPath = () => window.location.pathname

  return {
    navigateTo,
    getCurrentPath
  }
}
