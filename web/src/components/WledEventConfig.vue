<script setup lang="ts">
import { ref, computed } from 'vue'
import BaseButton from './BaseButton.vue'

// Types
type ActionType = 'preset' | 'effect' | 'solid' | 'off' | 'none'

interface WledPreset {
  id: number
  name: string
}

interface WledEffect {
  id: number
  name: string
}

interface EventConfig {
  actionType: ActionType
  presetId?: number
  effectId?: number
  color1?: string
  color2?: string
  color3?: string
  brightness?: number
  speed?: number
  intensity?: number
  duration?: number // Duration in ms - after this time, WLED reverts to previous state
  fadeTime?: number // Fade/transition time in 100ms units (0-100 = 0-10s) for smooth color transitions
  usePlayerColor?: boolean // If true, use player color instead of fixed color
}

interface Props {
  eventName: string
  eventLabel: string
  eventDescription?: string
  modelValue: EventConfig
  presets: WledPreset[]
  effects: WledEffect[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: EventConfig]
  'test': [eventName: string, config: EventConfig]
}>()

// Local state
const isTesting = ref(false)
const isExpanded = ref(false)

// Computed config with defaults
const config = computed({
  get: () => ({
    actionType: props.modelValue.actionType || 'none',
    presetId: props.modelValue.presetId ?? 1,
    effectId: props.modelValue.effectId ?? 0,
    color1: props.modelValue.color1 || '#22c55e',
    color2: props.modelValue.color2 || '#000000',
    color3: props.modelValue.color3 || '#000000',
    brightness: props.modelValue.brightness ?? 255,
    speed: props.modelValue.speed ?? 128,
    intensity: props.modelValue.intensity ?? 128,
    duration: props.modelValue.duration ?? 0,
    fadeTime: props.modelValue.fadeTime ?? 0, // 0 = instant, in 100ms units (0-100 = 0-10s)
    usePlayerColor: props.modelValue.usePlayerColor ?? false,
  }),
  set: (value: EventConfig) => emit('update:modelValue', value),
})

// Fade time presets for quick selection (in 100ms units for WLED API)
const fadeTimePresets = [
  { label: 'Sofort', value: 0 },
  { label: '0.2s', value: 2 },
  { label: '0.5s', value: 5 },
  { label: '1s', value: 10 },
  { label: '2s', value: 20 },
  { label: '5s', value: 50 },
]

// Duration presets for quick selection
const durationPresets = [
  { label: 'Aus', value: 0 },
  { label: '0.5s', value: 500 },
  { label: '1s', value: 1000 },
  { label: '2s', value: 2000 },
  { label: '3s', value: 3000 },
  { label: '5s', value: 5000 },
]

// Action type icons/colors
const actionTypeInfo = computed(() => {
  // If usePlayerColor is enabled, show player color styling
  if (config.value.usePlayerColor && (config.value.actionType === 'solid' || config.value.actionType === 'effect')) {
    return { icon: 'users', color: 'text-green-400', bg: 'bg-green-500/20' }
  }

  switch (config.value.actionType) {
    case 'preset':
      return { icon: 'bookmark', color: 'text-purple-400', bg: 'bg-purple-500/20' }
    case 'effect':
      return { icon: 'sparkles', color: 'text-blue-400', bg: 'bg-blue-500/20' }
    case 'solid':
      return { icon: 'paint', color: 'text-yellow-400', bg: 'bg-yellow-500/20' }
    case 'off':
      return { icon: 'power', color: 'text-red-400', bg: 'bg-red-500/20' }
    default:
      return { icon: 'none', color: 'text-dark-400', bg: 'bg-dark-700' }
  }
})

// Summary text
const summaryText = computed(() => {
  const playerColorSuffix = config.value.usePlayerColor ? ' (Spielerfarbe)' : ''

  switch (config.value.actionType) {
    case 'preset':
      const preset = props.presets.find((p) => p.id === config.value.presetId)
      return preset ? `Preset: ${preset.name}` : 'Preset auswählen'
    case 'effect':
      const effect = props.effects.find((e) => e.id === config.value.effectId)
      return (effect ? `Effekt: ${effect.name}` : 'Effekt auswählen') + playerColorSuffix
    case 'solid':
      return config.value.usePlayerColor ? 'Spielerfarbe' : 'Farbe'
    case 'off':
      return 'WLED ausschalten'
    default:
      return 'Keine Aktion'
  }
})

function updateConfig<K extends keyof EventConfig>(key: K, value: EventConfig[K]) {
  config.value = { ...config.value, [key]: value }
}

async function testAction() {
  isTesting.value = true
  emit('test', props.eventName, config.value)
  // Simulate test duration
  setTimeout(() => {
    isTesting.value = false
  }, 1500)
}
</script>

<template>
  <div class="border border-dark-700 rounded-xl overflow-hidden">
    <!-- Header - Always visible -->
    <button
      type="button"
      class="w-full flex items-center justify-between p-4 hover:bg-dark-700/50 transition-colors text-left"
      @click="isExpanded = !isExpanded"
    >
      <div class="flex items-center gap-3">
        <!-- Action type indicator -->
        <div :class="['w-10 h-10 rounded-lg flex items-center justify-center', actionTypeInfo.bg]">
          <!-- Preset Icon -->
          <svg v-if="actionTypeInfo.icon === 'bookmark'" :class="['w-5 h-5', actionTypeInfo.color]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
          <!-- Effect Icon -->
          <svg v-else-if="actionTypeInfo.icon === 'sparkles'" :class="['w-5 h-5', actionTypeInfo.color]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
          <!-- Solid Color Icon -->
          <svg v-else-if="actionTypeInfo.icon === 'paint'" :class="['w-5 h-5', actionTypeInfo.color]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
          </svg>
          <!-- Power Off Icon -->
          <svg v-else-if="actionTypeInfo.icon === 'power'" :class="['w-5 h-5', actionTypeInfo.color]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 5.636a9 9 0 11-12.728 0M12 3v9" />
          </svg>
          <!-- Player Color Icon (shown when usePlayerColor is enabled) -->
          <svg v-else-if="actionTypeInfo.icon === 'users'" :class="['w-5 h-5', actionTypeInfo.color]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <!-- None Icon -->
          <svg v-else :class="['w-5 h-5', actionTypeInfo.color]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </div>

        <div>
          <p class="text-white font-medium">{{ eventLabel }}</p>
          <p class="text-sm text-dark-400">{{ summaryText }}</p>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <!-- Color preview for solid -->
        <div
          v-if="config.actionType === 'solid'"
          class="w-8 h-8 rounded-full border-2 border-dark-500"
          :style="{ backgroundColor: config.color1 }"
        />

        <!-- Expand arrow -->
        <svg
          :class="['w-5 h-5 text-dark-400 transition-transform', isExpanded ? 'rotate-180' : '']"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </button>

    <!-- Expanded Content -->
    <div v-if="isExpanded" class="border-t border-dark-700 p-4 space-y-4 bg-dark-800/50">
      <!-- Description -->
      <p v-if="eventDescription" class="text-sm text-dark-400">
        {{ eventDescription }}
      </p>

      <!-- Action Type Selection -->
      <div class="grid grid-cols-5 gap-2">
        <button
          type="button"
          @click="updateConfig('actionType', 'preset')"
          :class="[
            'p-3 rounded-lg border-2 text-center transition-all',
            config.actionType === 'preset'
              ? 'border-purple-500 bg-purple-500/10'
              : 'border-dark-600 hover:border-dark-500',
          ]"
        >
          <svg class="w-5 h-5 mx-auto text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
          <span class="text-xs text-dark-300 mt-1 block">Preset</span>
        </button>

        <button
          type="button"
          @click="updateConfig('actionType', 'effect')"
          :class="[
            'p-3 rounded-lg border-2 text-center transition-all',
            config.actionType === 'effect'
              ? 'border-blue-500 bg-blue-500/10'
              : 'border-dark-600 hover:border-dark-500',
          ]"
        >
          <svg class="w-5 h-5 mx-auto text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
          <span class="text-xs text-dark-300 mt-1 block">Effekt</span>
        </button>

        <button
          type="button"
          @click="updateConfig('actionType', 'solid')"
          :class="[
            'p-3 rounded-lg border-2 text-center transition-all',
            config.actionType === 'solid'
              ? 'border-yellow-500 bg-yellow-500/10'
              : 'border-dark-600 hover:border-dark-500',
          ]"
        >
          <svg class="w-5 h-5 mx-auto text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
          </svg>
          <span class="text-xs text-dark-300 mt-1 block">Farbe</span>
        </button>

        <button
          type="button"
          @click="updateConfig('actionType', 'off')"
          :class="[
            'p-3 rounded-lg border-2 text-center transition-all',
            config.actionType === 'off'
              ? 'border-red-500 bg-red-500/10'
              : 'border-dark-600 hover:border-dark-500',
          ]"
        >
          <svg class="w-5 h-5 mx-auto text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 5.636a9 9 0 11-12.728 0M12 3v9" />
          </svg>
          <span class="text-xs text-dark-300 mt-1 block">Aus</span>
        </button>

        <button
          type="button"
          @click="updateConfig('actionType', 'none')"
          :class="[
            'p-3 rounded-lg border-2 text-center transition-all',
            config.actionType === 'none'
              ? 'border-dark-400 bg-dark-600'
              : 'border-dark-600 hover:border-dark-500',
          ]"
        >
          <svg class="w-5 h-5 mx-auto text-dark-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
          <span class="text-xs text-dark-300 mt-1 block">Keine</span>
        </button>
      </div>

      <!-- Preset Selection -->
      <div v-if="config.actionType === 'preset'" class="space-y-3">
        <label class="block text-sm font-medium text-dark-200">Preset wählen</label>
        <select
          :value="config.presetId"
          @change="updateConfig('presetId', Number(($event.target as HTMLSelectElement).value))"
          class="w-full px-4 py-2.5 rounded-lg bg-dark-800 border border-dark-600 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
        >
          <option v-for="preset in presets" :key="preset.id" :value="preset.id">
            {{ preset.name }}
          </option>
        </select>
      </div>

      <!-- Effect Selection -->
      <div v-if="config.actionType === 'effect'" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-dark-200 mb-2">Effekt wählen</label>
          <select
            :value="config.effectId"
            @change="updateConfig('effectId', Number(($event.target as HTMLSelectElement).value))"
            class="w-full px-4 py-2.5 rounded-lg bg-dark-800 border border-dark-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option v-for="effect in effects" :key="effect.id" :value="effect.id">
              {{ effect.name }}
            </option>
          </select>
        </div>

        <!-- Use Player Color Toggle for first color -->
        <label class="flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors"
          :class="config.usePlayerColor ? 'border-green-500 bg-green-500/10' : 'border-dark-600 hover:border-dark-500'"
        >
          <input
            type="checkbox"
            :checked="config.usePlayerColor"
            @change="updateConfig('usePlayerColor', ($event.target as HTMLInputElement).checked)"
            class="w-5 h-5 rounded border-dark-500 bg-dark-700 text-green-500 focus:ring-green-500 focus:ring-offset-dark-800"
          />
          <div class="flex-1">
            <span class="text-white font-medium">Spielerfarbe für Farbe 1</span>
            <p class="text-sm text-dark-400 mt-0.5">
              Farbe 1 wird durch die Spielerfarbe ersetzt
            </p>
          </div>
          <svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        </label>

        <!-- Player Color Info (when using player color) -->
        <div v-if="config.usePlayerColor" class="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
          <p class="text-sm text-dark-300">
            Farbe 1 wird durch die Spielerfarbe ersetzt. Bekannte Spieler bekommen ihre konfigurierte Farbe,
            unbekannte Spieler die generische Spielerfarbe (1-6).
          </p>
        </div>

        <!-- Colors for effect -->
        <div class="grid grid-cols-3 gap-4">
          <div>
            <label class="block text-sm font-medium text-dark-200 mb-2">
              {{ config.usePlayerColor ? 'Farbe 1 (Spielerfarbe)' : 'Farbe 1' }}
            </label>
            <div class="relative">
              <input
                type="color"
                :value="config.color1"
                @input="updateConfig('color1', ($event.target as HTMLInputElement).value)"
                :disabled="config.usePlayerColor"
                :class="[
                  'w-full h-10 rounded-lg cursor-pointer border-0',
                  config.usePlayerColor ? 'opacity-50 cursor-not-allowed' : ''
                ]"
              />
              <div v-if="config.usePlayerColor" class="absolute inset-0 flex items-center justify-center bg-green-500/20 rounded-lg">
                <svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-dark-200 mb-2">Farbe 2</label>
            <input
              type="color"
              :value="config.color2"
              @input="updateConfig('color2', ($event.target as HTMLInputElement).value)"
              class="w-full h-10 rounded-lg cursor-pointer border-0"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-dark-200 mb-2">Farbe 3</label>
            <input
              type="color"
              :value="config.color3"
              @input="updateConfig('color3', ($event.target as HTMLInputElement).value)"
              class="w-full h-10 rounded-lg cursor-pointer border-0"
            />
          </div>
        </div>

        <!-- Speed & Intensity -->
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-dark-200 mb-2">
              Geschwindigkeit: {{ config.speed }}
            </label>
            <input
              type="range"
              min="0"
              max="255"
              :value="config.speed"
              @input="updateConfig('speed', Number(($event.target as HTMLInputElement).value))"
              class="w-full accent-blue-500"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-dark-200 mb-2">
              Intensität: {{ config.intensity }}
            </label>
            <input
              type="range"
              min="0"
              max="255"
              :value="config.intensity"
              @input="updateConfig('intensity', Number(($event.target as HTMLInputElement).value))"
              class="w-full accent-blue-500"
            />
          </div>
        </div>
      </div>

      <!-- Solid Color Selection -->
      <div v-if="config.actionType === 'solid'" class="space-y-4">
        <!-- Use Player Color Toggle -->
        <label class="flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors"
          :class="config.usePlayerColor ? 'border-green-500 bg-green-500/10' : 'border-dark-600 hover:border-dark-500'"
        >
          <input
            type="checkbox"
            :checked="config.usePlayerColor"
            @change="updateConfig('usePlayerColor', ($event.target as HTMLInputElement).checked)"
            class="w-5 h-5 rounded border-dark-500 bg-dark-700 text-green-500 focus:ring-green-500 focus:ring-offset-dark-800"
          />
          <div class="flex-1">
            <span class="text-white font-medium">Spielerfarbe verwenden</span>
            <p class="text-sm text-dark-400 mt-0.5">
              Automatisch die Farbe des aktuellen Spielers nutzen
            </p>
          </div>
          <svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        </label>

        <!-- Fixed Color Selection (only if not using player color) -->
        <div v-if="!config.usePlayerColor">
          <label class="block text-sm font-medium text-dark-200 mb-2">Farbe wählen</label>
          <div class="flex items-center gap-4">
            <input
              type="color"
              :value="config.color1"
              @input="updateConfig('color1', ($event.target as HTMLInputElement).value)"
              class="w-16 h-16 rounded-xl cursor-pointer border-0"
            />
            <div class="flex-1">
              <p class="text-white font-mono">{{ config.color1 }}</p>
              <p class="text-sm text-dark-400">Klicken zum Ändern</p>
            </div>
          </div>
        </div>

        <!-- Player Color Info (when using player color) -->
        <div v-if="config.usePlayerColor" class="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
          <p class="text-sm text-dark-300">
            Die Farbe wird basierend auf dem Spieler gewählt: Bekannte Spieler bekommen ihre konfigurierte Farbe,
            unbekannte Spieler die generische Spielerfarbe (1-6).
          </p>
        </div>

        <!-- Brightness -->
        <div>
          <label class="block text-sm font-medium text-dark-200 mb-2">
            Helligkeit: {{ Math.round((config.brightness ?? 255) / 255 * 100) }}%
          </label>
          <input
            type="range"
            min="0"
            max="255"
            :value="config.brightness"
            @input="updateConfig('brightness', Number(($event.target as HTMLInputElement).value))"
            :class="config.usePlayerColor ? 'w-full accent-green-500' : 'w-full accent-yellow-500'"
          />
        </div>
      </div>

      <!-- Duration Selection (for effect/solid/preset) -->
      <div v-if="config.actionType !== 'none' && config.actionType !== 'off'" class="space-y-2">
        <label class="block text-sm font-medium text-dark-200">
          Dauer (danach zurück zum vorherigen Zustand)
        </label>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="preset in durationPresets"
            :key="preset.value"
            type="button"
            @click="updateConfig('duration', preset.value)"
            :class="[
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              config.duration === preset.value
                ? 'bg-autodarts-600 text-white'
                : 'bg-dark-700 text-dark-300 hover:bg-dark-600',
            ]"
          >
            {{ preset.label }}
          </button>
        </div>
        <p class="text-xs text-dark-500">
          {{ config.duration === 0 ? 'Effekt bleibt aktiv bis zum nächsten Event' : `Nach ${config.duration}ms wird der vorherige WLED-Zustand wiederhergestellt` }}
        </p>
      </div>

      <!-- Fade Time Selection (for effect/solid/preset) -->
      <div v-if="config.actionType !== 'none' && config.actionType !== 'off'" class="space-y-2">
        <label class="block text-sm font-medium text-dark-200">
          Übergangszeit (Fade)
        </label>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="preset in fadeTimePresets"
            :key="preset.value"
            type="button"
            @click="updateConfig('fadeTime', preset.value)"
            :class="[
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              config.fadeTime === preset.value
                ? 'bg-cyan-600 text-white'
                : 'bg-dark-700 text-dark-300 hover:bg-dark-600',
            ]"
          >
            {{ preset.label }}
          </button>
        </div>
        <p class="text-xs text-dark-500">
          {{ config.fadeTime === 0 ? 'Sofortiger Wechsel ohne Übergang' : `Sanfter Übergang über ${(config.fadeTime ?? 0) / 10}s` }}
        </p>
      </div>

      <!-- Test Button -->
      <div v-if="config.actionType !== 'none'" class="flex justify-end pt-2">
        <BaseButton
          variant="secondary"
          size="sm"
          :loading="isTesting"
          @click="testAction"
        >
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Testen
        </BaseButton>
      </div>
    </div>
  </div>
</template>
