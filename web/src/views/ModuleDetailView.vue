<script setup lang="ts">
import { onMounted, ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useModulesStore } from '../stores/modules'
import { useI18n } from 'vue-i18n'
import { api } from '../api/client'
import AppLayout from '../components/AppLayout.vue'
import BaseCard from '../components/BaseCard.vue'
import BaseButton from '../components/BaseButton.vue'
import StatusBadge from '../components/StatusBadge.vue'
import IntentSubscriptionConfig from '../components/IntentSubscriptionConfig.vue'
import DynamicConfigForm from '../components/DynamicConfigForm.vue'

const { t } = useI18n()

const route = useRoute()
const router = useRouter()
const modulesStore = useModulesStore()

const moduleId = computed(() => route.params.id as string)
const module = computed(() => modulesStore.selectedModule)

// Type-safe schema access - cast to any for DynamicConfigForm compatibility
const configSchema = computed(() => {
  if (!module.value) return {}
  return module.value.config.schema || {}
})

const configValues = ref<Record<string, unknown>>({})
const isSaving = ref(false)
const isDeleting = ref(false)
const actionLoading = ref(false)
const showDeleteConfirm = ref(false)
const saveMessage = ref<{ type: 'success' | 'error'; text: string } | null>(null)

// Intent configuration
const hasIntentSupport = ref(false)
const availableIntents = ref<Array<{ id: string; description: string; category?: string }>>([])
const availableActions = ref<Array<{
  type: string
  label: string
  description?: string
  configSchema?: Record<string, unknown>
}>>([])
const intentSubscriptions = ref<Array<{
  intentId: string
  enabled: boolean
  action: { type: string; config?: Record<string, unknown> }
}>>([])
const isSavingIntents = ref(false)
const intentSaveMessage = ref<{ type: 'success' | 'error'; text: string } | null>(null)

// Autostart setting
const autostart = ref(false)
const autostartLoading = ref(false)

// Watch for module changes to update config values
watch(
  () => module.value?.config.values,
  (values) => {
    if (values) {
      configValues.value = { ...values }
    }
  },
  { immediate: true }
)

async function saveConfig() {
  if (!module.value) return

  isSaving.value = true
  saveMessage.value = null

  try {
    await modulesStore.updateConfig(module.value.id, configValues.value)
    saveMessage.value = { type: 'success', text: t('modules.configSaved') }
    setTimeout(() => {
      saveMessage.value = null
    }, 3000)
  } catch (e) {
    saveMessage.value = {
      type: 'error',
      text: e instanceof Error ? e.message : t('modules.configSaveError'),
    }
  } finally {
    isSaving.value = false
  }
}

async function startModule() {
  if (!module.value) return
  actionLoading.value = true
  try {
    await modulesStore.startModule(module.value.id)
  } finally {
    actionLoading.value = false
  }
}

async function stopModule() {
  if (!module.value) return
  actionLoading.value = true
  try {
    await modulesStore.stopModule(module.value.id)
  } finally {
    actionLoading.value = false
  }
}

async function restartModule() {
  if (!module.value) return
  actionLoading.value = true
  try {
    await modulesStore.restartModule(module.value.id)
  } finally {
    actionLoading.value = false
  }
}

async function deleteModule() {
  if (!module.value) return
  isDeleting.value = true
  try {
    await modulesStore.uninstallModule(module.value.id)
    router.push('/modules')
  } finally {
    isDeleting.value = false
  }
}

// Load intent configuration for module
async function loadIntentConfig() {
  if (!module.value) return

  try {
    // Load module intent actions (what this module can do)
    const intentsResponse = await api.getModuleIntents(module.value.id)
    if (intentsResponse.success && intentsResponse.actions) {
      availableActions.value = intentsResponse.actions
    }

    // Load available intents from system (what events can trigger actions)
    const availableIntentsResponse = await api.getAvailableIntents()
    if (availableIntentsResponse.success && availableIntentsResponse.intents) {
      availableIntents.value = availableIntentsResponse.intents
    }

    // Load current subscriptions
    const subscriptionsResponse = await api.getIntentSubscriptions(module.value.id)
    if (subscriptionsResponse.success && subscriptionsResponse.subscriptions) {
      intentSubscriptions.value = subscriptionsResponse.subscriptions
    }

    // Only show intent config if there are actually intents available from other modules
    // AND this module has actions it can perform in response to intents
    hasIntentSupport.value = availableIntents.value.length > 0 && availableActions.value.length > 0
  } catch (e) {
    console.error('Failed to load intent config:', e)
    // Even on error, if we know the module supports actions, show the section
    hasIntentSupport.value = false
  }
}

// Save intent subscriptions
async function saveIntentSubscriptions() {
  if (!module.value) return

  isSavingIntents.value = true
  intentSaveMessage.value = null

  try {
    await api.updateIntentSubscriptions(module.value.id, intentSubscriptions.value)
    intentSaveMessage.value = { type: 'success', text: t('modules.intentsSaved') }
    setTimeout(() => {
      intentSaveMessage.value = null
    }, 3000)
  } catch (e) {
    intentSaveMessage.value = {
      type: 'error',
      text: e instanceof Error ? e.message : t('modules.intentsSaveFailed'),
    }
  } finally {
    isSavingIntents.value = false
  }
}

// Load autostart setting
async function loadAutostartSetting() {
  if (!module.value) return
  try {
    const response = await api.getModuleAutostart(module.value.id)
    autostart.value = response.autostart
  } catch (e) {
    console.error('Failed to load autostart setting:', e)
  }
}

// Toggle autostart setting
async function toggleAutostart() {
  if (!module.value) return
  autostartLoading.value = true
  try {
    const newValue = !autostart.value
    await api.setModuleAutostart(module.value.id, newValue)
    autostart.value = newValue
  } catch (e) {
    console.error('Failed to update autostart setting:', e)
  } finally {
    autostartLoading.value = false
  }
}

onMounted(async () => {
  await modulesStore.fetchModule(moduleId.value)
  await loadIntentConfig()
  await loadAutostartSetting()
})
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
        {{ t('modules.backToModules') }}
      </router-link>

      <!-- Loading State -->
      <div v-if="modulesStore.isLoading" class="flex items-center justify-center py-12">
        <svg
          class="animate-spin h-8 w-8 text-autodarts-500"
          fill="none"
          viewBox="0 0 24 24"
        >
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

      <!-- Not Found -->
      <BaseCard v-else-if="!module">
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
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h3 class="text-lg font-medium text-white mt-4">{{ t('modules.moduleNotFound') }}</h3>
          <p class="text-dark-400 mt-2">
            {{ t('modules.moduleNotFoundDesc') }}
          </p>
        </div>
      </BaseCard>

      <!-- Module Content -->
      <template v-else>
        <!-- Header -->
        <div class="flex items-start justify-between">
          <div class="flex items-start gap-4">
            <div
              :class="[
                'w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0',
                module.status === 'running' ? 'bg-green-500/20' : 'bg-dark-700',
              ]"
            >
              <svg
                :class="[
                  'w-7 h-7',
                  module.status === 'running' ? 'text-green-400' : 'text-dark-400',
                ]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <div class="flex items-center gap-3">
                <h1 class="text-2xl font-bold text-white">{{ module.name }}</h1>
                <StatusBadge :status="module.status" />
              </div>
              <p class="text-dark-400 mt-1">{{ module.description }}</p>
              <div class="flex items-center gap-4 mt-2 text-sm text-dark-500">
                <span>v{{ module.version }}</span>
                <span v-if="module.author">{{ t('modules.author') }}: {{ module.author }}</span>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-4">
            <!-- Autostart Toggle -->
            <div class="flex items-center gap-2">
              <button
                type="button"
                :disabled="autostartLoading"
                @click="toggleAutostart"
                :class="[
                  'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-autodarts-500 focus:ring-offset-2 focus:ring-offset-dark-800',
                  autostart ? 'bg-autodarts-500' : 'bg-dark-600',
                  autostartLoading ? 'opacity-50 cursor-wait' : ''
                ]"
              >
                <span
                  :class="[
                    'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                    autostart ? 'translate-x-5' : 'translate-x-0'
                  ]"
                />
              </button>
              <span class="text-sm text-dark-400">{{ t('modules.autostart') }}</span>
            </div>

            <div class="h-6 w-px bg-dark-600" />

            <div class="flex items-center gap-2">
              <BaseButton
                v-if="module.status === 'running'"
                variant="secondary"
                :loading="actionLoading"
                @click="stopModule"
              >
                {{ t('modules.stop') }}
              </BaseButton>
              <BaseButton
                v-else
                :loading="actionLoading"
                @click="startModule"
              >
                {{ t('modules.start') }}
              </BaseButton>
              <BaseButton
                variant="ghost"
                :disabled="module.status !== 'running'"
                :loading="actionLoading"
                @click="restartModule"
              >
                {{ t('modules.restart') }}
              </BaseButton>
            </div>
          </div>
        </div>

        <!-- WLED-specific: Link to Event Configuration -->
        <BaseCard v-if="module.id === 'wled'" :title="t('modules.wledEventActions')" :subtitle="t('modules.wledEventActionsSubtitle')">
          <div class="flex items-center justify-between">
            <p class="text-dark-400">
              {{ t('modules.wledEventActionsDesc') }}
            </p>
            <router-link :to="`/modules/${module.id}/wled-config`">
              <BaseButton>
                {{ t('modules.wledConfigureEvents') }}
              </BaseButton>
            </router-link>
          </div>
        </BaseCard>

        <!-- Game Display-specific: Link to Display Configuration -->
        <BaseCard v-if="module.id === 'game-display'" :title="t('modules.gameDisplayConfig')" :subtitle="t('modules.gameDisplayConfigSubtitle')">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-dark-400">
                {{ t('modules.gameDisplayConfigDesc') }}
              </p>
              <p class="text-sm text-dark-500 mt-1">
                {{ t('modules.gameDisplayConfigHint') }}
              </p>
            </div>
            <router-link :to="`/modules/${module.id}/game-display-config`">
              <BaseButton>
                {{ t('modules.gameDisplayConfigure') }}
              </BaseButton>
            </router-link>
          </div>
        </BaseCard>

        <!-- Darts Caller-specific: Link to Caller Configuration -->
        <BaseCard v-if="module.id === 'darts-caller'" :title="t('modules.dartsCallerConfig')" :subtitle="t('modules.dartsCallerConfigSubtitle')">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-dark-400">
                {{ t('modules.dartsCallerConfigDesc') }}
              </p>
              <p class="text-sm text-dark-500 mt-1">
                {{ t('modules.dartsCallerConfigHint') }}
              </p>
            </div>
            <router-link :to="`/modules/${module.id}/darts-caller-config`">
              <BaseButton>
                {{ t('modules.dartsCallerConfigure') }}
              </BaseButton>
            </router-link>
          </div>
        </BaseCard>

        <!-- Generic Event Configuration (for modules with eventMeta but no dedicated config page) -->
        <BaseCard
          v-if="module.eventMeta && Object.keys(module.eventMeta).length > 0 && !['wled', 'game-display', 'darts-caller'].includes(module.id)"
          :title="t('modules.genericEventConfig')"
          :subtitle="t('modules.genericEventConfigSubtitle')"
        >
          <div class="flex items-center justify-between">
            <div>
              <p class="text-dark-400">
                {{ t('modules.genericEventConfigDesc') }}
              </p>
            </div>
            <router-link :to="`/modules/${module.id}/config`">
              <BaseButton>
                {{ t('modules.genericEventConfigButton') }}
              </BaseButton>
            </router-link>
          </div>
        </BaseCard>

        <!-- Configuration (hidden for modules with dedicated config pages) -->
        <BaseCard
          v-if="!['wled', 'game-display'].includes(module.id)"
          :title="t('modules.configuration')"
          :subtitle="t('modules.configurationSubtitle')"
        >
          <div v-if="Object.keys(configSchema).length === 0" class="text-center py-8">
            <p class="text-dark-400">{{ t('modules.noConfigOptions') }}</p>
          </div>

          <template v-else>
            <DynamicConfigForm
              :schema="(configSchema as any)"
              v-model="configValues"
            />

            <!-- Save Message -->
            <div
              v-if="saveMessage"
              :class="[
                'p-3 rounded-lg mt-4',
                saveMessage.type === 'success'
                  ? 'bg-green-500/10 text-green-400'
                  : 'bg-red-500/10 text-red-400',
              ]"
            >
              {{ saveMessage.text }}
            </div>

            <!-- Save Button -->
            <div class="flex justify-end mt-6">
              <BaseButton :loading="isSaving" @click="saveConfig">
                {{ t('common.save') }}
              </BaseButton>
            </div>
          </template>
        </BaseCard>

        <!-- Intent Subscriptions (hidden for modules with dedicated config pages) -->
        <BaseCard
          v-if="hasIntentSupport && !['wled', 'game-display'].includes(module.id)"
          :title="t('modules.intentReactions')"
          :subtitle="t('modules.intentReactionsSubtitle')"
        >
          <!-- No intents available -->
          <div v-if="availableIntents.length === 0" class="text-center py-8">
            <svg class="w-12 h-12 mx-auto text-dark-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <p class="text-dark-400 mt-3">{{ t('modules.noIntentsAvailable') }}</p>
            <p class="text-sm text-dark-500 mt-1">{{ t('modules.noIntentsAvailableDesc') }}</p>
          </div>

          <!-- Intent configuration -->
          <IntentSubscriptionConfig
            v-else
            :available-intents="availableIntents"
            :available-actions="availableActions"
            v-model="intentSubscriptions"
          />

          <template #footer>
            <div v-if="availableIntents.length > 0" class="flex items-center justify-between">
              <!-- Save Message -->
              <div
                v-if="intentSaveMessage"
                :class="[
                  'text-sm',
                  intentSaveMessage.type === 'success' ? 'text-green-400' : 'text-red-400',
                ]"
              >
                {{ intentSaveMessage.text }}
              </div>
              <div v-else />

              <BaseButton :loading="isSavingIntents" @click="saveIntentSubscriptions">
                {{ t('modules.saveIntentReactions') }}
              </BaseButton>
            </div>
          </template>
        </BaseCard>

        <!-- Stats -->
        <BaseCard :title="t('modules.statistics')">
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div class="p-4 rounded-lg bg-dark-700/50">
              <p class="text-sm text-dark-400">{{ t('common.status') }}</p>
              <StatusBadge :status="module.status" class="mt-1" />
            </div>
            <div class="p-4 rounded-lg bg-dark-700/50">
              <p class="text-sm text-dark-400">{{ t('modules.restartCount') }}</p>
              <p class="text-xl font-bold text-white mt-1">{{ module.stats.restartCount }}</p>
            </div>
            <div class="p-4 rounded-lg bg-dark-700/50">
              <p class="text-sm text-dark-400">{{ t('modules.startedAt') }}</p>
              <p class="text-sm text-white mt-1">
                {{ module.stats.startedAt ? new Date(module.stats.startedAt).toLocaleString() : '-' }}
              </p>
            </div>
            <div class="p-4 rounded-lg bg-dark-700/50">
              <p class="text-sm text-dark-400">{{ t('modules.eventsCount') }}</p>
              <p class="text-xl font-bold text-white mt-1">{{ module.events.length }}</p>
            </div>
          </div>

          <!-- Last Error -->
          <div
            v-if="module.stats.lastError"
            class="mt-4 p-4 rounded-lg bg-red-500/10 border border-red-500/30"
          >
            <p class="text-sm font-medium text-red-400">{{ t('modules.lastError') }}</p>
            <p class="text-sm text-red-300 mt-1 font-mono">{{ module.stats.lastError }}</p>
          </div>
        </BaseCard>

        <!-- Danger Zone -->
        <BaseCard :title="t('modules.dangerZone')">
          <div class="flex items-center justify-between p-4 rounded-lg border border-red-500/30 bg-red-500/5">
            <div>
              <p class="text-white font-medium">{{ t('modules.uninstallModule') }}</p>
              <p class="text-sm text-dark-400">
                {{ t('modules.uninstallModuleDesc') }}
              </p>
            </div>
            <BaseButton
              variant="danger"
              @click="showDeleteConfirm = true"
            >
              {{ t('common.uninstall') }}
            </BaseButton>
          </div>
        </BaseCard>
      </template>
    </div>

    <!-- Delete Confirmation Modal -->
    <Teleport to="body">
      <div
        v-if="showDeleteConfirm"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div
          class="absolute inset-0 bg-black/70"
          @click="showDeleteConfirm = false"
        />
        <div class="relative bg-dark-800 rounded-2xl border border-dark-700 p-6 max-w-md w-full">
          <h3 class="text-lg font-semibold text-white">{{ t('modules.uninstallConfirmTitle') }}</h3>
          <p class="text-dark-400 mt-2">
            {{ t('modules.uninstallConfirmDesc', { name: module?.name }) }}
          </p>
          <div class="flex items-center justify-end gap-3 mt-6">
            <BaseButton
              variant="ghost"
              @click="showDeleteConfirm = false"
            >
              {{ t('common.cancel') }}
            </BaseButton>
            <BaseButton
              variant="danger"
              :loading="isDeleting"
              @click="deleteModule"
            >
              {{ t('common.uninstall') }}
            </BaseButton>
          </div>
        </div>
      </div>
    </Teleport>
  </AppLayout>
</template>
