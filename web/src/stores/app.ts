import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '../api/client'

export const useAppStore = defineStore('app', () => {
  // State
  const isLoading = ref(true)
  const setupRequired = ref(false)
  const version = ref('')
  const authenticated = ref(false)
  const authRequired = ref(false)
  const username = ref<string | undefined>()
  const error = ref<string | null>(null)

  // Status
  const hubStatus = ref<{
    version: string
    uptime: number
    setupCompleted: boolean
    autodarts: { connected: boolean; userId?: string; boardId?: string }
    modules: { total: number; running: number }
  } | null>(null)

  // Computed
  const isConnected = computed(() => hubStatus.value?.autodarts.connected ?? false)
  const needsSetup = computed(() => setupRequired.value)
  const needsLogin = computed(() => authRequired.value && !authenticated.value)

  // Actions
  async function initialize() {
    isLoading.value = true
    error.value = null

    try {
      // Check setup status
      const setupStatus = await api.getSetupStatus()
      setupRequired.value = setupStatus.setupRequired
      version.value = setupStatus.version

      if (!setupRequired.value) {
        // Check session
        const session = await api.getSession()
        authenticated.value = session.authenticated
        authRequired.value = session.authRequired
        username.value = session.username

        // If authenticated, get hub status
        if (session.authenticated) {
          await refreshStatus()
        }
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Initialization failed'
    } finally {
      isLoading.value = false
    }
  }

  async function refreshStatus() {
    try {
      hubStatus.value = await api.getStatus()
    } catch (e) {
      console.error('Failed to refresh status:', e)
    }
  }

  async function login(user: string, password: string) {
    const result = await api.login(user, password)
    if (result.success) {
      authenticated.value = true
      username.value = user
      await refreshStatus()
    }
    return result
  }

  async function logout() {
    await api.logout()
    authenticated.value = false
    username.value = undefined
    hubStatus.value = null
  }

  function setSetupComplete() {
    setupRequired.value = false
  }

  return {
    // State
    isLoading,
    setupRequired,
    version,
    authenticated,
    authRequired,
    username,
    error,
    hubStatus,
    // Computed
    isConnected,
    needsSetup,
    needsLogin,
    // Actions
    initialize,
    refreshStatus,
    login,
    logout,
    setSetupComplete,
  }
})
