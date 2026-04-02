<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { api } from '../api/client'
import { useAppStore } from '../stores/app'
import BaseButton from '../components/BaseButton.vue'
import BaseInput from '../components/BaseInput.vue'

const { t } = useI18n()
const router = useRouter()
const appStore = useAppStore()

// State
const currentStep = ref(1)
const totalSteps = 3
const isLoading = ref(false)
const error = ref<string | null>(null)

// Step 1: Web Auth
const webAuthEnabled = ref(false)
const webUsername = ref('')
const webPassword = ref('')
const webPasswordConfirm = ref('')

// Step 2: Autodarts
const autodartsEmail = ref('')
const autodartsPassword = ref('')
const boardId = ref('')
const connectionTested = ref(false)
const connectionSuccess = ref(false)
const connectionInfo = ref<{ userId?: string; boardName?: string } | null>(null)

// Validation
const step1Valid = computed(() => {
  if (!webAuthEnabled.value) return true
  return (
    webUsername.value.length >= 3 &&
    webPassword.value.length >= 6 &&
    webPassword.value === webPasswordConfirm.value
  )
})

const step2Valid = computed(() => {
  return (
    autodartsEmail.value.includes('@') &&
    autodartsPassword.value.length > 0 &&
    boardId.value.length > 0
  )
})

const passwordMismatch = computed(() => {
  return (
    webAuthEnabled.value &&
    webPasswordConfirm.value.length > 0 &&
    webPassword.value !== webPasswordConfirm.value
  )
})

// Actions
async function testConnection() {
  if (!step2Valid.value) return

  isLoading.value = true
  error.value = null
  connectionTested.value = false

  try {
    const result = await api.testConnection(
      autodartsEmail.value,
      autodartsPassword.value,
      boardId.value
    )

    connectionTested.value = true
    connectionSuccess.value = result.success

    if (result.success) {
      connectionInfo.value = {
        userId: result.userId,
        boardName: result.boardName,
      }
    } else {
      error.value = result.error || t('setup.connectionFailed')
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : t('setup.connectionTestFailed')
  } finally {
    isLoading.value = false
  }
}

async function completeSetup() {
  isLoading.value = true
  error.value = null

  try {
    const result = await api.completeSetup({
      webAuth: {
        enabled: webAuthEnabled.value,
        username: webAuthEnabled.value ? webUsername.value : undefined,
        password: webAuthEnabled.value ? webPassword.value : undefined,
      },
      autodarts: {
        email: autodartsEmail.value,
        password: autodartsPassword.value,
        boardId: boardId.value,
      },
    })

    if (result.success) {
      appStore.setSetupComplete()
      // If auth is enabled, redirect to login, otherwise to dashboard
      if (webAuthEnabled.value) {
        router.push('/login')
      } else {
        await appStore.initialize()
        router.push('/')
      }
    } else {
      error.value = result.message
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : t('setup.setupFailed')
  } finally {
    isLoading.value = false
  }
}

function nextStep() {
  if (currentStep.value < totalSteps) {
    currentStep.value++
    error.value = null
  }
}

function prevStep() {
  if (currentStep.value > 1) {
    currentStep.value--
    error.value = null
  }
}
</script>

<template>
  <div class="min-h-screen bg-dark-900 flex items-center justify-center p-4">
    <div class="w-full max-w-lg">
      <!-- Header -->
      <div class="text-center mb-8">
        <div
          class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-autodarts-600 flex items-center justify-center"
        >
          <svg class="w-10 h-10 text-white" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" />
            <circle cx="12" cy="12" r="6" stroke="currentColor" stroke-width="2" fill="none" />
            <circle cx="12" cy="12" r="2" fill="currentColor" />
          </svg>
        </div>
        <h1 class="text-2xl font-bold text-white">IO-Darts-Agent</h1>
        <p class="text-dark-400 mt-1">{{ t('setup.initialSetup') }}</p>
      </div>

      <!-- Progress Steps -->
      <div class="flex items-center justify-center gap-2 mb-8">
        <template v-for="step in totalSteps" :key="step">
          <div
            :class="[
              'w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
              step < currentStep
                ? 'bg-autodarts-600 text-white'
                : step === currentStep
                ? 'bg-autodarts-600 text-white ring-4 ring-autodarts-600/30'
                : 'bg-dark-700 text-dark-400',
            ]"
          >
            <svg
              v-if="step < currentStep"
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span v-else>{{ step }}</span>
          </div>
          <div
            v-if="step < totalSteps"
            :class="[
              'w-12 h-0.5',
              step < currentStep ? 'bg-autodarts-600' : 'bg-dark-700',
            ]"
          />
        </template>
      </div>

      <!-- Card -->
      <div class="bg-dark-800 rounded-2xl border border-dark-700 overflow-hidden">
        <!-- Step 1: Security -->
        <div v-if="currentStep === 1" class="p-6">
          <h2 class="text-lg font-semibold text-white mb-1">{{ t('setup.security') }}</h2>
          <p class="text-sm text-dark-400 mb-6">
            {{ t('setup.securityDesc') }}
          </p>

          <div class="space-y-6">
            <!-- Toggle -->
            <div class="flex items-center justify-between p-4 rounded-lg bg-dark-700/50">
              <div>
                <p class="text-white font-medium">{{ t('setup.enableWebAuth') }}</p>
                <p class="text-sm text-dark-400">
                  {{ webAuthEnabled ? t('setup.loginRequired') : t('setup.noLoginRequired') }}
                </p>
              </div>
              <button
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

            <!-- Auth Fields -->
            <div v-if="webAuthEnabled" class="space-y-4">
              <BaseInput
                v-model="webUsername"
                :label="t('auth.username')"
                placeholder="admin"
                autocomplete="username"
                :required="webAuthEnabled"
              />
              <BaseInput
                v-model="webPassword"
                type="password"
                :label="t('auth.password')"
                :placeholder="t('setup.minChars')"
                autocomplete="new-password"
                :required="webAuthEnabled"
              />
              <BaseInput
                v-model="webPasswordConfirm"
                type="password"
                :label="t('setup.confirmPassword')"
                :placeholder="t('setup.repeatPassword')"
                autocomplete="new-password"
                :required="webAuthEnabled"
                :error="passwordMismatch ? t('setup.passwordMismatch') : undefined"
              />
            </div>
          </div>
        </div>

        <!-- Step 2: Autodarts Connection -->
        <div v-else-if="currentStep === 2" class="p-6">
          <h2 class="text-lg font-semibold text-white mb-1">{{ t('setup.autodartsConnection') }}</h2>
          <p class="text-sm text-dark-400 mb-6">
            {{ t('setup.enterCredentials') }}
          </p>

          <div class="space-y-4">
            <BaseInput
              v-model="autodartsEmail"
              type="email"
              :label="t('setup.email')"
              :placeholder="t('setup.emailPlaceholder')"
              autocomplete="email"
              required
            />
            <BaseInput
              v-model="autodartsPassword"
              type="password"
              :label="t('auth.password')"
              :placeholder="t('setup.passwordPlaceholder')"
              autocomplete="current-password"
              required
            />
            <BaseInput
              v-model="boardId"
              :label="t('setup.boardId')"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              required
            />

            <!-- Connection Test Result -->
            <div v-if="connectionTested" class="mt-4">
              <div
                v-if="connectionSuccess"
                class="p-4 rounded-lg bg-green-500/10 border border-green-500/30"
              >
                <div class="flex items-center gap-2 text-green-400">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span class="font-medium">{{ t('setup.connectionSuccess') }}</span>
                </div>
                <p v-if="connectionInfo?.boardName" class="text-sm text-dark-300 mt-1">
                  Board: {{ connectionInfo.boardName }}
                </p>
              </div>
              <div
                v-else
                class="p-4 rounded-lg bg-red-500/10 border border-red-500/30"
              >
                <div class="flex items-center gap-2 text-red-400">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                  <span class="font-medium">{{ t('setup.connectionFailed') }}</span>
                </div>
                <p v-if="error" class="text-sm text-red-300 mt-1">{{ error }}</p>
              </div>
            </div>

            <!-- Test Button -->
            <BaseButton
              variant="secondary"
              :loading="isLoading"
              :disabled="!step2Valid"
              class="w-full mt-2"
              @click="testConnection"
            >
              {{ t('setup.testConnection') }}
            </BaseButton>
          </div>
        </div>

        <!-- Step 3: Complete -->
        <div v-else-if="currentStep === 3" class="p-6 text-center">
          <div
            class="w-16 h-16 mx-auto mb-4 rounded-full bg-autodarts-600/20 flex items-center justify-center"
          >
            <svg
              class="w-8 h-8 text-autodarts-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 class="text-lg font-semibold text-white mb-2">{{ t('setup.allReady') }}</h2>
          <p class="text-dark-400 mb-6">
            {{ t('setup.clickFinish') }}
          </p>

          <!-- Summary -->
          <div class="text-left space-y-3 p-4 rounded-lg bg-dark-700/50">
            <div class="flex items-center justify-between">
              <span class="text-dark-400">{{ t('setup.webAuth') }}</span>
              <span class="text-white">{{ webAuthEnabled ? t('common.enabled') : t('common.disabled') }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-dark-400">{{ t('setup.autodartsEmail') }}</span>
              <span class="text-white">{{ autodartsEmail }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-dark-400">{{ t('setup.boardId') }}</span>
              <span class="text-white font-mono text-sm">{{ boardId.slice(0, 8) }}...</span>
            </div>
          </div>

          <!-- Error -->
          <div
            v-if="error"
            class="mt-4 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-left"
          >
            <p class="text-sm text-red-400">{{ error }}</p>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 bg-dark-850 border-t border-dark-700 flex items-center justify-between">
          <BaseButton
            v-if="currentStep > 1"
            variant="ghost"
            @click="prevStep"
          >
            {{ t('common.back') }}
          </BaseButton>
          <div v-else />

          <BaseButton
            v-if="currentStep < totalSteps"
            :disabled="(currentStep === 1 && !step1Valid) || (currentStep === 2 && !step2Valid)"
            @click="nextStep"
          >
            {{ t('common.next') }}
          </BaseButton>
          <BaseButton
            v-else
            :loading="isLoading"
            @click="completeSetup"
          >
            {{ t('setup.finishSetup') }}
          </BaseButton>
        </div>
      </div>
    </div>
  </div>
</template>
