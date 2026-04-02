<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import BaseCard from './BaseCard.vue'
import BaseButton from './BaseButton.vue'
import DynamicConfigForm from './DynamicConfigForm.vue'

// Props
interface Props {
  // Card title
  title: string
  // Card subtitle
  subtitle?: string
  // Configuration schema from module.json
  schema: Record<string, unknown>
  // Current configuration values
  modelValue: Record<string, unknown>
  // i18n translations for config fields
  i18n?: Record<string, { label?: string; description?: string; options?: Record<string, string> }>
  // Whether the form is currently saving
  loading?: boolean
  // Save button label
  saveLabel?: string
  // Whether to show the save button
  showSaveButton?: boolean
  // Whether the form is disabled
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  subtitle: '',
  i18n: () => ({}),
  loading: false,
  saveLabel: 'Save',
  showSaveButton: true,
  disabled: false,
})

// Emits
const emit = defineEmits<{
  (e: 'update:modelValue', value: Record<string, unknown>): void
  (e: 'save'): void
}>()

// Local values for editing
const localValues = ref<Record<string, unknown>>({})

// Sync local values with model value
watch(
  () => props.modelValue,
  (newVal) => {
    localValues.value = { ...newVal }
  },
  { immediate: true, deep: true }
)

// Update handler
function handleUpdate(value: Record<string, unknown>) {
  localValues.value = value
  emit('update:modelValue', value)
}

// Save handler
function handleSave() {
  emit('save')
}

// Check if there are any config fields
const hasConfig = computed(() => {
  return Object.keys(props.schema).length > 0
})
</script>

<template>
  <BaseCard :title="title" :subtitle="subtitle">
    <!-- Empty state -->
    <div v-if="!hasConfig" class="text-center py-8">
      <svg class="w-12 h-12 mx-auto text-dark-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
      <p class="text-dark-400">
        <slot name="empty">No configuration options available</slot>
      </p>
    </div>

    <!-- Configuration form -->
    <template v-else>
      <!-- Custom header slot -->
      <slot name="header" />

      <!-- Dynamic config form -->
      <DynamicConfigForm
        :schema="(schema as any)"
        :model-value="localValues"
        :i18n="i18n"
        :disabled="disabled"
        @update:model-value="handleUpdate"
      />

      <!-- Custom content slot (after form, before footer) -->
      <slot name="content" />
    </template>

    <!-- Footer with save button -->
    <template #footer v-if="hasConfig && showSaveButton">
      <div class="flex items-center justify-between">
        <!-- Message slot -->
        <slot name="message" />
        <div v-if="!$slots.message" />

        <BaseButton
          :loading="loading"
          :disabled="disabled"
          @click="handleSave"
        >
          {{ saveLabel }}
        </BaseButton>
      </div>
    </template>
  </BaseCard>
</template>
