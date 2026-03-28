<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  name: string
  color: string
  avatar?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
})

const sizeClasses = {
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-14 h-14 text-xl',
  xl: 'w-20 h-20 text-3xl',
}

const initials = computed(() => {
  return props.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
})

// Determine if color is light or dark for text contrast
const textColorClass = computed(() => {
  const hex = props.color.replace('#', '')
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? 'text-dark-900' : 'text-white'
})
</script>

<template>
  <div
    :class="[
      'rounded-full flex items-center justify-center font-bold flex-shrink-0',
      sizeClasses[size],
      textColorClass,
    ]"
    :style="{ backgroundColor: color }"
  >
    <!-- Custom avatar icons -->
    <svg
      v-if="avatar === 'dart'"
      class="w-1/2 h-1/2"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M12 2L2 12l10 10 10-10L12 2zm0 3.83L18.17 12 12 18.17 5.83 12 12 5.83z"/>
    </svg>
    <svg
      v-else-if="avatar === 'bullseye'"
      class="w-1/2 h-1/2"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/>
      <circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" stroke-width="2"/>
      <circle cx="12" cy="12" r="2"/>
    </svg>
    <svg
      v-else-if="avatar === 'trophy'"
      class="w-1/2 h-1/2"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/>
    </svg>
    <svg
      v-else-if="avatar === 'star'"
      class="w-1/2 h-1/2"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
    </svg>
    <svg
      v-else-if="avatar === 'crown'"
      class="w-1/2 h-1/2"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"/>
    </svg>
    <svg
      v-else-if="avatar === 'fire'"
      class="w-1/2 h-1/2"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z"/>
    </svg>
    <svg
      v-else-if="avatar === 'bolt'"
      class="w-1/2 h-1/2"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M7 2v11h3v9l7-12h-4l4-8z"/>
    </svg>
    <!-- Default: initials -->
    <span v-else>{{ initials }}</span>
  </div>
</template>
