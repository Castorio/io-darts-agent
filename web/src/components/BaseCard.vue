<script setup lang="ts">
interface Props {
  title?: string
  subtitle?: string
}

defineProps<Props>()
</script>

<template>
  <div class="bg-dark-800 rounded-xl border border-dark-700 overflow-hidden">
    <div v-if="title || $slots.header" class="px-6 py-4 border-b border-dark-700">
      <slot name="header">
        <h3 v-if="title" class="text-lg font-semibold text-white">{{ title }}</h3>
        <p v-if="subtitle" class="mt-1 text-sm text-dark-400">{{ subtitle }}</p>
      </slot>
    </div>
    <div class="p-6">
      <slot />
    </div>
    <div v-if="$slots.footer" class="px-6 py-4 border-t border-dark-700 bg-dark-850">
      <slot name="footer" />
    </div>
  </div>
</template>
