<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import BaseInput from './BaseInput.vue'
import MediaUpload from './MediaUpload.vue'
import { api } from '../api/client'

// Config field schema types from module.json
interface SelectOption {
  value: string | number
  label: string
}

// Supported comparison operators for showIf
type ShowIfOperator = '==' | '!=' | '>' | '<' | '>=' | '<=' | 'includes' | 'notIncludes'

// ShowIf condition types
interface ShowIfCondition {
  field: string
  operator?: ShowIfOperator
  value: unknown
}

interface ConfigFieldBase {
  type: string
  label?: string
  description?: string
  default?: unknown
  required?: boolean
  showIf?: ShowIfCondition | ShowIfCondition[]
}

interface StringField extends ConfigFieldBase {
  type: 'string'
  default?: string
}

interface NumberField extends ConfigFieldBase {
  type: 'number'
  default?: number
  min?: number
  max?: number
  step?: number
}

interface BooleanField extends ConfigFieldBase {
  type: 'boolean'
  default?: boolean
}

interface SelectField extends ConfigFieldBase {
  type: 'select'
  options: SelectOption[]
  default?: string | number
}

interface ColorField extends ConfigFieldBase {
  type: 'color'
  default?: string
}

interface PasswordField extends ConfigFieldBase {
  type: 'password'
  default?: string
}

interface GroupField extends ConfigFieldBase {
  type: 'group'
  fields: Record<string, ConfigField>
}

interface ProviderSelectField extends ConfigFieldBase {
  type: 'provider-select'
  capability?: 'text' | 'image' | 'video' | 'audio' | 'tts' | 'text-generation' | 'image-generation' | 'video-generation' | 'audio-tts'
  providerCapability?: string // Alternative property name used in module.json
  default?: string
}

type ConfigField = StringField | NumberField | BooleanField | SelectField | ColorField | PasswordField | GroupField | ProviderSelectField

interface ConfigSchema {
  [key: string]: ConfigField
}

interface I18nConfig {
  label?: string
  description?: string
  options?: Record<string, string>
}

interface Props {
  schema: ConfigSchema
  modelValue: Record<string, unknown>
  i18n?: Record<string, I18nConfig>
  disabled?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, unknown>]
}>()

// Local config values
const localValues = ref<Record<string, unknown>>({})

// Initialize local values from modelValue
watch(
  () => props.modelValue,
  (newVal) => {
    localValues.value = { ...newVal }
  },
  { immediate: true, deep: true }
)

// Get value with default fallback
function getValue(key: string, field: ConfigField): unknown {
  if (localValues.value[key] !== undefined) {
    return localValues.value[key]
  }
  return field.default
}

// Update a single value
function updateValue(key: string, value: unknown) {
  localValues.value = { ...localValues.value, [key]: value }
  emit('update:modelValue', localValues.value)
}

// Update nested group value
function updateGroupValue(groupKey: string, fieldKey: string, value: unknown) {
  const groupValue = (localValues.value[groupKey] as Record<string, unknown>) || {}
  const newGroupValue = { ...groupValue, [fieldKey]: value }
  updateValue(groupKey, newGroupValue)
}

// Get nested group value
function getGroupValue(groupKey: string, fieldKey: string, field: ConfigField): unknown {
  const groupValue = localValues.value[groupKey] as Record<string, unknown> | undefined
  if (groupValue && groupValue[fieldKey] !== undefined) {
    return groupValue[fieldKey]
  }
  return field.default
}

// Evaluate a single showIf condition
function evaluateCondition(condition: ShowIfCondition): boolean {
  const fieldValue = getValue(condition.field, props.schema[condition.field])
  const targetValue = condition.value
  const operator = condition.operator || '=='

  switch (operator) {
    case '==':
      return fieldValue === targetValue
    case '!=':
      return fieldValue !== targetValue
    case '>':
      return typeof fieldValue === 'number' && typeof targetValue === 'number' && fieldValue > targetValue
    case '<':
      return typeof fieldValue === 'number' && typeof targetValue === 'number' && fieldValue < targetValue
    case '>=':
      return typeof fieldValue === 'number' && typeof targetValue === 'number' && fieldValue >= targetValue
    case '<=':
      return typeof fieldValue === 'number' && typeof targetValue === 'number' && fieldValue <= targetValue
    case 'includes':
      if (Array.isArray(fieldValue)) {
        return fieldValue.includes(targetValue)
      }
      if (typeof fieldValue === 'string' && typeof targetValue === 'string') {
        return fieldValue.includes(targetValue)
      }
      return false
    case 'notIncludes':
      if (Array.isArray(fieldValue)) {
        return !fieldValue.includes(targetValue)
      }
      if (typeof fieldValue === 'string' && typeof targetValue === 'string') {
        return !fieldValue.includes(targetValue)
      }
      return true
    default:
      return fieldValue === targetValue
  }
}

// Check if field should be shown based on showIf condition
function shouldShowField(field: ConfigField): boolean {
  if (!field.showIf) return true

  // Handle array of conditions (AND logic - all must be true)
  if (Array.isArray(field.showIf)) {
    return field.showIf.every(condition => evaluateCondition(condition))
  }

  // Handle single condition
  return evaluateCondition(field.showIf)
}

// Get translated label
function getLabel(key: string, field: ConfigField): string {
  return props.i18n?.[key]?.label || field.label || key
}

// Get translated description
function getDescription(key: string, field: ConfigField): string | undefined {
  return props.i18n?.[key]?.description || field.description
}

// Get translated option label
function getOptionLabel(fieldKey: string, optionValue: string | number, optionLabel: string): string {
  const i18nOptions = props.i18n?.[fieldKey]?.options
  if (i18nOptions && typeof optionValue === 'string' && i18nOptions[optionValue]) {
    return i18nOptions[optionValue]
  }
  return optionLabel
}

// Sorted field entries for consistent ordering
const sortedFields = computed(() => {
  return Object.entries(props.schema).filter(([_, field]) => shouldShowField(field))
})

// Check if a field is a media URL field (for using MediaUpload)
function isMediaField(key: string, field: ConfigField): boolean {
  if (field.type !== 'string') return false
  const lowerKey = key.toLowerCase()
  return (
    lowerKey.includes('url') ||
    lowerKey.includes('image') ||
    lowerKey.includes('media') ||
    lowerKey.includes('sound') ||
    lowerKey.includes('audio')
  )
}

// Determine media type from field key
function getMediaType(key: string): 'image' | 'animation' | 'sound' {
  const lowerKey = key.toLowerCase()
  if (lowerKey.includes('sound') || lowerKey.includes('audio')) return 'sound'
  if (lowerKey.includes('animation') || lowerKey.includes('gif') || lowerKey.includes('video')) return 'animation'
  return 'image'
}

// AI Providers for provider-select field type
interface AIProvider {
  id: string
  name: string
  configured: boolean
  capabilities: string[]
}

const aiProviders = ref<AIProvider[]>([])
const providersLoading = ref(false)
const providersLoaded = ref(false)

// Check if schema has any provider-select fields (including nested in groups)
const hasProviderSelectFields = computed(() => {
  for (const field of Object.values(props.schema)) {
    if (field.type === 'provider-select') return true
    if (field.type === 'group') {
      const groupField = field as GroupField
      if (Object.values(groupField.fields).some(f => f.type === 'provider-select')) {
        return true
      }
    }
  }
  return false
})

// Load AI providers if needed
async function loadAIProviders() {
  if (providersLoaded.value || providersLoading.value) return
  providersLoading.value = true
  try {
    const response = await api.getAIProviders()
    aiProviders.value = response.providers
    providersLoaded.value = true
  } catch (e) {
    console.error('Failed to load AI providers:', e)
  } finally {
    providersLoading.value = false
  }
}

// Map short capability names to full API capability names
function mapCapabilityToApi(capability: string): string {
  const capabilityMap: Record<string, string> = {
    'text': 'text-generation',
    'image': 'image-generation',
    'video': 'video-generation',
    'audio': 'audio-tts',
    'tts': 'audio-tts',
  }
  return capabilityMap[capability] || capability
}

// Get the capability from a provider-select field (supports both property names)
function getFieldCapability(field: ProviderSelectField): string {
  return field.providerCapability || field.capability || ''
}

// Get providers filtered by capability
function getProvidersForCapability(capability: string): AIProvider[] {
  const mappedCapability = mapCapabilityToApi(capability)
  return aiProviders.value.filter(p => p.configured && p.capabilities.includes(mappedCapability))
}

// Load providers on mount if needed
onMounted(() => {
  if (hasProviderSelectFields.value) {
    loadAIProviders()
  }
})

// Watch for schema changes
watch(hasProviderSelectFields, (hasFields) => {
  if (hasFields && !providersLoaded.value) {
    loadAIProviders()
  }
})
</script>

<template>
  <div class="space-y-6">
    <template v-for="[key, field] in sortedFields" :key="key">
      <!-- String Field -->
      <div v-if="field.type === 'string' && !isMediaField(key, field)">
        <BaseInput
          :model-value="(getValue(key, field) as string) || ''"
          @update:model-value="updateValue(key, $event)"
          :label="getLabel(key, field)"
          :disabled="disabled"
        />
        <p v-if="getDescription(key, field)" class="text-sm text-dark-400 mt-1">
          {{ getDescription(key, field) }}
        </p>
      </div>

      <!-- Password Field -->
      <div v-else-if="field.type === 'password'">
        <BaseInput
          :model-value="(getValue(key, field) as string) || ''"
          @update:model-value="updateValue(key, $event)"
          :label="getLabel(key, field)"
          type="password"
          autocomplete="off"
          :disabled="disabled"
        />
        <p v-if="getDescription(key, field)" class="text-sm text-dark-400 mt-1">
          {{ getDescription(key, field) }}
        </p>
      </div>

      <!-- Media URL Field -->
      <div v-else-if="field.type === 'string' && isMediaField(key, field)">
        <MediaUpload
          :model-value="(getValue(key, field) as string) || ''"
          @update:model-value="updateValue(key, $event)"
          :label="getLabel(key, field)"
          :media-type="getMediaType(key)"
          :disabled="disabled"
        />
        <p v-if="getDescription(key, field)" class="text-sm text-dark-400 mt-1">
          {{ getDescription(key, field) }}
        </p>
      </div>

      <!-- Number Field -->
      <div v-else-if="field.type === 'number'">
        <label class="block text-sm font-medium text-dark-200 mb-2">
          {{ getLabel(key, field) }}
          <span v-if="(field as NumberField).max" class="text-dark-400 font-normal">
            : {{ getValue(key, field) }}
          </span>
        </label>
        <input
          v-if="(field as NumberField).max"
          type="range"
          :value="getValue(key, field) as number"
          @input="updateValue(key, Number(($event.target as HTMLInputElement).value))"
          :min="(field as NumberField).min ?? 0"
          :max="(field as NumberField).max"
          :step="(field as NumberField).step ?? 1"
          :disabled="disabled"
          class="w-full accent-autodarts-500"
        />
        <input
          v-else
          type="number"
          :value="getValue(key, field) as number"
          @input="updateValue(key, Number(($event.target as HTMLInputElement).value))"
          :min="(field as NumberField).min"
          :step="(field as NumberField).step ?? 1"
          :disabled="disabled"
          class="w-full px-4 py-2.5 rounded-lg bg-dark-800 border border-dark-600 text-white focus:outline-none focus:ring-2 focus:ring-autodarts-500 disabled:opacity-50"
        />
        <p v-if="getDescription(key, field)" class="text-sm text-dark-400 mt-1">
          {{ getDescription(key, field) }}
        </p>
      </div>

      <!-- Boolean Field -->
      <div v-else-if="field.type === 'boolean'" class="flex items-center justify-between p-4 rounded-lg bg-dark-700/50 border border-dark-600">
        <div>
          <p class="text-white font-medium">{{ getLabel(key, field) }}</p>
          <p v-if="getDescription(key, field)" class="text-sm text-dark-400 mt-1">
            {{ getDescription(key, field) }}
          </p>
        </div>
        <button
          type="button"
          @click="updateValue(key, !getValue(key, field))"
          :disabled="disabled"
          :class="[
            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50',
            getValue(key, field) ? 'bg-autodarts-600' : 'bg-dark-600',
          ]"
        >
          <span
            :class="[
              'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
              getValue(key, field) ? 'translate-x-6' : 'translate-x-1',
            ]"
          />
        </button>
      </div>

      <!-- Select Field -->
      <div v-else-if="field.type === 'select'">
        <label class="block text-sm font-medium text-dark-200 mb-2">
          {{ getLabel(key, field) }}
        </label>
        <select
          :value="getValue(key, field)"
          @change="updateValue(key, ($event.target as HTMLSelectElement).value)"
          :disabled="disabled"
          class="w-full px-4 py-2.5 rounded-lg bg-dark-800 border border-dark-600 text-white focus:outline-none focus:ring-2 focus:ring-autodarts-500 disabled:opacity-50"
        >
          <option
            v-for="option in (field as SelectField).options"
            :key="option.value"
            :value="option.value"
          >
            {{ getOptionLabel(key, option.value, option.label) }}
          </option>
        </select>
        <p v-if="getDescription(key, field)" class="text-sm text-dark-400 mt-1">
          {{ getDescription(key, field) }}
        </p>
      </div>

      <!-- Provider Select Field -->
      <div v-else-if="field.type === 'provider-select'">
        <label class="block text-sm font-medium text-dark-200 mb-2">
          {{ getLabel(key, field) }}
        </label>
        <div v-if="providersLoading" class="flex items-center gap-2 text-dark-400 text-sm py-2">
          <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Loading providers...
        </div>
        <template v-else>
          <select
            :value="getValue(key, field)"
            @change="updateValue(key, ($event.target as HTMLSelectElement).value)"
            :disabled="disabled || getProvidersForCapability(getFieldCapability(field as ProviderSelectField)).length === 0"
            class="w-full px-4 py-2.5 rounded-lg bg-dark-800 border border-dark-600 text-white focus:outline-none focus:ring-2 focus:ring-autodarts-500 disabled:opacity-50"
          >
            <option value="">-- Select Provider --</option>
            <option
              v-for="provider in getProvidersForCapability(getFieldCapability(field as ProviderSelectField))"
              :key="provider.id"
              :value="provider.id"
            >
              {{ provider.name }}
            </option>
          </select>
          <p v-if="getProvidersForCapability(getFieldCapability(field as ProviderSelectField)).length === 0" class="text-sm text-amber-400 mt-1">
            No providers configured for {{ getFieldCapability(field as ProviderSelectField) }}. Configure one in AI Settings.
          </p>
          <p v-else-if="getDescription(key, field)" class="text-sm text-dark-400 mt-1">
            {{ getDescription(key, field) }}
          </p>
        </template>
      </div>

      <!-- Color Field -->
      <div v-else-if="field.type === 'color'">
        <label class="block text-sm font-medium text-dark-200 mb-2">
          {{ getLabel(key, field) }}
        </label>
        <div class="flex items-center gap-3">
          <input
            type="color"
            :value="getValue(key, field) as string"
            @input="updateValue(key, ($event.target as HTMLInputElement).value)"
            :disabled="disabled"
            class="w-12 h-10 rounded-lg cursor-pointer border border-dark-600 bg-transparent disabled:opacity-50"
          />
          <input
            type="text"
            :value="getValue(key, field) as string"
            @input="updateValue(key, ($event.target as HTMLInputElement).value)"
            :disabled="disabled"
            placeholder="#FFFFFF"
            class="flex-1 px-4 py-2 rounded-lg bg-dark-800 border border-dark-600 text-white focus:outline-none focus:ring-2 focus:ring-autodarts-500 font-mono text-sm uppercase disabled:opacity-50"
          />
        </div>
        <p v-if="getDescription(key, field)" class="text-sm text-dark-400 mt-1">
          {{ getDescription(key, field) }}
        </p>
      </div>

      <!-- Group Field -->
      <div v-else-if="field.type === 'group'" class="space-y-4 p-4 rounded-lg border border-dark-600 bg-dark-700/30">
        <div class="mb-4">
          <h4 class="text-white font-medium">{{ getLabel(key, field) }}</h4>
          <p v-if="getDescription(key, field)" class="text-sm text-dark-400 mt-1">
            {{ getDescription(key, field) }}
          </p>
        </div>

        <!-- Render nested fields -->
        <template v-for="[nestedKey, nestedField] in Object.entries((field as GroupField).fields)" :key="`${key}.${nestedKey}`">
          <!-- Nested String Field -->
          <div v-if="nestedField.type === 'string' && !isMediaField(nestedKey, nestedField)">
            <BaseInput
              :model-value="(getGroupValue(key, nestedKey, nestedField) as string) || ''"
              @update:model-value="updateGroupValue(key, nestedKey, $event)"
              :label="nestedField.label || nestedKey"
              :disabled="disabled"
            />
            <p v-if="nestedField.description" class="text-sm text-dark-400 mt-1">
              {{ nestedField.description }}
            </p>
          </div>

          <!-- Nested Password Field -->
          <div v-else-if="nestedField.type === 'password'">
            <BaseInput
              :model-value="(getGroupValue(key, nestedKey, nestedField) as string) || ''"
              @update:model-value="updateGroupValue(key, nestedKey, $event)"
              :label="nestedField.label || nestedKey"
              type="password"
              autocomplete="off"
              :disabled="disabled"
            />
            <p v-if="nestedField.description" class="text-sm text-dark-400 mt-1">
              {{ nestedField.description }}
            </p>
          </div>

          <!-- Nested Media Field -->
          <div v-else-if="nestedField.type === 'string' && isMediaField(nestedKey, nestedField)">
            <MediaUpload
              :model-value="(getGroupValue(key, nestedKey, nestedField) as string) || ''"
              @update:model-value="updateGroupValue(key, nestedKey, $event)"
              :label="nestedField.label || nestedKey"
              :media-type="getMediaType(nestedKey)"
              :disabled="disabled"
            />
          </div>

          <!-- Nested Number Field -->
          <div v-else-if="nestedField.type === 'number'">
            <label class="block text-sm font-medium text-dark-200 mb-2">
              {{ nestedField.label || nestedKey }}
              <span v-if="(nestedField as NumberField).max" class="text-dark-400 font-normal">
                : {{ getGroupValue(key, nestedKey, nestedField) }}
              </span>
            </label>
            <input
              v-if="(nestedField as NumberField).max"
              type="range"
              :value="getGroupValue(key, nestedKey, nestedField) as number"
              @input="updateGroupValue(key, nestedKey, Number(($event.target as HTMLInputElement).value))"
              :min="(nestedField as NumberField).min ?? 0"
              :max="(nestedField as NumberField).max"
              :step="(nestedField as NumberField).step ?? 1"
              :disabled="disabled"
              class="w-full accent-autodarts-500"
            />
            <input
              v-else
              type="number"
              :value="getGroupValue(key, nestedKey, nestedField) as number"
              @input="updateGroupValue(key, nestedKey, Number(($event.target as HTMLInputElement).value))"
              :min="(nestedField as NumberField).min"
              :step="(nestedField as NumberField).step ?? 1"
              :disabled="disabled"
              class="w-full px-4 py-2.5 rounded-lg bg-dark-800 border border-dark-600 text-white focus:outline-none focus:ring-2 focus:ring-autodarts-500 disabled:opacity-50"
            />
          </div>

          <!-- Nested Select Field -->
          <div v-else-if="nestedField.type === 'select'">
            <label class="block text-sm font-medium text-dark-200 mb-2">
              {{ nestedField.label || nestedKey }}
            </label>
            <select
              :value="getGroupValue(key, nestedKey, nestedField)"
              @change="updateGroupValue(key, nestedKey, ($event.target as HTMLSelectElement).value)"
              :disabled="disabled"
              class="w-full px-4 py-2.5 rounded-lg bg-dark-800 border border-dark-600 text-white focus:outline-none focus:ring-2 focus:ring-autodarts-500 disabled:opacity-50"
            >
              <option
                v-for="option in (nestedField as SelectField).options"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </div>

          <!-- Nested Provider Select Field -->
          <div v-else-if="nestedField.type === 'provider-select'">
            <label class="block text-sm font-medium text-dark-200 mb-2">
              {{ nestedField.label || nestedKey }}
            </label>
            <div v-if="providersLoading" class="flex items-center gap-2 text-dark-400 text-sm py-2">
              <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Loading providers...
            </div>
            <template v-else>
              <select
                :value="getGroupValue(key, nestedKey, nestedField)"
                @change="updateGroupValue(key, nestedKey, ($event.target as HTMLSelectElement).value)"
                :disabled="disabled || getProvidersForCapability(getFieldCapability(nestedField as ProviderSelectField)).length === 0"
                class="w-full px-4 py-2.5 rounded-lg bg-dark-800 border border-dark-600 text-white focus:outline-none focus:ring-2 focus:ring-autodarts-500 disabled:opacity-50"
              >
                <option value="">-- Select Provider --</option>
                <option
                  v-for="provider in getProvidersForCapability(getFieldCapability(nestedField as ProviderSelectField))"
                  :key="provider.id"
                  :value="provider.id"
                >
                  {{ provider.name }}
                </option>
              </select>
              <p v-if="getProvidersForCapability(getFieldCapability(nestedField as ProviderSelectField)).length === 0" class="text-sm text-amber-400 mt-1">
                No providers configured for {{ getFieldCapability(nestedField as ProviderSelectField) }}.
              </p>
            </template>
          </div>

          <!-- Nested Boolean Field -->
          <div v-else-if="nestedField.type === 'boolean'" class="flex items-center justify-between p-3 rounded-lg bg-dark-800/50 border border-dark-600">
            <div>
              <p class="text-white text-sm font-medium">{{ nestedField.label || nestedKey }}</p>
              <p v-if="nestedField.description" class="text-xs text-dark-400 mt-0.5">
                {{ nestedField.description }}
              </p>
            </div>
            <button
              type="button"
              @click="updateGroupValue(key, nestedKey, !getGroupValue(key, nestedKey, nestedField))"
              :disabled="disabled"
              :class="[
                'relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50',
                getGroupValue(key, nestedKey, nestedField) ? 'bg-autodarts-600' : 'bg-dark-600',
              ]"
            >
              <span
                :class="[
                  'inline-block h-3 w-3 transform rounded-full bg-white transition-transform',
                  getGroupValue(key, nestedKey, nestedField) ? 'translate-x-5' : 'translate-x-1',
                ]"
              />
            </button>
          </div>

          <!-- Nested Color Field -->
          <div v-else-if="nestedField.type === 'color'">
            <label class="block text-sm font-medium text-dark-200 mb-2">
              {{ nestedField.label || nestedKey }}
            </label>
            <div class="flex items-center gap-2">
              <input
                type="color"
                :value="getGroupValue(key, nestedKey, nestedField) as string"
                @input="updateGroupValue(key, nestedKey, ($event.target as HTMLInputElement).value)"
                :disabled="disabled"
                class="w-10 h-8 rounded-lg cursor-pointer border border-dark-600 bg-transparent disabled:opacity-50"
              />
              <input
                type="text"
                :value="getGroupValue(key, nestedKey, nestedField) as string"
                @input="updateGroupValue(key, nestedKey, ($event.target as HTMLInputElement).value)"
                :disabled="disabled"
                placeholder="#FFFFFF"
                class="flex-1 px-3 py-1.5 rounded-lg bg-dark-800 border border-dark-600 text-white text-sm font-mono uppercase disabled:opacity-50"
              />
            </div>
          </div>
        </template>
      </div>
    </template>
  </div>
</template>
