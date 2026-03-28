<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  modelValue: string
  label?: string
  type?: 'text' | 'password' | 'email'
  placeholder?: string
  error?: string
  disabled?: boolean
  required?: boolean
  autocomplete?: string
}

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  placeholder: '',
  disabled: false,
  required: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const inputValue = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})
</script>

<template>
  <div class="space-y-1">
    <label
      v-if="label"
      class="block text-sm font-medium text-dark-200"
    >
      {{ label }}
      <span v-if="required" class="text-red-500">*</span>
    </label>
    <input
      v-model="inputValue"
      :type="type"
      :placeholder="placeholder"
      :disabled="disabled"
      :required="required"
      :autocomplete="autocomplete"
      :class="[
        'w-full px-4 py-2.5 rounded-lg bg-dark-800 border transition-colors duration-200',
        'text-white placeholder-dark-400',
        'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-dark-900',
        error
          ? 'border-red-500 focus:ring-red-500'
          : 'border-dark-600 focus:border-autodarts-500 focus:ring-autodarts-500',
        'disabled:opacity-50 disabled:cursor-not-allowed',
      ]"
    />
    <p v-if="error" class="text-sm text-red-500">{{ error }}</p>
  </div>
</template>
