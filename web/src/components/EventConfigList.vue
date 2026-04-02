<script setup lang="ts">
import { computed } from 'vue'

// Event metadata types (from module.json)
interface EventMeta {
  label: string | Record<string, string>
  description?: string | Record<string, string>
}

// Event group type (from module.json)
interface EventGroup {
  title: string | Record<string, string>
  events: string[]
}

// Props
interface Props {
  // Event groups configuration from module.json
  eventGroups: EventGroup[]
  // Event metadata from module.json
  eventMeta?: Record<string, EventMeta>
  // Current language for i18n
  language?: string
  // Currently enabled events (for toggle list mode)
  enabledEvents?: Record<string, boolean>
  // Whether to show toggle switches
  showToggles?: boolean
  // Whether events are expandable (for detailed config)
  expandable?: boolean
  // Custom slot name prefix for event content
  slotPrefix?: string
}

const props = withDefaults(defineProps<Props>(), {
  language: 'en',
  eventMeta: () => ({}),
  enabledEvents: () => ({}),
  showToggles: false,
  expandable: false,
  slotPrefix: 'event',
})

// Emits
const emit = defineEmits<{
  (e: 'toggle', eventName: string, enabled: boolean): void
  (e: 'expand', eventName: string): void
}>()

// Get localized string from i18n object
function getLocalizedString(value: string | Record<string, string> | undefined, fallback: string = ''): string {
  if (!value) return fallback
  if (typeof value === 'string') return value
  return value[props.language] || value['en'] || fallback
}

// Get event label
function getEventLabel(eventName: string): string {
  const meta = props.eventMeta[eventName]
  if (meta?.label) {
    return getLocalizedString(meta.label, eventName)
  }
  // Format event name as fallback: "match.started" -> "Match Started"
  return eventName
    .split('.')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

// Get event description
function getEventDescription(eventName: string): string | undefined {
  const meta = props.eventMeta[eventName]
  if (meta?.description) {
    return getLocalizedString(meta.description)
  }
  return undefined
}

// Get group title
function getGroupTitle(group: EventGroup): string {
  return getLocalizedString(group.title, 'Events')
}

// Toggle event enabled state
function toggleEvent(eventName: string) {
  const currentState = props.enabledEvents[eventName] ?? true
  emit('toggle', eventName, !currentState)
}

// Check if event is enabled
function isEventEnabled(eventName: string): boolean {
  return props.enabledEvents[eventName] ?? true
}

// Computed: groups with translated titles
const processedGroups = computed(() => {
  return props.eventGroups.map(group => ({
    title: getGroupTitle(group),
    events: group.events.map(eventName => ({
      name: eventName,
      label: getEventLabel(eventName),
      description: getEventDescription(eventName),
      enabled: isEventEnabled(eventName),
    })),
  }))
})

// Computed: total event count
const totalEvents = computed(() => {
  return props.eventGroups.reduce((sum, group) => sum + group.events.length, 0)
})

// Computed: enabled event count
const enabledCount = computed(() => {
  return Object.values(props.enabledEvents).filter(Boolean).length
})
</script>

<template>
  <div class="space-y-6">
    <!-- Stats header (optional) -->
    <slot name="header" :total-events="totalEvents" :enabled-count="enabledCount" />

    <!-- Event Groups -->
    <div v-for="group in processedGroups" :key="group.title" class="space-y-3">
      <!-- Group Title -->
      <h3 class="text-sm font-medium text-dark-300 uppercase tracking-wider flex items-center gap-2">
        {{ group.title }}
        <span class="text-xs font-normal text-dark-500">({{ group.events.length }})</span>
      </h3>

      <!-- Events List -->
      <div :class="showToggles ? 'grid grid-cols-1 md:grid-cols-2 gap-2' : 'space-y-2'">
        <div
          v-for="event in group.events"
          :key="event.name"
          :class="[
            'rounded-lg transition-colors',
            showToggles
              ? 'flex items-center justify-between p-3 bg-dark-700/30 hover:bg-dark-700/50'
              : expandable
              ? 'border border-dark-700 overflow-hidden'
              : 'p-3 bg-dark-700/30',
          ]"
        >
          <!-- Toggle Mode: Simple list with toggles -->
          <template v-if="showToggles">
            <div class="flex-1 min-w-0">
              <p class="text-white text-sm font-medium truncate">{{ event.label }}</p>
              <p v-if="event.description" class="text-xs text-dark-400 truncate">
                {{ event.description }}
              </p>
            </div>
            <button
              type="button"
              @click="toggleEvent(event.name)"
              :class="[
                'relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ml-3',
                event.enabled ? 'bg-autodarts-600' : 'bg-dark-600',
              ]"
            >
              <span
                :class="[
                  'inline-block h-3 w-3 transform rounded-full bg-white transition-transform',
                  event.enabled ? 'translate-x-5' : 'translate-x-1',
                ]"
              />
            </button>
          </template>

          <!-- Expandable Mode: Use slot for custom content -->
          <template v-else-if="expandable">
            <slot
              :name="`${slotPrefix}-${event.name}`"
              :event-name="event.name"
              :event-label="event.label"
              :event-description="event.description"
              :enabled="event.enabled"
            >
              <!-- Default expandable content -->
              <div class="p-4">
                <p class="text-white font-medium">{{ event.label }}</p>
                <p v-if="event.description" class="text-sm text-dark-400 mt-1">
                  {{ event.description }}
                </p>
              </div>
            </slot>
          </template>

          <!-- Simple Display Mode -->
          <template v-else>
            <slot
              :name="`${slotPrefix}-${event.name}`"
              :event-name="event.name"
              :event-label="event.label"
              :event-description="event.description"
            >
              <div>
                <p class="text-white text-sm font-medium">{{ event.label }}</p>
                <p v-if="event.description" class="text-xs text-dark-400 mt-1">
                  {{ event.description }}
                </p>
              </div>
            </slot>
          </template>
        </div>
      </div>
    </div>

    <!-- Footer slot -->
    <slot name="footer" :total-events="totalEvents" :enabled-count="enabledCount" />
  </div>
</template>
