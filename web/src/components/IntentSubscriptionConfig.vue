<script setup lang="ts">
import { ref, computed } from 'vue'
import BaseButton from './BaseButton.vue'

// Types
interface ModuleIntentAction {
  type: string
  label: string
  description?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  configSchema?: Record<string, any>
}

interface IntentActionConfig {
  type: string
  config?: Record<string, unknown>
}

interface IntentSubscriptionConfig {
  intentId: string
  enabled: boolean
  action: IntentActionConfig
}

interface Props {
  /** Available intents from the system */
  availableIntents: Array<{
    id: string
    description: string
    category?: string
  }>
  /** Available actions from the module */
  availableActions: ModuleIntentAction[]
  /** Current subscriptions */
  modelValue: IntentSubscriptionConfig[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: IntentSubscriptionConfig[]]
}>()

// Local state
const expandedSubscription = ref<string | null>(null)

// Computed
const subscriptions = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

// Group intents by category
const intentsByCategory = computed(() => {
  const grouped: Record<string, typeof props.availableIntents> = {}
  for (const intent of props.availableIntents) {
    const category = intent.category || 'Sonstige'
    if (!grouped[category]) {
      grouped[category] = []
    }
    grouped[category].push(intent)
  }
  return grouped
})

// Get subscription for an intent
function getSubscription(intentId: string): IntentSubscriptionConfig | undefined {
  return subscriptions.value.find(s => s.intentId === intentId)
}

// Toggle subscription enabled
function toggleSubscription(intentId: string) {
  const existing = getSubscription(intentId)
  if (existing) {
    updateSubscription(intentId, { ...existing, enabled: !existing.enabled })
  } else {
    // Create new subscription with default action
    const defaultAction = props.availableActions[0]
    addSubscription({
      intentId,
      enabled: true,
      action: {
        type: defaultAction?.type || 'none',
        config: {}
      }
    })
  }
}

// Add a new subscription
function addSubscription(subscription: IntentSubscriptionConfig) {
  subscriptions.value = [...subscriptions.value, subscription]
}

// Update an existing subscription
function updateSubscription(intentId: string, subscription: IntentSubscriptionConfig) {
  subscriptions.value = subscriptions.value.map(s =>
    s.intentId === intentId ? subscription : s
  )
}

// Remove a subscription
function removeSubscription(intentId: string) {
  subscriptions.value = subscriptions.value.filter(s => s.intentId !== intentId)
}

// Update action type for a subscription
function updateActionType(intentId: string, actionType: string) {
  const existing = getSubscription(intentId)
  if (existing) {
    const action = props.availableActions.find(a => a.type === actionType)
    const defaultConfig: Record<string, unknown> = {}

    // Build default config from schema
    if (action?.configSchema) {
      for (const [key, field] of Object.entries(action.configSchema)) {
        if (field.default !== undefined) {
          defaultConfig[key] = field.default
        }
      }
    }

    updateSubscription(intentId, {
      ...existing,
      action: { type: actionType, config: defaultConfig }
    })
  }
}

// Update action config field
function updateActionConfig(intentId: string, field: string, value: unknown) {
  const existing = getSubscription(intentId)
  if (existing) {
    updateSubscription(intentId, {
      ...existing,
      action: {
        ...existing.action,
        config: { ...existing.action.config, [field]: value }
      }
    })
  }
}

// Get action label
function getActionLabel(actionType: string): string {
  const action = props.availableActions.find(a => a.type === actionType)
  return action?.label || actionType
}

// Get action for subscription
function getAction(subscription: IntentSubscriptionConfig): ModuleIntentAction | undefined {
  return props.availableActions.find(a => a.type === subscription.action.type)
}

// Toggle expansion
function toggleExpand(intentId: string) {
  expandedSubscription.value = expandedSubscription.value === intentId ? null : intentId
}
</script>

<template>
  <div class="space-y-6">
    <!-- Category groups -->
    <div
      v-for="(intents, category) in intentsByCategory"
      :key="category"
      class="space-y-3"
    >
      <h3 class="text-sm font-medium text-dark-300 uppercase tracking-wider">
        {{ category }}
      </h3>

      <div class="space-y-2">
        <div
          v-for="intent in intents"
          :key="intent.id"
          class="border border-dark-700 rounded-xl overflow-hidden"
        >
          <!-- Header -->
          <div class="flex items-center justify-between p-4 hover:bg-dark-700/50 transition-colors">
            <div class="flex items-center gap-3 flex-1">
              <!-- Enable toggle -->
              <button
                type="button"
                @click="toggleSubscription(intent.id)"
                :class="[
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0',
                  getSubscription(intent.id)?.enabled ? 'bg-autodarts-600' : 'bg-dark-600',
                ]"
              >
                <span
                  :class="[
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                    getSubscription(intent.id)?.enabled ? 'translate-x-6' : 'translate-x-1',
                  ]"
                />
              </button>

              <!-- Intent info -->
              <div class="flex-1 min-w-0">
                <p class="text-white font-medium truncate">{{ intent.id }}</p>
                <p class="text-sm text-dark-400 truncate">{{ intent.description }}</p>
              </div>
            </div>

            <!-- Action summary & expand button -->
            <div class="flex items-center gap-3 ml-4">
              <span
                v-if="getSubscription(intent.id)"
                class="text-sm text-autodarts-400"
              >
                {{ getActionLabel(getSubscription(intent.id)!.action.type) }}
              </span>

              <button
                v-if="getSubscription(intent.id)?.enabled"
                type="button"
                @click="toggleExpand(intent.id)"
                class="p-2 rounded-lg hover:bg-dark-600 transition-colors"
              >
                <svg
                  :class="['w-5 h-5 text-dark-400 transition-transform', expandedSubscription === intent.id ? 'rotate-180' : '']"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Expanded config -->
          <div
            v-if="expandedSubscription === intent.id && getSubscription(intent.id)"
            class="border-t border-dark-700 p-4 space-y-4 bg-dark-800/50"
          >
            <!-- Action Type Selection -->
            <div>
              <label class="block text-sm font-medium text-dark-200 mb-2">Aktion</label>
              <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                <button
                  v-for="action in availableActions"
                  :key="action.type"
                  type="button"
                  @click="updateActionType(intent.id, action.type)"
                  :class="[
                    'p-3 rounded-lg border-2 text-left transition-all',
                    getSubscription(intent.id)?.action.type === action.type
                      ? 'border-autodarts-500 bg-autodarts-500/10'
                      : 'border-dark-600 hover:border-dark-500',
                  ]"
                >
                  <p class="text-white font-medium text-sm">{{ action.label }}</p>
                  <p v-if="action.description" class="text-xs text-dark-400 mt-1">
                    {{ action.description }}
                  </p>
                </button>
              </div>
            </div>

            <!-- Action Config Fields -->
            <template v-if="getAction(getSubscription(intent.id)!)?.configSchema">
              <div
                v-for="(field, fieldKey) in getAction(getSubscription(intent.id)!)!.configSchema"
                :key="fieldKey"
                class="space-y-1"
              >
                <!-- String input -->
                <template v-if="field.type === 'string'">
                  <label class="block text-sm font-medium text-dark-200">
                    {{ field.label }}
                  </label>
                  <input
                    type="text"
                    :value="getSubscription(intent.id)?.action.config?.[fieldKey] ?? field.default ?? ''"
                    @input="updateActionConfig(intent.id, fieldKey, ($event.target as HTMLInputElement).value)"
                    class="w-full px-4 py-2.5 rounded-lg bg-dark-800 border border-dark-600 text-white focus:outline-none focus:ring-2 focus:ring-autodarts-500"
                    :placeholder="field.description"
                  />
                </template>

                <!-- Number input -->
                <template v-else-if="field.type === 'number'">
                  <label class="block text-sm font-medium text-dark-200">
                    {{ field.label }}
                  </label>
                  <input
                    type="number"
                    :value="getSubscription(intent.id)?.action.config?.[fieldKey] ?? field.default ?? 0"
                    @input="updateActionConfig(intent.id, fieldKey, Number(($event.target as HTMLInputElement).value))"
                    :min="field.min"
                    :max="field.max"
                    class="w-full px-4 py-2.5 rounded-lg bg-dark-800 border border-dark-600 text-white focus:outline-none focus:ring-2 focus:ring-autodarts-500"
                  />
                  <p v-if="field.description" class="text-xs text-dark-500">{{ field.description }}</p>
                </template>

                <!-- Boolean toggle -->
                <template v-else-if="field.type === 'boolean'">
                  <div class="flex items-center justify-between p-3 rounded-lg bg-dark-700/50">
                    <div>
                      <p class="text-white font-medium">{{ field.label }}</p>
                      <p v-if="field.description" class="text-sm text-dark-400">{{ field.description }}</p>
                    </div>
                    <button
                      type="button"
                      @click="updateActionConfig(intent.id, fieldKey, !(getSubscription(intent.id)?.action.config?.[fieldKey] ?? field.default ?? false))"
                      :class="[
                        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                        (getSubscription(intent.id)?.action.config?.[fieldKey] ?? field.default) ? 'bg-autodarts-600' : 'bg-dark-600',
                      ]"
                    >
                      <span
                        :class="[
                          'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                          (getSubscription(intent.id)?.action.config?.[fieldKey] ?? field.default) ? 'translate-x-6' : 'translate-x-1',
                        ]"
                      />
                    </button>
                  </div>
                </template>

                <!-- Select dropdown -->
                <template v-else-if="field.type === 'select'">
                  <label class="block text-sm font-medium text-dark-200">
                    {{ field.label }}
                  </label>
                  <select
                    :value="getSubscription(intent.id)?.action.config?.[fieldKey] ?? field.default ?? ''"
                    @change="updateActionConfig(intent.id, fieldKey, ($event.target as HTMLSelectElement).value)"
                    class="w-full px-4 py-2.5 rounded-lg bg-dark-800 border border-dark-600 text-white focus:outline-none focus:ring-2 focus:ring-autodarts-500"
                  >
                    <option
                      v-for="option in field.options"
                      :key="option.value"
                      :value="option.value"
                    >
                      {{ option.label }}
                    </option>
                  </select>
                  <p v-if="field.description" class="text-xs text-dark-500">{{ field.description }}</p>
                </template>

                <!-- Color picker -->
                <template v-else-if="field.type === 'color'">
                  <label class="block text-sm font-medium text-dark-200">
                    {{ field.label }}
                  </label>
                  <div class="flex items-center gap-3">
                    <input
                      type="color"
                      :value="getSubscription(intent.id)?.action.config?.[fieldKey] ?? field.default ?? '#ffffff'"
                      @input="updateActionConfig(intent.id, fieldKey, ($event.target as HTMLInputElement).value)"
                      class="w-12 h-10 rounded-lg cursor-pointer bg-dark-800 border border-dark-600"
                    />
                    <input
                      type="text"
                      :value="getSubscription(intent.id)?.action.config?.[fieldKey] ?? field.default ?? '#ffffff'"
                      @input="updateActionConfig(intent.id, fieldKey, ($event.target as HTMLInputElement).value)"
                      class="flex-1 px-4 py-2.5 rounded-lg bg-dark-800 border border-dark-600 text-white focus:outline-none focus:ring-2 focus:ring-autodarts-500 uppercase font-mono"
                      maxlength="7"
                      placeholder="#FFFFFF"
                    />
                  </div>
                  <p v-if="field.description" class="text-xs text-dark-500">{{ field.description }}</p>
                </template>
              </div>
            </template>

            <!-- Remove subscription button -->
            <div class="flex justify-end pt-2">
              <BaseButton
                variant="ghost"
                size="sm"
                @click="removeSubscription(intent.id)"
              >
                <svg class="w-4 h-4 mr-2 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Reaktion entfernen
              </BaseButton>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div
      v-if="Object.keys(intentsByCategory).length === 0"
      class="text-center py-12"
    >
      <svg class="w-16 h-16 mx-auto text-dark-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p class="text-dark-400">Keine Intents verfügbar</p>
    </div>
  </div>
</template>
