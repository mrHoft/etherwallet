import type { Component } from 'vue'
import PageHome from './pages/PageHome.vue'
import PageCreateWallet from './pages/PageCreate.vue'
import PageWallet from './pages/PageWallet.vue'
import PageTransfer from './pages/PageTransfer.vue'
import PageNotFound from './pages/Page404.vue'

export interface Route {
  path: string
  component: Component
}

export const routes: Route[] = [
  { path: '/', component: PageHome },
  { path: '/etherwallet', component: PageHome },
  { path: '/wallet', component: PageWallet },
  { path: '/create', component: PageCreateWallet },
  { path: '/transfer', component: PageTransfer },
  { path: '**', component: PageNotFound }
]

export const getRouteComponent = (path: string): Component => {
  const route = routes.find(r => r.path === path || `${r.path}/` === path)
  if (route) return route.component

  const catchAllRoute = routes.find(r => r.path === '**')
  return catchAllRoute?.component || PageNotFound
}
