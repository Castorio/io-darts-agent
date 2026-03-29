<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useModulesStore } from '../stores/modules'
import { usePlayersStore } from '../stores/players'
import AppLayout from '../components/AppLayout.vue'
import BaseCard from '../components/BaseCard.vue'
import BaseButton from '../components/BaseButton.vue'
import BaseInput from '../components/BaseInput.vue'
import MediaUpload from '../components/MediaUpload.vue'

// Animation event types
type AnimationEventType =
  | '180'
  | 'bull'
  | 'doubleBull'
  | 'highScore'
  | 'checkout'
  | 'legWin'
  | 'setWin'
  | 'matchWin'
  | 'bust'

interface AnimationConfig {
  enabled: boolean
  url: string
  duration: number
  sound?: string
}

interface PlayerAnimations {
  playerId?: string
  playerName?: string
  animations: Partial<Record<AnimationEventType, AnimationConfig>>
}

interface GameDisplayConfig {
  displayName: string
  showCheckouts: boolean
  checkoutThreshold: number
  animationSpeed: 'slow' | 'normal' | 'fast'
  showOtherPlayers: boolean
  // Animation settings
  animationsEnabled: boolean
  defaultAnimations: Partial<Record<AnimationEventType, AnimationConfig>>
  playerAnimations: PlayerAnimations[]
}

// Animation event definitions for UI
const animationEvents: Array<{ key: AnimationEventType; label: string; description: string }> = [
  { key: '180', label: '180', description: 'Perfekte Aufnahme (3x Triple 20)' },
  { key: 'highScore', label: 'High Score (140+)', description: 'Aufnahme mit 140 oder mehr Punkten' },
  { key: 'bull', label: 'Bull', description: 'Single Bull (25 Punkte)' },
  { key: 'doubleBull', label: 'Double Bull', description: 'Bull\'s Eye (50 Punkte)' },
  { key: 'checkout', label: 'Checkout', description: 'Erfolgreiches Finish auf 0' },
  { key: 'legWin', label: 'Leg Gewinn', description: 'Ein Leg gewonnen' },
  { key: 'setWin', label: 'Set Gewinn', description: 'Ein Set gewonnen' },
  { key: 'matchWin', label: 'Match Gewinn', description: 'Das Match gewonnen' },
  { key: 'bust', label: 'Bust', description: 'Überworfen / ungültiger Wurf' },
]

const route = useRoute()
const modulesStore = useModulesStore()
const playersStore = usePlayersStore()

const moduleId = computed(() => route.params.id as string)
const module = computed(() => modulesStore.selectedModule)

// Configuration state
const config = ref<GameDisplayConfig>({
  displayName: 'Main Display',
  showCheckouts: true,
  checkoutThreshold: 170,
  animationSpeed: 'normal',
  showOtherPlayers: true,
  animationsEnabled: true,
  defaultAnimations: {},
  playerAnimations: [],
})

// Currently editing animation
const editingAnimation = ref<{ eventKey: AnimationEventType; isPlayer: boolean; playerIndex?: number } | null>(null)
const editAnimationForm = ref<{ enabled: boolean; url: string; duration: number; sound: string }>({
  enabled: false,
  url: '',
  duration: 3000,
  sound: '',
})

// Player-specific animations UI state
const selectedPlayerForAnimations = ref<string | null>(null)
const showPlayerAnimationModal = ref(false)

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
        animationsEnabled: values.animationsEnabled !== false,
        defaultAnimations: (values.defaultAnimations as Partial<Record<AnimationEventType, AnimationConfig>>) || {},
        playerAnimations: (values.playerAnimations as PlayerAnimations[]) || [],
      }
    }
  },
  { immediate: true }
)

// Animation helper functions
function getAnimationConfig(eventKey: AnimationEventType): AnimationConfig | undefined {
  return config.value.defaultAnimations[eventKey]
}

function isAnimationEnabled(eventKey: AnimationEventType): boolean {
  return config.value.defaultAnimations[eventKey]?.enabled || false
}

function openAnimationEditor(eventKey: AnimationEventType) {
  editingAnimation.value = { eventKey, isPlayer: false }
  const existing = config.value.defaultAnimations[eventKey]
  editAnimationForm.value = existing
    ? { enabled: existing.enabled, url: existing.url, duration: existing.duration, sound: existing.sound || '' }
    : { enabled: true, url: '', duration: 3000, sound: '' }
}

function saveAnimationConfig() {
  if (!editingAnimation.value) return

  const { eventKey } = editingAnimation.value
  config.value.defaultAnimations[eventKey] = { ...editAnimationForm.value }
  editingAnimation.value = null
}

function removeAnimationConfig(eventKey: AnimationEventType) {
  delete config.value.defaultAnimations[eventKey]
}

function closeAnimationEditor() {
  editingAnimation.value = null
}

// Player-specific animation functions
function getPlayerAnimations(playerName: string): PlayerAnimations | undefined {
  return config.value.playerAnimations.find(
    (pa) => pa.playerName?.toLowerCase() === playerName.toLowerCase()
  )
}

function hasPlayerAnimations(playerName: string): boolean {
  const pa = getPlayerAnimations(playerName)
  if (!pa) return false
  return Object.values(pa.animations).some((a) => a?.enabled)
}

function getPlayerAnimationCount(playerName: string): number {
  const pa = getPlayerAnimations(playerName)
  if (!pa) return 0
  return Object.values(pa.animations).filter((a) => a?.enabled).length
}

function openPlayerAnimationEditor(playerName: string) {
  selectedPlayerForAnimations.value = playerName
  showPlayerAnimationModal.value = true
}

function getPlayerAnimationConfig(playerName: string, eventKey: AnimationEventType): AnimationConfig | undefined {
  const pa = getPlayerAnimations(playerName)
  return pa?.animations[eventKey]
}

function isPlayerAnimationEnabled(playerName: string, eventKey: AnimationEventType): boolean {
  return getPlayerAnimationConfig(playerName, eventKey)?.enabled || false
}

function openPlayerEventAnimationEditor(playerName: string, eventKey: AnimationEventType) {
  const playerIndex = config.value.playerAnimations.findIndex(
    (pa) => pa.playerName?.toLowerCase() === playerName.toLowerCase()
  )

  editingAnimation.value = { eventKey, isPlayer: true, playerIndex: playerIndex >= 0 ? playerIndex : undefined }

  const existing = getPlayerAnimationConfig(playerName, eventKey)
  editAnimationForm.value = existing
    ? { enabled: existing.enabled, url: existing.url, duration: existing.duration, sound: existing.sound || '' }
    : { enabled: true, url: '', duration: 3000, sound: '' }
}

function savePlayerAnimationConfig() {
  if (!editingAnimation.value || !selectedPlayerForAnimations.value) return

  const { eventKey, playerIndex } = editingAnimation.value
  const playerName = selectedPlayerForAnimations.value

  if (playerIndex !== undefined && playerIndex >= 0) {
    // Update existing player animations
    config.value.playerAnimations[playerIndex].animations[eventKey] = { ...editAnimationForm.value }
  } else {
    // Create new player animations entry
    config.value.playerAnimations.push({
      playerName,
      animations: {
        [eventKey]: { ...editAnimationForm.value },
      },
    })
  }

  editingAnimation.value = null
}

function removePlayerAnimationConfig(playerName: string, eventKey: AnimationEventType) {
  const pa = config.value.playerAnimations.find(
    (p) => p.playerName?.toLowerCase() === playerName.toLowerCase()
  )
  if (pa) {
    delete pa.animations[eventKey]
  }
}

function closePlayerAnimationModal() {
  showPlayerAnimationModal.value = false
  selectedPlayerForAnimations.value = null
}

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
  playersStore.fetchPlayers()
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

      <!-- Animations Configuration -->
      <BaseCard title="Animationen" subtitle="GIF- oder Video-Animationen für besondere Ereignisse">
        <!-- Enable Animations Toggle -->
        <div class="flex items-center justify-between p-4 rounded-lg bg-dark-700/50 border border-dark-600 mb-6">
          <div>
            <p class="text-white font-medium">Animationen aktivieren</p>
            <p class="text-sm text-dark-400 mt-1">
              Zeigt Animationen bei besonderen Ereignissen wie 180, Checkout etc.
            </p>
          </div>
          <button
            type="button"
            @click="config.animationsEnabled = !config.animationsEnabled"
            :class="[
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
              config.animationsEnabled ? 'bg-autodarts-600' : 'bg-dark-600',
            ]"
          >
            <span
              :class="[
                'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                config.animationsEnabled ? 'translate-x-6' : 'translate-x-1',
              ]"
            />
          </button>
        </div>

        <!-- Animation Events List -->
        <div v-if="config.animationsEnabled" class="space-y-3">
          <div
            v-for="event in animationEvents"
            :key="event.key"
            class="flex items-center justify-between p-4 rounded-lg border transition-all"
            :class="isAnimationEnabled(event.key)
              ? 'border-autodarts-500/50 bg-autodarts-500/5'
              : 'border-dark-600 bg-dark-700/30'"
          >
            <div class="flex-1">
              <div class="flex items-center gap-3">
                <p class="text-white font-medium">{{ event.label }}</p>
                <span
                  v-if="isAnimationEnabled(event.key)"
                  class="px-2 py-0.5 rounded-full bg-autodarts-500/20 text-autodarts-400 text-xs"
                >
                  Aktiv
                </span>
              </div>
              <p class="text-sm text-dark-400 mt-1">{{ event.description }}</p>
              <p
                v-if="getAnimationConfig(event.key)?.url"
                class="text-xs text-dark-500 mt-1 truncate max-w-md"
              >
                {{ getAnimationConfig(event.key)?.url }}
              </p>
            </div>
            <div class="flex items-center gap-2">
              <BaseButton
                variant="ghost"
                size="sm"
                @click="openAnimationEditor(event.key)"
              >
                {{ isAnimationEnabled(event.key) ? 'Bearbeiten' : 'Einrichten' }}
              </BaseButton>
              <BaseButton
                v-if="isAnimationEnabled(event.key)"
                variant="ghost"
                size="sm"
                @click="removeAnimationConfig(event.key)"
              >
                <svg class="w-4 h-4 text-dark-400 hover:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </BaseButton>
            </div>
          </div>
        </div>

        <!-- Info when disabled -->
        <div v-else class="text-center py-8">
          <svg class="w-12 h-12 mx-auto text-dark-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p class="text-dark-400 mt-3">Aktivieren Sie Animationen, um besondere Ereignisse hervorzuheben</p>
        </div>

        <!-- Player-Specific Animations Section -->
        <div v-if="config.animationsEnabled && playersStore.players.length > 0" class="mt-8 pt-6 border-t border-dark-700">
          <h4 class="text-lg font-medium text-white mb-4">Spieler-spezifische Animationen</h4>
          <p class="text-sm text-dark-400 mb-4">
            Überschreiben Sie die Standard-Animationen für einzelne Spieler mit individuellen GIFs oder Videos.
          </p>

          <div class="space-y-3">
            <div
              v-for="player in playersStore.players"
              :key="player.id"
              class="flex items-center justify-between p-4 rounded-lg border transition-all"
              :class="hasPlayerAnimations(player.name)
                ? 'border-autodarts-500/50 bg-autodarts-500/5'
                : 'border-dark-600 bg-dark-700/30'"
            >
              <div class="flex items-center gap-3">
                <!-- Player color indicator -->
                <div
                  class="w-4 h-4 rounded-full flex-shrink-0"
                  :style="{ backgroundColor: player.color || '#3b82f6' }"
                />
                <div>
                  <p class="text-white font-medium">{{ player.name }}</p>
                  <p v-if="hasPlayerAnimations(player.name)" class="text-xs text-autodarts-400 mt-0.5">
                    {{ getPlayerAnimationCount(player.name) }} Animation(en) konfiguriert
                  </p>
                  <p v-else class="text-xs text-dark-500 mt-0.5">
                    Verwendet Standard-Animationen
                  </p>
                </div>
              </div>
              <BaseButton
                variant="ghost"
                size="sm"
                @click="openPlayerAnimationEditor(player.name)"
              >
                {{ hasPlayerAnimations(player.name) ? 'Bearbeiten' : 'Konfigurieren' }}
              </BaseButton>
            </div>
          </div>
        </div>

        <!-- No Players Info -->
        <div v-else-if="config.animationsEnabled && playersStore.players.length === 0" class="mt-6 pt-6 border-t border-dark-700">
          <div class="text-center py-4">
            <p class="text-dark-400">
              Erstellen Sie Spieler im <router-link to="/players" class="text-autodarts-400 hover:underline">Spieler-Bereich</router-link>, um individuelle Animationen zu konfigurieren.
            </p>
          </div>
        </div>

        <!-- Save Animations Button -->
        <div v-if="config.animationsEnabled" class="flex justify-end mt-6 pt-4 border-t border-dark-700">
          <BaseButton @click="saveConfig" :loading="isSaving">
            Animationen speichern
          </BaseButton>
        </div>
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

    <!-- Animation Editor Modal -->
    <Teleport to="body">
      <div
        v-if="editingAnimation && !editingAnimation.isPlayer"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div
          class="absolute inset-0 bg-black/70"
          @click="closeAnimationEditor"
        />
        <div class="relative bg-dark-800 rounded-2xl border border-dark-700 p-6 max-w-lg w-full">
          <h3 class="text-lg font-semibold text-white mb-4">
            Animation konfigurieren: {{ animationEvents.find(e => e.key === editingAnimation?.eventKey)?.label }}
          </h3>

          <div class="space-y-4">
            <!-- Enable Toggle -->
            <div class="flex items-center justify-between p-3 rounded-lg bg-dark-700/50 border border-dark-600">
              <span class="text-white">Animation aktiviert</span>
              <button
                type="button"
                @click="editAnimationForm.enabled = !editAnimationForm.enabled"
                :class="[
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  editAnimationForm.enabled ? 'bg-autodarts-600' : 'bg-dark-600',
                ]"
              >
                <span
                  :class="[
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                    editAnimationForm.enabled ? 'translate-x-6' : 'translate-x-1',
                  ]"
                />
              </button>
            </div>

            <!-- Animation URL / Upload -->
            <MediaUpload
              v-model="editAnimationForm.url"
              label="Animation (GIF/Video)"
              placeholder="URL eingeben oder Datei hochladen"
              media-type="animation"
              accept="image/gif,video/mp4,video/webm"
            />

            <!-- Duration -->
            <div>
              <label class="block text-sm font-medium text-dark-200 mb-2">
                Anzeigedauer: {{ editAnimationForm.duration / 1000 }}s
              </label>
              <input
                type="range"
                v-model.number="editAnimationForm.duration"
                min="1000"
                max="10000"
                step="500"
                class="w-full accent-autodarts-500"
              />
              <div class="flex justify-between text-sm text-dark-400 mt-1">
                <span>1s</span>
                <span>10s</span>
              </div>
            </div>

            <!-- Sound (optional) -->
            <MediaUpload
              v-model="editAnimationForm.sound"
              label="Sound (optional)"
              placeholder="URL eingeben oder Sound hochladen"
              media-type="sound"
              accept="audio/mpeg,audio/wav,audio/ogg"
            />
          </div>

          <!-- Actions -->
          <div class="flex items-center justify-end gap-3 mt-6">
            <BaseButton
              variant="ghost"
              @click="closeAnimationEditor"
            >
              Abbrechen
            </BaseButton>
            <BaseButton @click="saveAnimationConfig">
              Speichern
            </BaseButton>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Player Animation Modal -->
    <Teleport to="body">
      <div
        v-if="showPlayerAnimationModal && selectedPlayerForAnimations"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div
          class="absolute inset-0 bg-black/70"
          @click="closePlayerAnimationModal"
        />
        <div class="relative bg-dark-800 rounded-2xl border border-dark-700 p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between mb-6">
            <div>
              <h3 class="text-lg font-semibold text-white">
                Animationen für {{ selectedPlayerForAnimations }}
              </h3>
              <p class="text-sm text-dark-400 mt-1">
                Individuelle Animationen überschreiben die Standard-Einstellungen
              </p>
            </div>
            <button
              @click="closePlayerAnimationModal"
              class="p-2 rounded-lg hover:bg-dark-700 transition-colors"
            >
              <svg class="w-5 h-5 text-dark-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Event list for player -->
          <div class="space-y-3">
            <div
              v-for="event in animationEvents"
              :key="event.key"
              class="flex items-center justify-between p-4 rounded-lg border transition-all"
              :class="isPlayerAnimationEnabled(selectedPlayerForAnimations, event.key)
                ? 'border-autodarts-500/50 bg-autodarts-500/5'
                : 'border-dark-600 bg-dark-700/30'"
            >
              <div class="flex-1">
                <div class="flex items-center gap-3">
                  <p class="text-white font-medium">{{ event.label }}</p>
                  <span
                    v-if="isPlayerAnimationEnabled(selectedPlayerForAnimations, event.key)"
                    class="px-2 py-0.5 rounded-full bg-autodarts-500/20 text-autodarts-400 text-xs"
                  >
                    Individuell
                  </span>
                  <span
                    v-else-if="isAnimationEnabled(event.key)"
                    class="px-2 py-0.5 rounded-full bg-dark-600 text-dark-400 text-xs"
                  >
                    Standard
                  </span>
                </div>
                <p class="text-sm text-dark-400 mt-1">{{ event.description }}</p>
                <p
                  v-if="getPlayerAnimationConfig(selectedPlayerForAnimations, event.key)?.url"
                  class="text-xs text-dark-500 mt-1 truncate max-w-md"
                >
                  {{ getPlayerAnimationConfig(selectedPlayerForAnimations, event.key)?.url }}
                </p>
              </div>
              <div class="flex items-center gap-2">
                <BaseButton
                  variant="ghost"
                  size="sm"
                  @click="openPlayerEventAnimationEditor(selectedPlayerForAnimations, event.key)"
                >
                  {{ isPlayerAnimationEnabled(selectedPlayerForAnimations, event.key) ? 'Bearbeiten' : 'Einrichten' }}
                </BaseButton>
                <BaseButton
                  v-if="isPlayerAnimationEnabled(selectedPlayerForAnimations, event.key)"
                  variant="ghost"
                  size="sm"
                  @click="removePlayerAnimationConfig(selectedPlayerForAnimations, event.key)"
                >
                  <svg class="w-4 h-4 text-dark-400 hover:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </BaseButton>
              </div>
            </div>
          </div>

          <div class="flex justify-end mt-6 pt-4 border-t border-dark-700">
            <BaseButton @click="closePlayerAnimationModal">
              Fertig
            </BaseButton>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Player Event Animation Editor Modal -->
    <Teleport to="body">
      <div
        v-if="editingAnimation && editingAnimation.isPlayer"
        class="fixed inset-0 z-[60] flex items-center justify-center p-4"
      >
        <div
          class="absolute inset-0 bg-black/70"
          @click="closeAnimationEditor"
        />
        <div class="relative bg-dark-800 rounded-2xl border border-dark-700 p-6 max-w-lg w-full">
          <h3 class="text-lg font-semibold text-white mb-4">
            {{ selectedPlayerForAnimations }} - {{ animationEvents.find(e => e.key === editingAnimation?.eventKey)?.label }}
          </h3>

          <div class="space-y-4">
            <!-- Enable Toggle -->
            <div class="flex items-center justify-between p-3 rounded-lg bg-dark-700/50 border border-dark-600">
              <span class="text-white">Individuelle Animation aktiviert</span>
              <button
                type="button"
                @click="editAnimationForm.enabled = !editAnimationForm.enabled"
                :class="[
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  editAnimationForm.enabled ? 'bg-autodarts-600' : 'bg-dark-600',
                ]"
              >
                <span
                  :class="[
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                    editAnimationForm.enabled ? 'translate-x-6' : 'translate-x-1',
                  ]"
                />
              </button>
            </div>

            <!-- Animation URL / Upload -->
            <MediaUpload
              v-model="editAnimationForm.url"
              label="Animation (GIF/Video)"
              placeholder="URL eingeben oder Datei hochladen"
              media-type="animation"
              accept="image/gif,video/mp4,video/webm"
            />

            <!-- Duration -->
            <div>
              <label class="block text-sm font-medium text-dark-200 mb-2">
                Anzeigedauer: {{ editAnimationForm.duration / 1000 }}s
              </label>
              <input
                type="range"
                v-model.number="editAnimationForm.duration"
                min="1000"
                max="10000"
                step="500"
                class="w-full accent-autodarts-500"
              />
              <div class="flex justify-between text-sm text-dark-400 mt-1">
                <span>1s</span>
                <span>10s</span>
              </div>
            </div>

            <!-- Sound (optional) -->
            <MediaUpload
              v-model="editAnimationForm.sound"
              label="Sound (optional)"
              placeholder="URL eingeben oder Sound hochladen"
              media-type="sound"
              accept="audio/mpeg,audio/wav,audio/ogg"
            />
          </div>

          <!-- Actions -->
          <div class="flex items-center justify-end gap-3 mt-6">
            <BaseButton
              variant="ghost"
              @click="closeAnimationEditor"
            >
              Abbrechen
            </BaseButton>
            <BaseButton @click="savePlayerAnimationConfig">
              Speichern
            </BaseButton>
          </div>
        </div>
      </div>
    </Teleport>
  </AppLayout>
</template>
