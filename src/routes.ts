import { defineAsyncComponent, type Component } from 'vue'
import PageTipCalculator from '~/pages/PageTipCalculator.vue'
import PageLoading from '~/components/ui/PageLoading.vue'
import { isDecoyEnabled } from '~/utils/decoy'
import { normalizePath, withBase } from '~/utils/path'

export interface Route {
  path: string
  component: Component
  showNavigation?: boolean
}

const lazyPage = (loader: () => Promise<{ default: Component }>): Component => {
  return defineAsyncComponent<Component>({
    loader,
    delay: 150,
    loadingComponent: PageLoading,
    onError: (_error, retry, fail, attempts) => {
      if (attempts < 3) retry()
      else fail()
    }
  })
}

// The tip calculator is the landing page in decoy mode, so it stays eager.
const PageHome = lazyPage(() => import('~/pages/PageHome.vue'))
const PageWallet = lazyPage(() => import('~/pages/PageWallet.vue'))
const PageWalletCreate = lazyPage(() => import('~/pages/PageCreate.vue'))
const PageTransfer = lazyPage(() => import('~/pages/PageTransfer.vue'))
const PageExchange = lazyPage(() => import('~/pages/PageExchange.vue'))
const PageInterest = lazyPage(() => import('~/pages/PageInterest.vue'))
const PageSettings = lazyPage(() => import('~/pages/PageSettings.vue'))
const PageNotFound = lazyPage(() => import('~/pages/PageNotFound.vue'))

const baseRoutes: Route[] = [
  { path: '/', component: PageTipCalculator, showNavigation: false },
  { path: '/home', component: PageHome },
  { path: '/wallet', component: PageWallet },
  { path: '/create', component: PageWalletCreate },
  { path: '/transfer', component: PageTransfer },
  { path: '/exchange', component: PageExchange },
  { path: '/interest', component: PageInterest },
  { path: '/settings', component: PageSettings }
]

export const routes: Route[] = [
  ...baseRoutes.map(route => ({ ...route, path: withBase(route.path) })),
  ...baseRoutes,
  { path: '**', component: PageNotFound }
]

export const isLandingPath = (path: string): boolean => {
  const normalizedPath = normalizePath(path)
  return normalizedPath === '/' || normalizedPath === normalizePath(withBase('/'))
}

export const getRoute = (path: string): Route => {
  const normalizedPath = normalizePath(path)

  if (isLandingPath(normalizedPath) && !isDecoyEnabled()) {
    const homeRoute = routes.find(r => normalizePath(r.path) === normalizePath(withBase('/home')))
    if (homeRoute) return homeRoute
  }

  const route = routes.find(r => normalizePath(r.path) === normalizedPath)
  if (route) return route

  return routes.find(r => r.path === '**') ?? { path: '**', component: PageNotFound }
}

export const getRouteComponent = (path: string): Component => getRoute(path).component
