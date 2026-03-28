<script setup lang="ts">
import { computed } from 'vue'
import type { ModuleStatus } from '../types/api'

interface Props {
  status: ModuleStatus | 'connected' | 'disconnected'
}

const props = defineProps<Props>()

const statusConfig = computed(() => {
  const configs: Record<
    string,
    { label: string; bgColor: string; textColor: string; dotColor: string }
  > = {
    running: {
      label: 'Running',
      bgColor: 'bg-green-500/10',
      textColor: 'text-green-400',
      dotColor: 'bg-green-500',
    },
    connected: {
      label: 'Connected',
      bgColor: 'bg-green-500/10',
      textColor: 'text-green-400',
      dotColor: 'bg-green-500',
    },
    stopped: {
      label: 'Stopped',
      bgColor: 'bg-dark-600/50',
      textColor: 'text-dark-300',
      dotColor: 'bg-dark-400',
    },
    disconnected: {
      label: 'Disconnected',
      bgColor: 'bg-dark-600/50',
      textColor: 'text-dark-300',
      dotColor: 'bg-dark-400',
    },
    starting: {
      label: 'Starting',
      bgColor: 'bg-yellow-500/10',
      textColor: 'text-yellow-400',
      dotColor: 'bg-yellow-500',
    },
    stopping: {
      label: 'Stopping',
      bgColor: 'bg-yellow-500/10',
      textColor: 'text-yellow-400',
      dotColor: 'bg-yellow-500',
    },
    error: {
      label: 'Error',
      bgColor: 'bg-red-500/10',
      textColor: 'text-red-400',
      dotColor: 'bg-red-500',
    },
  }

  return configs[props.status] || configs.stopped
})
</script>

<template>
  <span
    :class="[
      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
      statusConfig.bgColor,
      statusConfig.textColor,
    ]"
  >
    <span
      :class="[
        'w-1.5 h-1.5 rounded-full',
        statusConfig.dotColor,
        status === 'starting' || status === 'stopping' ? 'animate-pulse' : '',
      ]"
    />
    {{ statusConfig.label }}
  </span>
</template>
