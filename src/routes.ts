import type { Component } from 'vue'
import PageHome from './pages/PageHome.vue'
import PageTipCalculator from './pages/PageTipCalculator.vue'
import PageWalletCreate from './pages/PageCreate.vue'
import PageWallet from './pages/PageWallet.vue'
import PageTransfer from './pages/PageTransfer.vue'
import PageExchange from './pages/PageExchange.vue'
import PageSettings from './pages/PageSettings.vue'
import PageNotFound from './pages/PageNotFound.vue'
import { isDecoyEnabled } from '~/utils/decoy'
import { normalizePath, withBase } from '~/utils/path'

export interface Route {
  path: string
  component: Component
  showNavigation?: boolean
}

export const routes: Route[] = [
  { path: withBase('/'), component: PageTipCalculator, showNavigation: false },
  { path: withBase('/home'), component: PageHome },
  { path: withBase('/wallet'), component: PageWallet },
  { path: withBase('/create'), component: PageWalletCreate },
  { path: withBase('/transfer'), component: PageTransfer },
  { path: withBase('/exchange'), component: PageExchange },
  { path: withBase('/settings'), component: PageSettings },
  { path: '/', component: PageTipCalculator, showNavigation: false },
  { path: '/home', component: PageHome },
  { path: '/wallet', component: PageWallet },
  { path: '/create', component: PageWalletCreate },
  { path: '/transfer', component: PageTransfer },
  { path: '/exchange', component: PageExchange },
  { path: '/settings', component: PageSettings },
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
