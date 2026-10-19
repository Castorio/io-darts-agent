<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { api, APIError } from '../api/client'
import { localizedText, sortStoreModules, isAlreadyInstalledError, storeModuleLinks } from '../lib/store'
import AppLayout from '../components/AppLayout.vue'
import BaseCard from '../components/BaseCard.vue'
import BaseButton from '../components/BaseButton.vue'

interface StoreModule {
  id: string
  name: { de: string; en: string }
  description: { de: string; en: string }
  category: string
  author: string
  repo: string
  branch: string
  homepage?: string
  installed: boolean
  installedVersion: string | null
}

const { t, locale } = useI18n()

const isLoading = ref(true)
const isAvailable = ref(true)
const loadError = ref<string | null>(null)
const modules = ref<StoreModule[]>([])
const installingId = ref<string | null>(null)
const installErrors = ref<Record<string, string>>({})
const lastInstalledModuleId = ref<string | null>(null)

const sortedModules = computed(() => sortStoreModules(modules.value, locale.value))

function moduleName(module: StoreModule): string {
  return localizedText(module.name, locale.value)
}

function moduleDescription(module: StoreModule): string {
  return localizedText(module.description, locale.value)
}

function moduleLinks(module: StoreModule) {
  return storeModuleLinks(module)
}

async function loadStore() {
  isLoading.value = true
  loadError.value = null

  try {
    const result = await api.getStore()
    isAvailable.value = result.available
    modules.value = result.modules
    if (!result.available) {
      loadError.value = result.error || t('store.unavailable')
    }
  } catch (e) {
    isAvailable.value = false
    modules.value = []
    loadError.value = e instanceof Error ? e.message : t('store.unavailable')
  } finally {
    isLoading.value = false
  }
}

async function installModule(module: StoreModule) {
  installingId.value = module.id
  const { [module.id]: _removed, ...remainingErrors } = installErrors.value
  installErrors.value = remainingErrors
  lastInstalledModuleId.value = null

  try {
    const result = await api.installFromStore(module.id)
    if (result.success) {
      lastInstalledModuleId.value = result.moduleId || module.id
      await loadStore()
    } else {
      installErrors.value = {
        ...installErrors.value,
        [module.id]: result.error || t('store.installFailed'),
      }
    }
  } catch (e) {
    if (isAlreadyInstalledError(e)) {
      // 409: the hub considers it already installed. Treat this the same as
      // a successful install - reload so the card switches to the
      // "Installiert" badge instead of getting stuck on a failed button.
      await loadStore()
    } else {
      const message =
        e instanceof APIError || e instanceof Error ? e.message : t('store.installFailed')
      installErrors.value = { ...installErrors.value, [module.id]: message }
    }
  } finally {
    installingId.value = null
  }
}

onMounted(loadStore)
</script>

<template>
  <AppLayout>
    <div class="space-y-6">
      <!-- Back Link -->
      <router-link
        to="/modules"
        class="inline-flex items-center gap-2 text-dark-400 hover:text-white transition-colors"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M15 19l-7-7 7-7"
          />
        </svg>
        {{ t('store.backToModules') }}
      </router-link>

      <!-- Header -->
      <div>
        <h1 class="text-2xl font-bold text-white">{{ t('store.title') }}</h1>
        <p class="text-dark-400">{{ t('store.subtitle') }}</p>
      </div>

      <!-- Install success hint -->
      <div
        v-if="lastInstalledModuleId"
        class="p-4 rounded-lg bg-green-500/10 border border-green-500/30 text-sm text-green-300"
      >
        <i18n-t keypath="store.installSuccessHint" tag="span">
          <template #link>
            <router-link
              :to="`/modules/${lastInstalledModuleId}`"
              class="underline hover:text-green-200"
            >
              {{ t('store.viewModule') }}
            </router-link>
          </template>
        </i18n-t>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="flex items-center justify-center py-12">
        <svg class="animate-spin h-8 w-8 text-autodarts-500" fill="none" viewBox="0 0 24 24">
          <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          />
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      </div>

      <!-- Store Unavailable -->
      <BaseCard v-else-if="!isAvailable">
        <div class="text-center py-12">
          <svg
            class="w-16 h-16 mx-auto text-dark-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
            />
          </svg>
          <h3 class="text-lg font-medium text-white mt-4">{{ t('store.unavailable') }}</h3>
          <p v-if="loadError" class="text-dark-400 mt-2">{{ loadError }}</p>
          <BaseButton class="mt-6" @click="loadStore">{{ t('store.retry') }}</BaseButton>
        </div>
      </BaseCard>

      <!-- Empty Catalog -->
      <BaseCard v-else-if="sortedModules.length === 0">
        <div class="text-center py-12">
          <p class="text-dark-400">{{ t('store.noModules') }}</p>
        </div>
      </BaseCard>

      <!-- Catalog Grid -->
      <div v-else class="grid gap-4 md:grid-cols-2">
        <div
          v-for="module in sortedModules"
          :key="module.id"
          class="bg-dark-800 rounded-xl border border-dark-700 p-6 flex flex-col"
        >
          <div class="flex items-start justify-between gap-3">
            <div>
              <h3 class="text-lg font-semibold text-white">{{ moduleName(module) }}</h3>
              <p class="text-xs text-dark-500 mt-1">
                {{ t('store.category') }}: {{ module.category }} &middot;
                {{ t('store.byAuthor', { author: module.author }) }}
              </p>
            </div>
            <span
              v-if="module.installed"
              class="px-2 py-0.5 text-xs rounded-full bg-green-500/20 text-green-400 whitespace-nowrap"
            >
              {{ t('store.installed') }} v{{ module.installedVersion }}
            </span>
          </div>

          <p class="text-dark-400 text-sm mt-3 flex-1">{{ moduleDescription(module) }}</p>

          <div class="flex items-center justify-between gap-3 mt-4">
            <div class="flex items-center gap-3">
              <a
                v-if="moduleLinks(module).repo"
                :href="moduleLinks(module).repo!"
                target="_blank"
                rel="noopener noreferrer"
                class="text-sm text-autodarts-400 hover:text-autodarts-300 inline-flex items-center gap-1"
              >
                {{ t('store.viewRepo') }}
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
              <a
                v-if="moduleLinks(module).homepage"
                :href="moduleLinks(module).homepage!"
                target="_blank"
                rel="noopener noreferrer"
                class="text-sm text-autodarts-400 hover:text-autodarts-300 inline-flex items-center gap-1"
              >
                {{ t('store.viewHomepage') }}
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
              <span
                v-if="!moduleLinks(module).repo && !moduleLinks(module).homepage"
                class="text-sm text-dark-500"
              >&nbsp;</span>
            </div>

            <BaseButton
              v-if="!module.installed"
              size="sm"
              :loading="installingId === module.id"
              @click="installModule(module)"
            >
              {{ installingId === module.id ? t('store.installing') : t('store.install') }}
            </BaseButton>
          </div>

          <p
            v-if="installErrors[module.id]"
            class="text-sm text-red-400 mt-2"
          >
            {{ installErrors[module.id] }}
          </p>
        </div>
      </div>
    </div>
  </AppLayout>
</template>
