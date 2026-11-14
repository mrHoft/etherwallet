import type { Component } from 'vue'
import PageHome from './pages/PageHome.vue'
import PageCreateWallet from './pages/PageCreate.vue'
import PageWallet from './pages/PageWallet.vue'
import PageTransfer from './pages/PageTransfer.vue'
import PageSettings from './pages/PageSettings.vue'
import PageNotFound from './pages/Page404.vue'
import { normalizePath, withBase } from '~/utils/path'

export interface Route {
  path: string
  component: Component
}

export const routes: Route[] = [
  { path: withBase('/'), component: PageHome },
  { path: withBase('/wallet'), component: PageWallet },
  { path: withBase('/create'), component: PageCreateWallet },
  { path: withBase('/transfer'), component: PageTransfer },
  { path: withBase('/settings'), component: PageSettings },
  { path: '/', component: PageHome },
  { path: '/wallet', component: PageWallet },
  { path: '/create', component: PageCreateWallet },
  { path: '/transfer', component: PageTransfer },
  { path: '/settings', component: PageSettings },
  { path: '**', component: PageNotFound }
]

export const getRouteComponent = (path: string): Component => {
  const normalizedPath = normalizePath(path)
  const route = routes.find(r => normalizePath(r.path) === normalizedPath)
  if (route) return route.component

  const catchAllRoute = routes.find(r => r.path === '**')
  return catchAllRoute?.component || PageNotFound
}
