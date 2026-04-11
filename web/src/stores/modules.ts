import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '../api/client'
import type { ModuleStatus } from '../types/api'

// Local types that match API response (status as string)
interface ModuleListItemLocal {
  id: string
  name: string
  version: string
  description: string
  status: ModuleStatus
  events: string[]
}

interface ModuleDetailLocal {
  id: string
  name: string
  version: string
  description: string
  author?: string
  repository?: string
  status: ModuleStatus
  events: string[]
  config: {
    schema: Record<string, unknown>
    values: Record<string, unknown>
  }
  stats: {
    startedAt?: string
    stoppedAt?: string
    restartCount: number
    lastError?: string
  }
  // Extended fields from module.json (optional, module-specific)
  eventMeta?: Record<string, { label: Record<string, string>; description: Record<string, string> }>
  eventGroups?: Array<{ title: Record<string, string>; events: string[] }>
  effects?: Array<{ id: number; name: string }>
  intents?: {
    actions?: Array<{ type: string; label: string; description?: string; configSchema?: Record<string, unknown> }>
    emits?: Array<{ id: string; description?: string; category?: string }>
    defaultSubscriptions?: unknown[]
  }
  i18n?: Record<string, unknown>
}

interface AvailableModule {
  id: string
  name: string
  version: string
  description: string
}

export const useModulesStore = defineStore('modules', () => {
  // State
  const modules = ref<ModuleListItemLocal[]>([])
  const availableModules = ref<AvailableModule[]>([])
  const selectedModule = ref<ModuleDetailLocal | null>(null)
  const isLoading = ref(false)
  const isInstalling = ref(false)
  const isInstallingBuiltin = ref(false)
  const error = ref<string | null>(null)

  // Computed
  const runningModules = computed(() =>
    modules.value.filter((m) => m.status === 'running')
  )

  const stoppedModules = computed(() =>
    modules.value.filter((m) => m.status === 'stopped')
  )

  const moduleCount = computed(() => modules.value.length)
  const runningCount = computed(() => runningModules.value.length)

  // Actions
  async function fetchModules() {
    isLoading.value = true
    error.value = null

    try {
      const result = await api.listModules()
      modules.value = result.map((m) => ({
        ...m,
        status: m.status as ModuleStatus,
      }))
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch modules'
    } finally {
      isLoading.value = false
    }
  }

  async function fetchAvailableModules() {
    try {
      const result = await api.getAvailableModules()
      availableModules.value = result.modules || []
    } catch (e) {
      console.error('Failed to fetch available modules:', e)
      availableModules.value = []
    }
  }

  async function installBuiltinModule(id: string) {
    isInstallingBuiltin.value = true
    error.value = null

    try {
      const result = await api.installBuiltinModule(id)
      if (result.success) {
        // Refresh both lists
        await fetchModules()
        await fetchAvailableModules()
      }
      return result
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to install module'
      throw e
    } finally {
      isInstallingBuiltin.value = false
    }
  }

  async function fetchModule(id: string) {
    isLoading.value = true
    error.value = null

    try {
      const result = await api.getModule(id)
      selectedModule.value = {
        ...result,
        status: result.status as ModuleStatus,
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch module'
      selectedModule.value = null
    } finally {
      isLoading.value = false
    }
  }

  async function startModule(id: string) {
    try {
      const result = await api.startModule(id)
      if (result.success) {
        await fetchModules()
        if (selectedModule.value?.id === id) {
          await fetchModule(id)
        }
      }
      return result
    } catch (e) {
      throw e
    }
  }

  async function stopModule(id: string) {
    try {
      const result = await api.stopModule(id)
      if (result.success) {
        await fetchModules()
        if (selectedModule.value?.id === id) {
          await fetchModule(id)
        }
      }
      return result
    } catch (e) {
      throw e
    }
  }

  async function restartModule(id: string) {
    try {
      const result = await api.restartModule(id)
      if (result.success) {
        await fetchModules()
        if (selectedModule.value?.id === id) {
          await fetchModule(id)
        }
      }
      return result
    } catch (e) {
      throw e
    }
  }

  async function updateConfig(id: string, config: Record<string, unknown>) {
    try {
      const result = await api.updateModuleConfig(id, config)
      if (result.success && selectedModule.value?.id === id) {
        await fetchModule(id)
      }
      return result
    } catch (e) {
      throw e
    }
  }

  async function installModule(
    source: 'git' | 'local',
    url?: string,
    path?: string,
    branch?: string
  ) {
    isInstalling.value = true
    error.value = null

    try {
      const result = await api.installModule(source, url, path, branch)
      if (result.success) {
        await fetchModules()
      }
      return result
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to install module'
      throw e
    } finally {
      isInstalling.value = false
    }
  }

  async function uninstallModule(id: string) {
    try {
      const result = await api.uninstallModule(id)
      if (result.success) {
        await fetchModules()
        if (selectedModule.value?.id === id) {
          selectedModule.value = null
        }
      }
      return result
    } catch (e) {
      throw e
    }
  }

  function updateModuleStatus(id: string, status: ModuleStatus) {
    const module = modules.value.find((m) => m.id === id)
    if (module) {
      module.status = status
    }
    if (selectedModule.value?.id === id) {
      selectedModule.value.status = status
    }
  }

  function clearSelectedModule() {
    selectedModule.value = null
  }

  return {
    // State
    modules,
    availableModules,
    selectedModule,
    isLoading,
    isInstalling,
    isInstallingBuiltin,
    error,
    // Computed
    runningModules,
    stoppedModules,
    moduleCount,
    runningCount,
    // Actions
    fetchModules,
    fetchAvailableModules,
    fetchModule,
    startModule,
    stopModule,
    restartModule,
    updateConfig,
    installModule,
    installBuiltinModule,
    uninstallModule,
    updateModuleStatus,
    clearSelectedModule,
  }
})
