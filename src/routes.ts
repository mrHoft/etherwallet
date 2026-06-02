import type { Component } from 'vue'
import PageHome from './pages/home.vue'
import PageCreateWallet from './pages/create.vue'
import PageWallet from './pages/wallet.vue'
import PageNotFound from './pages/404.vue'

export interface Route {
  path: string
  component: Component
}

export const routes: Route[] = [
  { path: '/', component: PageHome },
  { path: '/wallet', component: PageWallet },
  { path: '/create', component: PageCreateWallet },
  { path: '**', component: PageNotFound }
]

export const getRouteComponent = (path: string): Component => {
  const route = routes.find(r => r.path === path)
  if (route) return route.component

  const catchAllRoute = routes.find(r => r.path === '**')
  return catchAllRoute?.component || PageNotFound
}
