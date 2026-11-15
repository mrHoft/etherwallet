import { createApp } from 'vue'
import App from './App.vue'
import { applyTheme } from './utils/theme'

import './style.css'

applyTheme()

createApp(App).mount('#app')
