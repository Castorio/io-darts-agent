<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameDisplayStore, type AnimationEventType } from '../stores/gameDisplay'

const { t } = useI18n()
const store = useGameDisplayStore()

const animation = computed(() => store.activeAnimation)
const videoRef = ref<HTMLVideoElement | null>(null)
const audioRef = ref<HTMLAudioElement | null>(null)

// Determine if URL is a video or image
const isVideo = computed(() => {
  if (!animation.value?.url) return false
  const url = animation.value.url.toLowerCase()
  return url.endsWith('.mp4') || url.endsWith('.webm') || url.endsWith('.mov')
})

// Get animation title for display
const animationTitle = computed((): string => {
  if (!animation.value) return ''
  return t(`animations.${animation.value.type}`)
})

// Get animation color scheme
const animationColor = computed((): string => {
  if (!animation.value) return '#3b82f6'
  const colors: Record<AnimationEventType, string> = {
    '180': '#fbbf24', // Gold
    'bull': '#ef4444', // Red
    'doubleBull': '#dc2626', // Dark Red
    'highScore': '#22c55e', // Green
    'checkout': '#10b981', // Emerald
    'legWin': '#8b5cf6', // Purple
    'setWin': '#a855f7', // Purple
    'matchWin': '#f59e0b', // Amber
    'bust': '#ef4444', // Red
  }
  return colors[animation.value.type] || '#3b82f6'
})

// Play sound when animation starts
watch(animation, (newAnim) => {
  if (newAnim?.sound && audioRef.value) {
    audioRef.value.src = newAnim.sound
    audioRef.value.play().catch(() => {
      // Audio autoplay might be blocked
    })
  }
})

// Handle video end
function onVideoEnded() {
  store.dismissAnimation()
}

// Dismiss on click
function dismissOnClick() {
  store.dismissAnimation()
}

// Keyboard dismiss
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' || e.key === ' ') {
    store.dismissAnimation()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Transition
    enter-active-class="transition-all duration-300 ease-out"
    enter-from-class="opacity-0 scale-90"
    enter-to-class="opacity-100 scale-100"
    leave-active-class="transition-all duration-200 ease-in"
    leave-from-class="opacity-100 scale-100"
    leave-to-class="opacity-0 scale-110"
  >
    <div
      v-if="animation"
      class="fixed inset-0 z-[100] flex items-center justify-center cursor-pointer"
      @click="dismissOnClick"
    >
      <!-- Dark overlay -->
      <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      <!-- Animation container -->
      <div class="relative z-10 flex flex-col items-center gap-6 max-w-4xl px-8">
        <!-- Title (shown above media if no custom animation URL) -->
        <h2
          v-if="!animation.url"
          class="text-6xl lg:text-8xl font-black tracking-tight animate-bounce-in"
          :style="{ color: animationColor, textShadow: `0 0 60px ${animationColor}80` }"
        >
          {{ animationTitle }}
        </h2>

        <!-- Media container -->
        <div
          v-if="animation.url"
          class="relative rounded-2xl overflow-hidden shadow-2xl animate-scale-in"
          :style="{ boxShadow: `0 0 100px ${animationColor}40` }"
        >
          <!-- Video -->
          <video
            v-if="isVideo"
            ref="videoRef"
            :src="animation.url"
            autoplay
            playsinline
            class="max-w-full max-h-[70vh] object-contain"
            @ended="onVideoEnded"
          />

          <!-- Image/GIF -->
          <img
            v-else
            :src="animation.url"
            :alt="animationTitle"
            class="max-w-full max-h-[70vh] object-contain"
          />

          <!-- Title overlay for media -->
          <div
            v-if="animationTitle"
            class="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent"
          >
            <h2
              class="text-4xl lg:text-6xl font-black text-center tracking-tight"
              :style="{ color: animationColor, textShadow: `0 0 40px ${animationColor}80` }"
            >
              {{ animationTitle }}
            </h2>
          </div>
        </div>

        <!-- Default fallback animation (no media URL) -->
        <div
          v-if="!animation.url"
          class="relative"
        >
          <!-- Animated glow circles -->
          <div
            class="absolute inset-0 rounded-full animate-ping-slow"
            :style="{ background: `radial-gradient(circle, ${animationColor}40 0%, transparent 70%)` }"
          />
          <div
            class="w-48 h-48 rounded-full flex items-center justify-center animate-pulse"
            :style="{ background: `radial-gradient(circle, ${animationColor}30 0%, transparent 70%)` }"
          >
            <!-- Event-specific icon -->
            <svg
              v-if="animation.type === '180' || animation.type === 'highScore'"
              class="w-24 h-24"
              :style="{ color: animationColor }"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
            </svg>
            <svg
              v-else-if="animation.type === 'bull' || animation.type === 'doubleBull'"
              class="w-24 h-24"
              :style="{ color: animationColor }"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <circle cx="12" cy="12" r="10" />
            </svg>
            <svg
              v-else-if="animation.type === 'checkout' || animation.type === 'legWin' || animation.type === 'matchWin'"
              class="w-24 h-24"
              :style="{ color: animationColor }"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
            </svg>
            <svg
              v-else-if="animation.type === 'bust'"
              class="w-24 h-24"
              :style="{ color: animationColor }"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        </div>

        <!-- Dismiss hint -->
        <p class="text-white/40 text-sm animate-fade-in-delayed">
          {{ t('animations.clickToClose') }}
        </p>
      </div>

      <!-- Audio element (hidden) -->
      <audio ref="audioRef" class="hidden" />
    </div>
  </Transition>
</template>

<style scoped>
@keyframes bounce-in {
  0% {
    opacity: 0;
    transform: scale(0.3);
  }
  50% {
    transform: scale(1.1);
  }
  70% {
    transform: scale(0.9);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes scale-in {
  0% {
    opacity: 0;
    transform: scale(0.8);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes ping-slow {
  0% {
    transform: scale(1);
    opacity: 0.6;
  }
  50% {
    transform: scale(2);
    opacity: 0;
  }
  100% {
    transform: scale(1);
    opacity: 0.6;
  }
}

@keyframes fade-in-delayed {
  0%, 60% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}

.animate-bounce-in {
  animation: bounce-in 0.6s ease-out;
}

.animate-scale-in {
  animation: scale-in 0.4s ease-out;
}

.animate-ping-slow {
  animation: ping-slow 2s ease-in-out infinite;
}

.animate-fade-in-delayed {
  animation: fade-in-delayed 1.5s ease-out forwards;
}
</style>
