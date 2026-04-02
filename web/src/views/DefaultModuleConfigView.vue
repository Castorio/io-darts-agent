<script setup lang="ts">
import { onMounted, ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useModulesStore } from '../stores/modules'
import { useI18n } from 'vue-i18n'
import AppLayout from '../components/AppLayout.vue'
import BaseCard from '../components/BaseCard.vue'
import BaseButton from '../components/BaseButton.vue'
import StatusBadge from '../components/StatusBadge.vue'
import DynamicConfigForm from '../components/DynamicConfigForm.vue'
import EventConfigList from '../components/EventConfigList.vue'

const { t, locale } = useI18n()

// Types for eventMeta from module.json
interface EventMeta {
  label: string | Record<string, string>
  description?: string | Record<string, string>
}

interface EventGroup {
  title: string | Record<string, string>
  events: string[]
}

const route = useRoute()
const modulesStore = useModulesStore()

const moduleId = computed(() => route.params.id as string)
const module = computed(() => modulesStore.selectedModule)

// Config schema from module.json
const configSchema = computed(() => {
  if (!module.value) return {}
  return module.value.config?.schema || {}
})

// Event meta from module.json
const eventMeta = computed(() => {
  if (!module.value) return {} as Record<string, EventMeta>
  return (module.value.eventMeta || {}) as Record<string, EventMeta>
})

// Event groups from module.json
const eventGroups = computed(() => {
  if (!module.value) return [] as EventGroup[]
  return (module.value.eventGroups || []) as EventGroup[]
})

// Check if module has event configuration
const hasEventConfig = computed(() => {
  return Object.keys(eventMeta.value).length > 0
})

// Check if module has config schema
const hasConfigSchema = computed(() => {
  return Object.keys(configSchema.value).length > 0
})

// Current language for i18n
const currentLanguage = computed(() => {
  const lang = locale.value.split('-')[0]
  return ['de', 'en', 'es'].includes(lang) ? lang : 'en'
})

// Config values (for DynamicConfigForm)
const configValues = ref<Record<string, unknown>>({})

// Event enabled states (for EventConfigList)
const enabledEvents = ref<Record<string, boolean>>({})

// UI state
const isSaving = ref(false)
const saveMessage = ref<{ type: 'success' | 'error'; text: string } | null>(null)

// Watch for module config changes
watch(
  () => module.value?.config?.values,
  (values) => {
    if (values) {
      configValues.value = { ...values }
      // Initialize enabled events from config if stored there
      if (values.enabledEvents && typeof values.enabledEvents === 'object') {
        enabledEvents.value = { ...(values.enabledEvents as Record<string, boolean>) }
      }
    }
  },
  { immediate: true }
)

// Initialize enabled events from eventMeta (default all enabled)
watch(
  eventMeta,
  (meta) => {
    for (const eventName of Object.keys(meta)) {
      if (enabledEvents.value[eventName] === undefined) {
        enabledEvents.value[eventName] = true
      }
    }
  },
  { immediate: true }
)

// Handle event toggle
function handleEventToggle(eventName: string, enabled: boolean) {
  enabledEvents.value = { ...enabledEvents.value, [eventName]: enabled }
}

// Save configuration
async function saveConfig() {
  if (!module.value) return

  isSaving.value = true
  saveMessage.value = null

  try {
    // Merge config values with enabled events
    const fullConfig = {
      ...configValues.value,
      enabledEvents: enabledEvents.value,
    }

    await modulesStore.updateConfig(module.value.id, fullConfig)
    saveMessage.value = { type: 'success', text: t('common.saved') }
    setTimeout(() => {
      saveMessage.value = null
    }, 3000)
  } catch (e) {
    saveMessage.value = {
      type: 'error',
      text: e instanceof Error ? e.message : t('common.error'),
    }
  } finally {
    isSaving.value = false
  }
}

onMounted(async () => {
  await modulesStore.fetchModule(moduleId.value)
})
</script>

<template>
  <AppLayout>
    <div class="space-y-6">
      <!-- Back Link -->
      <router-link
        :to="`/modules/${moduleId}`"
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
        {{ t('modules.backToModule') }}
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

      <!-- Module Not Found -->
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
        </div>
      </BaseCard>

      <!-- Module Content -->
      <template v-else>
        <!-- Header -->
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
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>
          <div>
            <div class="flex items-center gap-3">
              <h1 class="text-2xl font-bold text-white">{{ module.name }}</h1>
              <StatusBadge :status="module.status" />
            </div>
            <p class="text-dark-400 mt-1">{{ t('modules.configurationFor', { name: module.name }) }}</p>
          </div>
        </div>

        <!-- Event Configuration -->
        <BaseCard
          v-if="hasEventConfig"
          :title="t('modules.eventConfiguration')"
          :subtitle="t('modules.eventConfigurationSubtitle')"
        >
          <EventConfigList
            :event-groups="eventGroups"
            :event-meta="eventMeta"
            :language="currentLanguage"
            :enabled-events="enabledEvents"
            :show-toggles="true"
            @toggle="handleEventToggle"
          />
        </BaseCard>

        <!-- General Configuration -->
        <BaseCard
          v-if="hasConfigSchema"
          :title="t('modules.configuration')"
          :subtitle="t('modules.configurationSubtitle')"
        >
          <DynamicConfigForm
            :schema="(configSchema as any)"
            v-model="configValues"
          />
        </BaseCard>

        <!-- No Configuration Available -->
        <BaseCard v-if="!hasEventConfig && !hasConfigSchema">
          <div class="text-center py-8">
            <svg
              class="w-12 h-12 mx-auto text-dark-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
            <p class="text-dark-400 mt-3">{{ t('modules.noConfigOptions') }}</p>
          </div>
        </BaseCard>

        <!-- Save Section -->
        <div v-if="hasEventConfig || hasConfigSchema" class="flex items-center justify-between">
          <!-- Save Message -->
          <div
            v-if="saveMessage"
            :class="[
              'text-sm px-4 py-2 rounded-lg',
              saveMessage.type === 'success'
                ? 'bg-green-500/10 text-green-400'
                : 'bg-red-500/10 text-red-400',
            ]"
          >
            {{ saveMessage.text }}
          </div>
          <div v-else />

          <BaseButton :loading="isSaving" @click="saveConfig">
            {{ t('common.save') }}
          </BaseButton>
        </div>
      </template>
    </div>
  </AppLayout>
</template>
