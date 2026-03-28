<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { api } from '../api/client'
import AppLayout from '../components/AppLayout.vue'
import BaseCard from '../components/BaseCard.vue'
import BaseButton from '../components/BaseButton.vue'
import BaseInput from '../components/BaseInput.vue'

interface Settings {
  server: { port: number; host: string }
  webAuth: { enabled: boolean; username: string }
  autodarts: { email: string; boardId: string }
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
  } catch (e) {
    message.value = {
      type: 'error',
      text: e instanceof Error ? e.message : 'Fehler beim Laden der Einstellungen',
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

    if (Object.keys(updates).length === 0) {
      message.value = { type: 'success', text: 'Keine Änderungen vorgenommen' }
      return
    }

    const result = await api.updateSettings(updates)

    if (result.success) {
      message.value = { type: 'success', text: 'Einstellungen gespeichert' }
      // Clear password fields
      webAuthPassword.value = ''
      autodartsPassword.value = ''
      // Reload settings
      await loadSettings()
    } else {
      message.value = { type: 'error', text: result.error || 'Fehler beim Speichern' }
    }
  } catch (e) {
    message.value = {
      type: 'error',
      text: e instanceof Error ? e.message : 'Fehler beim Speichern',
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
        <h1 class="text-2xl font-bold text-white">Einstellungen</h1>
        <p class="text-dark-400">Konfigurieren Sie Ihren IO-Darts-Agent</p>
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
        <!-- Server Settings -->
        <BaseCard title="Server" subtitle="HTTP-Server Konfiguration">
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
            Änderungen am Server erfordern einen Neustart des Hubs.
          </p>
        </BaseCard>

        <!-- Web Auth Settings -->
        <BaseCard title="Web-Authentifizierung" subtitle="Schützen Sie den Zugriff auf das Web-Interface">
          <div class="space-y-4">
            <!-- Toggle -->
            <div class="flex items-center justify-between p-4 rounded-lg bg-dark-700/50">
              <div>
                <p class="text-white font-medium">Authentifizierung aktiviert</p>
                <p class="text-sm text-dark-400">
                  {{ webAuthEnabled ? 'Login erforderlich' : 'Kein Login erforderlich' }}
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
                label="Benutzername"
                placeholder="admin"
              />
              <BaseInput
                v-model="webAuthPassword"
                type="password"
                label="Neues Passwort"
                placeholder="Leer lassen um beizubehalten"
              />
            </template>
          </div>
        </BaseCard>

        <!-- Autodarts Settings -->
        <BaseCard title="Autodarts" subtitle="Verbindung zu Ihrem Autodarts-Board">
          <div class="space-y-4">
            <BaseInput
              v-model="autodartsEmail"
              type="email"
              label="E-Mail"
              placeholder="ihre@email.de"
            />
            <BaseInput
              v-model="autodartsPassword"
              type="password"
              label="Neues Passwort"
              placeholder="Leer lassen um beizubehalten"
            />
            <BaseInput
              v-model="boardId"
              label="Board-ID"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            />
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
            Einstellungen speichern
          </BaseButton>
        </div>
      </form>
    </div>
  </AppLayout>
</template>
