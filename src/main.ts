import { createApp } from 'vue'
import { router } from '~/utils/router'
import PageHome from './pages/home.vue'
import PageCreateWallet from '~/pages/create.vue'
import PageNotFound from '~/pages/404.vue'

import './style.css'

router
  .use('/', () => createApp(PageHome).mount('#app'))
  .use('/create', () => createApp(PageCreateWallet).mount('#app'))
  .use('/404', () => createApp(PageNotFound).mount('#app'))
  .start()
