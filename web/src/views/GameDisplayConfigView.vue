<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useModulesStore } from '../stores/modules'
import AppLayout from '../components/AppLayout.vue'
import BaseCard from '../components/BaseCard.vue'
import BaseButton from '../components/BaseButton.vue'
import BaseInput from '../components/BaseInput.vue'

interface GameDisplayConfig {
  displayName: string
  showCheckouts: boolean
  checkoutThreshold: number
  animationSpeed: 'slow' | 'normal' | 'fast'
  showOtherPlayers: boolean
}

const route = useRoute()
const modulesStore = useModulesStore()

const moduleId = computed(() => route.params.id as string)
const module = computed(() => modulesStore.selectedModule)

// Configuration state
const config = ref<GameDisplayConfig>({
  displayName: 'Main Display',
  showCheckouts: true,
  checkoutThreshold: 170,
  animationSpeed: 'normal',
  showOtherPlayers: true,
})

const isSaving = ref(false)
const saveMessage = ref<{ type: 'success' | 'error'; text: string } | null>(null)

// Load config from module
watch(
  () => module.value?.config.values,
  (values) => {
    if (values) {
      config.value = {
        displayName: (values.displayName as string) || 'Main Display',
        showCheckouts: values.showCheckouts !== false,
        checkoutThreshold: (values.checkoutThreshold as number) || 170,
        animationSpeed: (values.animationSpeed as 'slow' | 'normal' | 'fast') || 'normal',
        showOtherPlayers: values.showOtherPlayers !== false,
      }
    }
  },
  { immediate: true }
)

// Save configuration
async function saveConfig() {
  if (!module.value) return

  isSaving.value = true
  saveMessage.value = null

  try {
    await modulesStore.updateConfig(module.value.id, config.value as unknown as Record<string, unknown>)
    saveMessage.value = { type: 'success', text: 'Konfiguration gespeichert!' }
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

// Open display in new window
function openDisplay() {
  const displayUrl = `${window.location.origin}/module-ui/game-display/`
  window.open(displayUrl, 'GameDisplay', 'width=1920,height=1080')
}

// Copy display URL
async function copyDisplayUrl() {
  const displayUrl = `${window.location.origin}/module-ui/game-display/`
  try {
    await navigator.clipboard.writeText(displayUrl)
    saveMessage.value = { type: 'success', text: 'URL kopiert!' }
    setTimeout(() => {
      saveMessage.value = null
    }, 2000)
  } catch {
    saveMessage.value = { type: 'error', text: 'Kopieren fehlgeschlagen' }
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
        :to="`/modules/${moduleId}`"
        class="inline-flex items-center gap-2 text-dark-400 hover:text-white transition-colors"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
        Zurück zum Modul
      </router-link>

      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-white">Game Display Konfiguration</h1>
          <p class="text-dark-400 mt-1">Einstellungen für die Spielstandsanzeige</p>
        </div>

        <!-- Open Display Button -->
        <div class="flex items-center gap-3">
          <BaseButton variant="secondary" @click="copyDisplayUrl">
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
            </svg>
            URL kopieren
          </BaseButton>
          <BaseButton @click="openDisplay">
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Display öffnen
          </BaseButton>
        </div>
      </div>

      <!-- Display Preview -->
      <BaseCard title="Display Vorschau" subtitle="So sieht das Display auf externen Bildschirmen aus">
        <div class="relative rounded-xl overflow-hidden border border-dark-600 bg-dark-900">
          <!-- Preview Frame -->
          <div class="aspect-video relative">
            <iframe
              src="/module-ui/game-display/"
              class="absolute inset-0 w-full h-full"
              style="pointer-events: none;"
            />
            <!-- Overlay for click handling -->
            <div
              class="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
              @click="openDisplay"
            >
              <div class="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/10 backdrop-blur-sm">
                <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                <span class="text-white font-medium">Im neuen Fenster öffnen</span>
              </div>
            </div>
          </div>
        </div>
        <p class="text-sm text-dark-400 mt-3">
          Klicken Sie auf die Vorschau oder nutzen Sie den Button oben, um das Display in einem neuen Fenster zu öffnen.
          Sie können die URL auch auf einem anderen Gerät im selben Netzwerk öffnen.
        </p>
      </BaseCard>

      <!-- Configuration -->
      <BaseCard title="Einstellungen">
        <form @submit.prevent="saveConfig" class="space-y-6">
          <!-- Display Name -->
          <div>
            <BaseInput
              v-model="config.displayName"
              label="Display Name"
              placeholder="z.B. Hauptdisplay, TV Links, etc."
            />
            <p class="text-sm text-dark-400 mt-1">
              Ein Name zur Identifikation dieses Displays (für zukünftige Multi-Display-Unterstützung)
            </p>
          </div>

          <!-- Show Checkouts -->
          <div class="flex items-center justify-between p-4 rounded-lg bg-dark-700/50 border border-dark-600">
            <div>
              <p class="text-white font-medium">Checkout-Vorschläge anzeigen</p>
              <p class="text-sm text-dark-400 mt-1">
                Zeigt mögliche Checkout-Wege an, wenn ein Finish erreichbar ist
              </p>
            </div>
            <button
              type="button"
              @click="config.showCheckouts = !config.showCheckouts"
              :class="[
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                config.showCheckouts ? 'bg-autodarts-600' : 'bg-dark-600',
              ]"
            >
              <span
                :class="[
                  'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                  config.showCheckouts ? 'translate-x-6' : 'translate-x-1',
                ]"
              />
            </button>
          </div>

          <!-- Checkout Threshold -->
          <div v-if="config.showCheckouts">
            <label class="block text-sm font-medium text-dark-200 mb-2">
              Checkout-Vorschläge ab Punktzahl: {{ config.checkoutThreshold }}
            </label>
            <input
              type="range"
              v-model.number="config.checkoutThreshold"
              min="2"
              max="170"
              class="w-full accent-autodarts-500"
            />
            <div class="flex justify-between text-sm text-dark-400 mt-1">
              <span>2</span>
              <span>170</span>
            </div>
          </div>

          <!-- Animation Speed -->
          <div>
            <label class="block text-sm font-medium text-dark-200 mb-3">Animationsgeschwindigkeit</label>
            <div class="grid grid-cols-3 gap-3">
              <button
                v-for="speed in ['slow', 'normal', 'fast'] as const"
                :key="speed"
                type="button"
                @click="config.animationSpeed = speed"
                :class="[
                  'px-4 py-3 rounded-lg border-2 text-center transition-all',
                  config.animationSpeed === speed
                    ? 'border-autodarts-500 bg-autodarts-500/10 text-white'
                    : 'border-dark-600 text-dark-400 hover:border-dark-500',
                ]"
              >
                {{ speed === 'slow' ? 'Langsam' : speed === 'normal' ? 'Normal' : 'Schnell' }}
              </button>
            </div>
          </div>

          <!-- Show Other Players -->
          <div class="flex items-center justify-between p-4 rounded-lg bg-dark-700/50 border border-dark-600">
            <div>
              <p class="text-white font-medium">Andere Spieler anzeigen</p>
              <p class="text-sm text-dark-400 mt-1">
                Zeigt die Punktestände der anderen Spieler am unteren Bildschirmrand
              </p>
            </div>
            <button
              type="button"
              @click="config.showOtherPlayers = !config.showOtherPlayers"
              :class="[
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                config.showOtherPlayers ? 'bg-autodarts-600' : 'bg-dark-600',
              ]"
            >
              <span
                :class="[
                  'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                  config.showOtherPlayers ? 'translate-x-6' : 'translate-x-1',
                ]"
              />
            </button>
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

      <!-- Usage Info -->
      <BaseCard title="Verwendung">
        <div class="space-y-4">
          <div class="flex items-start gap-4">
            <div class="w-10 h-10 rounded-lg bg-autodarts-500/20 flex items-center justify-center flex-shrink-0">
              <span class="text-autodarts-400 font-bold">1</span>
            </div>
            <div>
              <p class="text-white font-medium">Display öffnen</p>
              <p class="text-dark-400 text-sm mt-1">
                Klicken Sie auf "Display öffnen" oder kopieren Sie die URL und öffnen Sie diese auf einem externen Bildschirm.
              </p>
            </div>
          </div>

          <div class="flex items-start gap-4">
            <div class="w-10 h-10 rounded-lg bg-autodarts-500/20 flex items-center justify-center flex-shrink-0">
              <span class="text-autodarts-400 font-bold">2</span>
            </div>
            <div>
              <p class="text-white font-medium">Spiel starten</p>
              <p class="text-dark-400 text-sm mt-1">
                Starten Sie ein Match in Autodarts. Das Display aktualisiert sich automatisch in Echtzeit.
              </p>
            </div>
          </div>

          <div class="flex items-start gap-4">
            <div class="w-10 h-10 rounded-lg bg-autodarts-500/20 flex items-center justify-center flex-shrink-0">
              <span class="text-autodarts-400 font-bold">3</span>
            </div>
            <div>
              <p class="text-white font-medium">Spielen!</p>
              <p class="text-dark-400 text-sm mt-1">
                Der aktuelle Punktestand, Checkout-Vorschläge und alle Würfe werden live angezeigt.
              </p>
            </div>
          </div>
        </div>
      </BaseCard>
    </div>
  </AppLayout>
</template>
