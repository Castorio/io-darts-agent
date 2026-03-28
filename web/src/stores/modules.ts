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
}

export const useModulesStore = defineStore('modules', () => {
  // State
  const modules = ref<ModuleListItemLocal[]>([])
  const selectedModule = ref<ModuleDetailLocal | null>(null)
  const isLoading = ref(false)
  const isInstalling = ref(false)
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
    selectedModule,
    isLoading,
    isInstalling,
    error,
    // Computed
    runningModules,
    stoppedModules,
    moduleCount,
    runningCount,
    // Actions
    fetchModules,
    fetchModule,
    startModule,
    stopModule,
    restartModule,
    updateConfig,
    installModule,
    uninstallModule,
    updateModuleStatus,
    clearSelectedModule,
  }
})
