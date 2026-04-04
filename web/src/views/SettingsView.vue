<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { api } from '../api/client'
import AppLayout from '../components/AppLayout.vue'
import BaseCard from '../components/BaseCard.vue'
import BaseButton from '../components/BaseButton.vue'
import BaseInput from '../components/BaseInput.vue'
import { SUPPORTED_LOCALES, setLocale, getLocale, type SupportedLocale } from '../i18n'

const { t } = useI18n()

interface Settings {
  server: { port: number; host: string }
  webAuth: { enabled: boolean; username: string }
  autodarts: { email: string; boardId: string }
  developerMode?: boolean
}

const currentLocale = ref<SupportedLocale>(getLocale())

function changeLocale(locale: SupportedLocale) {
  currentLocale.value = locale
  setLocale(locale)
}

const settings = ref<Settings | null>(null)
const isLoading = ref(true)
const isSaving = ref(false)
const message = ref<{ type: 'success' | 'error'; text: string } | null>(null)

// Form values
const serverPort = ref(3000)
const serverHost = ref('0.0.0.0')
const webAuthEnabled = ref(false)
const webAuthUsername = ref('')
const webAuthPassword = ref('')
const autodartsEmail = ref('')
const autodartsPassword = ref('')
const boardId = ref('')

// Developer mode
const developerMode = ref(false)

async function loadSettings() {
  isLoading.value = true
  try {
    settings.value = await api.getSettings()
    serverPort.value = settings.value.server.port
    serverHost.value = settings.value.server.host
    webAuthEnabled.value = settings.value.webAuth.enabled
    webAuthUsername.value = settings.value.webAuth.username
    autodartsEmail.value = settings.value.autodarts.email
    boardId.value = settings.value.autodarts.boardId
    developerMode.value = settings.value.developerMode ?? false
  } catch (e) {
    message.value = {
      type: 'error',
      text: e instanceof Error ? e.message : t('settings.saveFailed'),
    }
  } finally {
    isLoading.value = false
  }
}

async function saveSettings() {
  isSaving.value = true
  message.value = null

  try {
    const updates: Parameters<typeof api.updateSettings>[0] = {}

    // Server settings
    if (serverPort.value !== settings.value?.server.port || serverHost.value !== settings.value?.server.host) {
      updates.server = {
        port: serverPort.value,
        host: serverHost.value,
      }
    }

    // Web auth settings
    if (
      webAuthEnabled.value !== settings.value?.webAuth.enabled ||
      webAuthUsername.value !== settings.value?.webAuth.username ||
      webAuthPassword.value
    ) {
      updates.webAuth = {
        enabled: webAuthEnabled.value,
        username: webAuthUsername.value,
        ...(webAuthPassword.value ? { password: webAuthPassword.value } : {}),
      }
    }

    // Autodarts settings
    if (
      autodartsEmail.value !== settings.value?.autodarts.email ||
      boardId.value !== settings.value?.autodarts.boardId ||
      autodartsPassword.value
    ) {
      updates.autodarts = {
        email: autodartsEmail.value,
        boardId: boardId.value,
        ...(autodartsPassword.value ? { password: autodartsPassword.value } : {}),
      }
    }

    // Developer mode
    if (developerMode.value !== (settings.value?.developerMode ?? false)) {
      updates.developerMode = developerMode.value
    }

    if (Object.keys(updates).length === 0) {
      message.value = { type: 'success', text: t('settings.saved') }
      return
    }

    const result = await api.updateSettings(updates)

    if (result.success) {
      message.value = { type: 'success', text: t('settings.saved') }
      // Clear password fields
      webAuthPassword.value = ''
      autodartsPassword.value = ''
      // Reload settings
      await loadSettings()
    } else {
      message.value = { type: 'error', text: result.error || t('settings.saveFailed') }
    }
  } catch (e) {
    message.value = {
      type: 'error',
      text: e instanceof Error ? e.message : t('settings.saveFailed'),
    }
  } finally {
    isSaving.value = false
  }
}

onMounted(loadSettings)
</script>

<template>
  <AppLayout>
    <div class="space-y-6 max-w-2xl">
      <!-- Header -->
      <div>
        <h1 class="text-2xl font-bold text-white">{{ t('settings.title') }}</h1>
        <p class="text-dark-400">{{ t('settings.subtitle') }}</p>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="flex items-center justify-center py-12">
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

      <form v-else @submit.prevent="saveSettings" class="space-y-6">
        <!-- Support / Donation -->
        <BaseCard :title="t('settings.support')" :subtitle="t('settings.supportDescription')">
          <div class="flex items-center justify-between p-4 rounded-lg bg-dark-700/50">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
                <svg class="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944 3.72a.641.641 0 0 1 .632-.54h6.012c2.656 0 4.526.84 5.137 2.997.168.632.22 1.2.168 1.74-.32 2.98-2.38 4.42-5.137 4.42H9.412l-.84 5.28c-.084.42-.42.72-.84.72H5.984l.168-1.08h.756c.168 0 .336-.12.336-.3l.672-4.2h2.436c2.016 0 3.612-.78 4.032-2.88.336-1.68-.336-2.76-2.016-2.76H7.16l-2.1 13.26h2.016v-.04zm13.944-14.4c0 .12 0 .24-.024.36-.588 3.72-3.276 5.16-6.54 5.16h-1.26l-.84 5.28a.641.641 0 0 1-.632.54H8.788a.321.321 0 0 1-.312-.36l.024-.156.756-4.764.024-.132a.641.641 0 0 1 .632-.54h1.68c3.444 0 6.144-1.404 6.936-5.46.336-1.68.168-3.084-.756-4.068.276.696.42 1.5.42 2.4l-.172-.26z"/>
                </svg>
              </div>
              <div>
                <p class="text-white font-medium">{{ t('settings.donatePaypal') }}</p>
                <p class="text-sm text-dark-400">{{ t('settings.donateDescription') }}</p>
              </div>
            </div>
            <a
              href="https://www.paypal.com/donate?business=info@castorlighting.de&currency_code=EUR"
              target="_blank"
              rel="noopener noreferrer"
              class="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors flex items-center gap-2"
            >
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944 3.72a.641.641 0 0 1 .632-.54h6.012c2.656 0 4.526.84 5.137 2.997.168.632.22 1.2.168 1.74-.32 2.98-2.38 4.42-5.137 4.42H9.412l-.84 5.28c-.084.42-.42.72-.84.72H5.984l.168-1.08h.756c.168 0 .336-.12.336-.3l.672-4.2h2.436c2.016 0 3.612-.78 4.032-2.88.336-1.68-.336-2.76-2.016-2.76H7.16l-2.1 13.26h2.016v-.04zm13.944-14.4c0 .12 0 .24-.024.36-.588 3.72-3.276 5.16-6.54 5.16h-1.26l-.84 5.28a.641.641 0 0 1-.632.54H8.788a.321.321 0 0 1-.312-.36l.024-.156.756-4.764.024-.132a.641.641 0 0 1 .632-.54h1.68c3.444 0 6.144-1.404 6.936-5.46.336-1.68.168-3.084-.756-4.068.276.696.42 1.5.42 2.4l-.172-.26z"/>
              </svg>
              PayPal
            </a>
          </div>
        </BaseCard>

        <!-- Language Settings -->
        <BaseCard :title="t('settings.appearance')" :subtitle="t('settings.languageDescription')">
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-dark-200 mb-3">{{ t('settings.language') }}</label>
              <div class="grid grid-cols-3 gap-3">
                <button
                  v-for="locale in SUPPORTED_LOCALES"
                  :key="locale.code"
                  type="button"
                  @click="changeLocale(locale.code)"
                  :class="[
                    'flex items-center gap-3 p-4 rounded-lg border transition-all',
                    currentLocale === locale.code
                      ? 'bg-autodarts-600/20 border-autodarts-500 text-white'
                      : 'bg-dark-700/50 border-dark-600 text-dark-300 hover:bg-dark-700 hover:border-dark-500',
                  ]"
                >
                  <span class="text-2xl">{{ locale.flag }}</span>
                  <span class="font-medium">{{ locale.name }}</span>
                </button>
              </div>
            </div>
          </div>
        </BaseCard>

        <!-- Server Settings -->
        <BaseCard :title="t('settings.server')" :subtitle="t('settings.serverDescription')">
          <div class="grid grid-cols-2 gap-4">
            <BaseInput
              v-model="serverHost"
              label="Host"
              placeholder="0.0.0.0"
            />
            <div>
              <label class="block text-sm font-medium text-dark-200">Port</label>
              <input
                type="number"
                v-model.number="serverPort"
                min="1"
                max="65535"
                class="w-full px-4 py-2.5 rounded-lg bg-dark-800 border border-dark-600 text-white focus:outline-none focus:ring-2 focus:ring-autodarts-500 focus:border-autodarts-500"
              />
            </div>
          </div>
          <p class="text-sm text-dark-400 mt-4">
            {{ t('settings.serverRestartRequired') }}
          </p>
        </BaseCard>

        <!-- Web Auth Settings -->
        <BaseCard :title="t('settings.webAuth')" :subtitle="t('settings.webAuthDescription')">
          <div class="space-y-4">
            <!-- Toggle -->
            <div class="flex items-center justify-between p-4 rounded-lg bg-dark-700/50">
              <div>
                <p class="text-white font-medium">{{ t('settings.authEnabled') }}</p>
                <p class="text-sm text-dark-400">
                  {{ webAuthEnabled ? t('settings.loginRequired') : t('settings.noLoginRequired') }}
                </p>
              </div>
              <button
                type="button"
                @click="webAuthEnabled = !webAuthEnabled"
                :class="[
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  webAuthEnabled ? 'bg-autodarts-600' : 'bg-dark-600',
                ]"
              >
                <span
                  :class="[
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                    webAuthEnabled ? 'translate-x-6' : 'translate-x-1',
                  ]"
                />
              </button>
            </div>

            <template v-if="webAuthEnabled">
              <BaseInput
                v-model="webAuthUsername"
                :label="t('auth.username')"
                placeholder="admin"
              />
              <BaseInput
                v-model="webAuthPassword"
                type="password"
                :label="t('settings.newPassword')"
                :placeholder="t('settings.leaveEmptyToKeep')"
              />
            </template>
          </div>
        </BaseCard>

        <!-- Autodarts Settings -->
        <BaseCard :title="t('settings.autodartsAccount')" :subtitle="t('settings.autodartsAccountDescription')">
          <div class="space-y-4">
            <BaseInput
              v-model="autodartsEmail"
              type="email"
              :label="t('setup.email')"
              :placeholder="t('setup.emailPlaceholder')"
            />
            <BaseInput
              v-model="autodartsPassword"
              type="password"
              :label="t('settings.newPassword')"
              :placeholder="t('settings.leaveEmptyToKeep')"
            />
            <BaseInput
              v-model="boardId"
              :label="t('settings.boardId')"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            />
          </div>
        </BaseCard>

        <!-- Developer Mode -->
        <BaseCard :title="t('settings.developerMode')" :subtitle="t('settings.developerModeDescription')">
          <div class="flex items-center justify-between p-4 rounded-lg bg-dark-700/50">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              </div>
              <div>
                <p class="text-white font-medium">{{ t('settings.developerModeEnabled') }}</p>
                <p class="text-sm text-dark-400">{{ t('settings.developerModeHint') }}</p>
              </div>
            </div>
            <button
              type="button"
              @click="developerMode = !developerMode"
              :class="[
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                developerMode ? 'bg-autodarts-600' : 'bg-dark-600',
              ]"
            >
              <span
                :class="[
                  'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                  developerMode ? 'translate-x-6' : 'translate-x-1',
                ]"
              />
            </button>
          </div>
          <div v-if="developerMode" class="mt-4 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <p class="text-amber-400 text-sm">
              {{ t('settings.developerModeWarning') }}
            </p>
            <router-link
              to="/developer"
              class="inline-flex items-center gap-2 mt-3 text-autodarts-400 hover:text-autodarts-300"
            >
              {{ t('settings.openDevTools') }}
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </router-link>
          </div>
        </BaseCard>

        <!-- Message -->
        <div
          v-if="message"
          :class="[
            'p-4 rounded-lg',
            message.type === 'success'
              ? 'bg-green-500/10 border border-green-500/30 text-green-400'
              : 'bg-red-500/10 border border-red-500/30 text-red-400',
          ]"
        >
          {{ message.text }}
        </div>

        <!-- Save Button -->
        <div class="flex justify-end">
          <BaseButton type="submit" :loading="isSaving">
            {{ t('common.save') }}
          </BaseButton>
        </div>
      </form>
    </div>
  </AppLayout>
</template>
