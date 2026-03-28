import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import './style.css'

const app = createApp(App)

// Plugins
app.use(createPinia())
app.use(router)

// Initialize app store and mount
import { useAppStore } from './stores/app'

app.mount('#app')

// Initialize after mount
const appStore = useAppStore()
appStore.initialize()
