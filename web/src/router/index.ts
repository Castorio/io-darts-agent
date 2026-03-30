import { createRouter, createWebHistory } from 'vue-router'
import { useAppStore } from '../stores/app'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: () => import('../views/DashboardView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/setup',
      name: 'setup',
      component: () => import('../views/SetupView.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/modules',
      name: 'modules',
      component: () => import('../views/ModulesView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/modules/:id',
      name: 'module-detail',
      component: () => import('../views/ModuleDetailView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/modules/:id/config',
      name: 'module-config',
      component: () => import('../views/WledConfigView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/modules/:id/game-display-config',
      name: 'game-display-config',
      component: () => import('../views/GameDisplayConfigView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/modules/:id/darts-caller-config',
      name: 'darts-caller-config',
      component: () => import('../views/DartsCallerConfigView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/display',
      name: 'game-display',
      // Redirect to the module's own UI - handled by the beforeEnter guard
      beforeEnter: () => {
        // The module UI is served at /module-ui/game-display/
        window.location.href = '/module-ui/game-display/'
        return false // Prevent navigation
      },
      component: () => import('../views/DashboardView.vue'), // Fallback, never reached
      meta: { requiresAuth: false },
    },
    {
      path: '/modules/install',
      name: 'module-install',
      component: () => import('../views/ModuleInstallView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/players',
      name: 'players',
      component: () => import('../views/PlayersView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/media',
      name: 'media',
      component: () => import('../views/MediaLibraryView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/logs',
      name: 'logs',
      component: () => import('../views/LogsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../views/SettingsView.vue'),
      meta: { requiresAuth: true },
    },
  ],
})

router.beforeEach(async (to, _from, next) => {
  const appStore = useAppStore()

  // Wait for initialization
  if (appStore.isLoading) {
    await new Promise<void>((resolve) => {
      const unwatch = appStore.$subscribe(() => {
        if (!appStore.isLoading) {
          unwatch()
          resolve()
        }
      })
    })
  }

  // Redirect to setup if needed
  if (appStore.needsSetup && to.name !== 'setup') {
    return next({ name: 'setup' })
  }

  // If setup is done, don't allow access to setup page
  if (!appStore.needsSetup && to.name === 'setup') {
    return next({ name: 'dashboard' })
  }

  // Check authentication for protected routes
  if (to.meta.requiresAuth && appStore.needsLogin) {
    return next({ name: 'login', query: { redirect: to.fullPath } })
  }

  // If already authenticated, don't show login page
  if (to.name === 'login' && !appStore.needsLogin) {
    return next({ name: 'dashboard' })
  }

  next()
})

export default router
