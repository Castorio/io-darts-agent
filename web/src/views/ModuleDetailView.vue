<script setup lang="ts">
import { onMounted, ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useModulesStore } from '../stores/modules'
import AppLayout from '../components/AppLayout.vue'
import BaseCard from '../components/BaseCard.vue'
import BaseButton from '../components/BaseButton.vue'
import BaseInput from '../components/BaseInput.vue'
import StatusBadge from '../components/StatusBadge.vue'

// Config field schema type
interface ConfigField {
  type: 'string' | 'number' | 'boolean' | 'select'
  label: string
  description?: string
  required?: boolean
  min?: number
  max?: number
  options?: Array<{ value: string | number; label: string }>
}

const route = useRoute()
const router = useRouter()
const modulesStore = useModulesStore()

const moduleId = computed(() => route.params.id as string)
const module = computed(() => modulesStore.selectedModule)

// Type-safe schema access
const configSchema = computed(() => {
  if (!module.value) return {} as Record<string, ConfigField>
  return module.value.config.schema as Record<string, ConfigField>
})

const configValues = ref<Record<string, unknown>>({})
const isSaving = ref(false)
const isDeleting = ref(false)
const actionLoading = ref(false)
const showDeleteConfirm = ref(false)
const saveMessage = ref<{ type: 'success' | 'error'; text: string } | null>(null)

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
    saveMessage.value = { type: 'success', text: 'Konfiguration gespeichert' }
    setTimeout(() => {
      saveMessage.value = null
    }, 3000)
  } catch (e) {
    saveMessage.value = {
      type: 'error',
      text: e instanceof Error ? e.message : 'Fehler beim Speichern',
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

onMounted(() => {
  modulesStore.fetchModule(moduleId.value)
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
        Zurück zu Module
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
          <h3 class="text-lg font-medium text-white mt-4">Modul nicht gefunden</h3>
          <p class="text-dark-400 mt-2">
            Das gesuchte Modul existiert nicht oder wurde entfernt.
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
                <span v-if="module.author">von {{ module.author }}</span>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-2">
            <BaseButton
              v-if="module.status === 'running'"
              variant="secondary"
              :loading="actionLoading"
              @click="stopModule"
            >
              Stoppen
            </BaseButton>
            <BaseButton
              v-else
              :loading="actionLoading"
              @click="startModule"
            >
              Starten
            </BaseButton>
            <BaseButton
              variant="ghost"
              :disabled="module.status !== 'running'"
              :loading="actionLoading"
              @click="restartModule"
            >
              Neustarten
            </BaseButton>
          </div>
        </div>

        <!-- WLED-specific: Link to Event Configuration -->
        <BaseCard v-if="module.id === 'wled'" title="Event-Aktionen" subtitle="Konfigurieren Sie die WLED-Aktionen für jedes Event">
          <div class="flex items-center justify-between">
            <p class="text-dark-400">
              Die Event-Aktionen (Farben, Effekte, Spielerfarben) werden separat konfiguriert.
            </p>
            <router-link :to="`/modules/${module.id}/config`">
              <BaseButton>
                Event-Aktionen konfigurieren
              </BaseButton>
            </router-link>
          </div>
        </BaseCard>

        <!-- Game Display-specific: Link to Display Configuration -->
        <BaseCard v-if="module.id === 'game-display'" title="Display Konfiguration" subtitle="Einstellungen und Vorschau für das Game Display">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-dark-400">
                Konfigurieren Sie das Display und öffnen Sie es auf einem externen Bildschirm.
              </p>
              <p class="text-sm text-dark-500 mt-1">
                Das Display zeigt den Spielstand in Echtzeit an.
              </p>
            </div>
            <router-link :to="`/modules/${module.id}/game-display-config`">
              <BaseButton>
                Display konfigurieren
              </BaseButton>
            </router-link>
          </div>
        </BaseCard>

        <!-- Configuration -->
        <BaseCard title="Konfiguration" subtitle="Passen Sie die Modul-Einstellungen an">
          <div v-if="Object.keys(configSchema).length === 0" class="text-center py-8">
            <p class="text-dark-400">Dieses Modul hat keine konfigurierbaren Einstellungen.</p>
          </div>

          <form v-else @submit.prevent="saveConfig" class="space-y-6">
            <div
              v-for="(field, key) in configSchema"
              :key="key"
              class="space-y-1"
            >
              <!-- String/Password Input -->
              <template v-if="field.type === 'string'">
                <BaseInput
                  v-model="configValues[key] as string"
                  :label="field.label"
                  :placeholder="field.description"
                  :required="field.required"
                />
              </template>

              <!-- Number Input -->
              <template v-else-if="field.type === 'number'">
                <label class="block text-sm font-medium text-dark-200">
                  {{ field.label }}
                  <span v-if="field.required" class="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  v-model.number="configValues[key]"
                  :min="field.min"
                  :max="field.max"
                  :required="field.required"
                  class="w-full px-4 py-2.5 rounded-lg bg-dark-800 border border-dark-600 text-white focus:outline-none focus:ring-2 focus:ring-autodarts-500 focus:border-autodarts-500"
                />
                <p v-if="field.description" class="text-sm text-dark-400">{{ field.description }}</p>
              </template>

              <!-- Boolean Toggle -->
              <template v-else-if="field.type === 'boolean'">
                <div class="flex items-center justify-between p-4 rounded-lg bg-dark-700/50">
                  <div>
                    <p class="text-white font-medium">{{ field.label }}</p>
                    <p v-if="field.description" class="text-sm text-dark-400">{{ field.description }}</p>
                  </div>
                  <button
                    type="button"
                    @click="configValues[key] = !configValues[key]"
                    :class="[
                      'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                      configValues[key] ? 'bg-autodarts-600' : 'bg-dark-600',
                    ]"
                  >
                    <span
                      :class="[
                        'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                        configValues[key] ? 'translate-x-6' : 'translate-x-1',
                      ]"
                    />
                  </button>
                </div>
              </template>

              <!-- Select -->
              <template v-else-if="field.type === 'select'">
                <label class="block text-sm font-medium text-dark-200">
                  {{ field.label }}
                  <span v-if="field.required" class="text-red-500">*</span>
                </label>
                <select
                  v-model="configValues[key]"
                  :required="field.required"
                  class="w-full px-4 py-2.5 rounded-lg bg-dark-800 border border-dark-600 text-white focus:outline-none focus:ring-2 focus:ring-autodarts-500 focus:border-autodarts-500"
                >
                  <option
                    v-for="option in field.options"
                    :key="String(option.value)"
                    :value="option.value"
                  >
                    {{ option.label }}
                  </option>
                </select>
                <p v-if="field.description" class="text-sm text-dark-400">{{ field.description }}</p>
              </template>
            </div>

            <!-- Save Message -->
            <div
              v-if="saveMessage"
              :class="[
                'p-3 rounded-lg',
                saveMessage.type === 'success'
                  ? 'bg-green-500/10 text-green-400'
                  : 'bg-red-500/10 text-red-400',
              ]"
            >
              {{ saveMessage.text }}
            </div>

            <!-- Save Button -->
            <div class="flex justify-end">
              <BaseButton type="submit" :loading="isSaving">
                Speichern
              </BaseButton>
            </div>
          </form>
        </BaseCard>

        <!-- Stats -->
        <BaseCard title="Statistiken">
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div class="p-4 rounded-lg bg-dark-700/50">
              <p class="text-sm text-dark-400">Status</p>
              <StatusBadge :status="module.status" class="mt-1" />
            </div>
            <div class="p-4 rounded-lg bg-dark-700/50">
              <p class="text-sm text-dark-400">Neustarts</p>
              <p class="text-xl font-bold text-white mt-1">{{ module.stats.restartCount }}</p>
            </div>
            <div class="p-4 rounded-lg bg-dark-700/50">
              <p class="text-sm text-dark-400">Gestartet</p>
              <p class="text-sm text-white mt-1">
                {{ module.stats.startedAt ? new Date(module.stats.startedAt).toLocaleString('de-DE') : '-' }}
              </p>
            </div>
            <div class="p-4 rounded-lg bg-dark-700/50">
              <p class="text-sm text-dark-400">Events</p>
              <p class="text-xl font-bold text-white mt-1">{{ module.events.length }}</p>
            </div>
          </div>

          <!-- Last Error -->
          <div
            v-if="module.stats.lastError"
            class="mt-4 p-4 rounded-lg bg-red-500/10 border border-red-500/30"
          >
            <p class="text-sm font-medium text-red-400">Letzter Fehler</p>
            <p class="text-sm text-red-300 mt-1 font-mono">{{ module.stats.lastError }}</p>
          </div>
        </BaseCard>

        <!-- Danger Zone -->
        <BaseCard title="Gefahrenzone">
          <div class="flex items-center justify-between p-4 rounded-lg border border-red-500/30 bg-red-500/5">
            <div>
              <p class="text-white font-medium">Modul deinstallieren</p>
              <p class="text-sm text-dark-400">
                Das Modul und alle seine Daten werden unwiderruflich gelöscht.
              </p>
            </div>
            <BaseButton
              variant="danger"
              @click="showDeleteConfirm = true"
            >
              Deinstallieren
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
          <h3 class="text-lg font-semibold text-white">Modul deinstallieren?</h3>
          <p class="text-dark-400 mt-2">
            Sind Sie sicher, dass Sie <strong class="text-white">{{ module?.name }}</strong> deinstallieren möchten?
            Diese Aktion kann nicht rückgängig gemacht werden.
          </p>
          <div class="flex items-center justify-end gap-3 mt-6">
            <BaseButton
              variant="ghost"
              @click="showDeleteConfirm = false"
            >
              Abbrechen
            </BaseButton>
            <BaseButton
              variant="danger"
              :loading="isDeleting"
              @click="deleteModule"
            >
              Deinstallieren
            </BaseButton>
          </div>
        </div>
      </div>
    </Teleport>
  </AppLayout>
</template>
