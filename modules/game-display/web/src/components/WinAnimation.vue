<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameDisplayStore } from '../stores/gameDisplay'

const { t } = useI18n()
const store = useGameDisplayStore()

const animation = computed(() => store.activeAnimation)
const winData = computed(() => animation.value?.winData)
const winConfig = computed(() => animation.value?.winConfig)

// Computed configuration values with fallbacks
const showPlayerName = computed(() => winConfig.value?.showPlayerName ?? true)
const showStats = computed(() => winConfig.value?.showStats ?? (animation.value?.type === 'matchWin'))
const effectType = computed(() => winConfig.value?.effectType ?? 'confetti')
const backgroundColor = computed(() => winConfig.value?.backgroundColor ?? '#0a0a0f')
const textColor = computed(() => winConfig.value?.textColor ?? animationColor.value)

// Check if this is a win animation
const isWinAnimation = computed(() => {
  return animation.value?.type === 'matchWin' ||
         animation.value?.type === 'setWin' ||
         animation.value?.type === 'legWin'
})

// Get animation title
const animationTitle = computed(() => {
  if (!animation.value) return ''
  return t(`animations.${animation.value.type}`)
})

// Get animation color based on type
const animationColor = computed(() => {
  if (!animation.value) return '#fbbf24'
  const colors: Record<string, string> = {
    'matchWin': '#fbbf24', // Gold
    'setWin': '#a855f7',   // Purple
    'legWin': '#8b5cf6',   // Purple
  }
  return colors[animation.value.type] || '#fbbf24'
})

// Confetti particles
const particles = ref<Array<{
  id: number
  x: number
  y: number
  rotation: number
  color: string
  size: number
  delay: number
}>>([])

const confettiColors = ['#fbbf24', '#ef4444', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#f97316']

// Generate confetti particles
function generateConfetti() {
  const newParticles = []
  for (let i = 0; i < 100; i++) {
    newParticles.push({
      id: i,
      x: Math.random() * 100, // % position
      y: -10 - Math.random() * 20, // Start above viewport
      rotation: Math.random() * 360,
      color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
      size: 8 + Math.random() * 8,
      delay: Math.random() * 2,
    })
  }
  particles.value = newParticles
}

// Audio element for sound
const audioRef = ref<HTMLAudioElement | null>(null)

// Play sound when animation starts
function playSound() {
  if (animation.value?.sound && audioRef.value) {
    audioRef.value.src = animation.value.sound
    audioRef.value.play().catch(() => {
      // Audio autoplay might be blocked
    })
  }
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
  if (isWinAnimation.value) {
    generateConfetti()
    playSound()
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Transition
    enter-active-class="transition-all duration-500 ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition-all duration-300 ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="animation && isWinAnimation"
      class="fixed inset-0 z-[100] flex items-center justify-center cursor-pointer overflow-hidden"
      :style="{ backgroundColor: backgroundColor }"
      @click="dismissOnClick"
    >
      <!-- Confetti particles (only show if effectType is confetti) -->
      <div v-if="effectType === 'confetti'" class="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          v-for="particle in particles"
          :key="particle.id"
          class="absolute confetti-particle"
          :style="{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            backgroundColor: particle.color,
            transform: `rotate(${particle.rotation}deg)`,
            animationDelay: `${particle.delay}s`,
          }"
        />
      </div>

      <!-- Fireworks effect -->
      <div v-if="effectType === 'fireworks'" class="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          v-for="i in 20"
          :key="'fw-' + i"
          class="absolute firework-particle rounded-full"
          :style="{
            left: `${30 + Math.random() * 40}%`,
            top: `${30 + Math.random() * 40}%`,
            width: `${4 + Math.random() * 4}px`,
            height: `${4 + Math.random() * 4}px`,
            backgroundColor: confettiColors[i % confettiColors.length],
            animationDelay: `${Math.random() * 2}s`,
          }"
        />
      </div>

      <!-- Sparkles effect -->
      <div v-if="effectType === 'sparkles'" class="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          v-for="i in 30"
          :key="'sp-' + i"
          class="absolute sparkle-particle"
          :style="{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 3}s`,
          }"
        >
          <svg class="w-4 h-4" :style="{ color: confettiColors[i % confettiColors.length] }" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
          </svg>
        </div>
      </div>

      <!-- Animated background glow -->
      <div class="absolute inset-0 overflow-hidden">
        <div
          class="absolute w-[800px] h-[800px] rounded-full blur-[200px] opacity-30 animate-pulse-slow"
          :style="{
            background: animationColor,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }"
        />
      </div>

      <!-- Content container -->
      <div class="relative z-10 flex flex-col items-center gap-8 px-8 text-center">
        <!-- Trophy icon with glow -->
        <div class="relative animate-trophy-bounce">
          <!-- Glow effect -->
          <div
            class="absolute inset-0 blur-2xl opacity-60"
            :style="{ background: animationColor }"
          />
          <!-- Trophy SVG -->
          <svg
            class="relative w-32 h-32 lg:w-48 lg:h-48"
            :style="{ color: animationColor }"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M18 2c-.9 0-2 1-2 2H8c0-1-1.1-2-2-2H2v9c0 1 1 2 2 2h2.3c.4.8 1 1.5 1.8 2L7 18H6c-1.1 0-2 .9-2 2v2h16v-2c0-1.1-.9-2-2-2h-1l-1.1-3c.8-.5 1.4-1.2 1.8-2H20c1 0 2-1 2-2V2h-4zM6 11H4V4h2v7zm14 0h-2V4h2v7z"/>
          </svg>
        </div>

        <!-- Win title -->
        <h1
          class="text-6xl lg:text-9xl font-black tracking-tight animate-title-in uppercase"
          :style="{
            color: textColor,
            textShadow: `0 0 80px ${animationColor}80`
          }"
        >
          {{ animationTitle }}
        </h1>

        <!-- Winner name (configurable) -->
        <div
          v-if="winData?.winnerName && showPlayerName"
          class="flex flex-col items-center gap-2 animate-fade-up"
          style="animation-delay: 0.3s"
        >
          <span class="text-white/60 text-xl uppercase tracking-wider">{{ t('game.winner') }}</span>
          <h2
            class="text-4xl lg:text-6xl font-bold text-white uppercase tracking-wide"
            :style="{ textShadow: `0 0 40px ${animationColor}40` }"
          >
            {{ winData.winnerName }}
          </h2>
        </div>

        <!-- Stats section (configurable) -->
        <div
          v-if="winData?.stats && showStats"
          class="grid grid-cols-2 lg:grid-cols-4 gap-6 mt-4 animate-fade-up"
          style="animation-delay: 0.5s"
        >
          <!-- Average -->
          <div v-if="winData.stats.average" class="flex flex-col items-center p-4 rounded-xl bg-white/5 border border-white/10">
            <span class="text-white/50 text-sm uppercase tracking-wider">{{ t('game.average') }}</span>
            <span class="text-3xl lg:text-4xl font-bold text-white">{{ winData.stats.average.toFixed(1) }}</span>
          </div>

          <!-- Darts -->
          <div v-if="winData.stats.dartsThrown" class="flex flex-col items-center p-4 rounded-xl bg-white/5 border border-white/10">
            <span class="text-white/50 text-sm uppercase tracking-wider">{{ t('game.darts') }}</span>
            <span class="text-3xl lg:text-4xl font-bold text-white">{{ winData.stats.dartsThrown }}</span>
          </div>

          <!-- Checkout % -->
          <div v-if="winData.stats.checkoutPercent" class="flex flex-col items-center p-4 rounded-xl bg-white/5 border border-white/10">
            <span class="text-white/50 text-sm uppercase tracking-wider">{{ t('game.checkout') }}</span>
            <span class="text-3xl lg:text-4xl font-bold text-white">{{ winData.stats.checkoutPercent.toFixed(0) }}%</span>
          </div>

          <!-- 180s -->
          <div v-if="winData.stats.total180s" class="flex flex-col items-center p-4 rounded-xl bg-white/5 border border-white/10">
            <span class="text-white/50 text-sm uppercase tracking-wider">180s</span>
            <span class="text-3xl lg:text-4xl font-bold text-white">{{ winData.stats.total180s }}</span>
          </div>
        </div>

        <!-- Legs/Sets won -->
        <div
          v-if="winData?.legsWon !== undefined || winData?.setsWon !== undefined"
          class="flex items-center gap-8 mt-2 animate-fade-up"
          style="animation-delay: 0.6s"
        >
          <div v-if="winData.legsWon !== undefined" class="flex items-center gap-2">
            <span class="text-white/60 uppercase tracking-wider">{{ t('score.legs') }}</span>
            <span class="text-2xl font-bold text-white">{{ winData.legsWon }}</span>
          </div>
          <div v-if="winData.setsWon !== undefined" class="flex items-center gap-2">
            <span class="text-white/60 uppercase tracking-wider">{{ t('score.sets') }}</span>
            <span class="text-2xl font-bold text-white">{{ winData.setsWon }}</span>
          </div>
        </div>

        <!-- Dismiss hint -->
        <p class="text-white/30 text-sm mt-8 animate-fade-in-delayed">
          {{ t('animations.clickToClose') }}
        </p>
      </div>

      <!-- Audio element (hidden) -->
      <audio ref="audioRef" class="hidden" />
    </div>
  </Transition>
</template>

<style scoped>
@keyframes confetti-fall {
  0% {
    transform: translateY(0) rotate(0deg);
    opacity: 1;
  }
  100% {
    transform: translateY(100vh) rotate(720deg);
    opacity: 0;
  }
}

@keyframes trophy-bounce {
  0%, 100% {
    transform: translateY(0) scale(1);
  }
  25% {
    transform: translateY(-20px) scale(1.05);
  }
  50% {
    transform: translateY(0) scale(1);
  }
  75% {
    transform: translateY(-10px) scale(1.02);
  }
}

@keyframes title-in {
  0% {
    opacity: 0;
    transform: scale(0.5) translateY(50px);
  }
  50% {
    transform: scale(1.1) translateY(0);
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

@keyframes fade-up {
  0% {
    opacity: 0;
    transform: translateY(30px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes pulse-slow {
  0%, 100% {
    opacity: 0.3;
    transform: translate(-50%, -50%) scale(1);
  }
  50% {
    opacity: 0.5;
    transform: translate(-50%, -50%) scale(1.2);
  }
}

@keyframes fade-in-delayed {
  0%, 70% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}

.confetti-particle {
  animation: confetti-fall 4s linear forwards;
  border-radius: 2px;
}

.animate-trophy-bounce {
  animation: trophy-bounce 2s ease-in-out infinite;
}

.animate-title-in {
  animation: title-in 0.8s ease-out forwards;
}

.animate-fade-up {
  opacity: 0;
  animation: fade-up 0.6s ease-out forwards;
}

.animate-pulse-slow {
  animation: pulse-slow 4s ease-in-out infinite;
}

.animate-fade-in-delayed {
  animation: fade-in-delayed 2s ease-out forwards;
}

/* Fireworks effect */
@keyframes firework-burst {
  0% {
    transform: scale(0) translate(0, 0);
    opacity: 1;
  }
  50% {
    transform: scale(1.5) translate(var(--tx, 50px), var(--ty, -50px));
    opacity: 1;
  }
  100% {
    transform: scale(0.5) translate(calc(var(--tx, 50px) * 2), calc(var(--ty, -50px) * 2));
    opacity: 0;
  }
}

.firework-particle {
  --tx: calc((100vw * (0.5 - var(--r, 0.5))));
  --ty: calc((100vh * (0.5 - var(--r2, 0.5))));
  animation: firework-burst 2s ease-out infinite;
}

.firework-particle:nth-child(odd) {
  --r: 0.3;
  --r2: 0.7;
}

.firework-particle:nth-child(even) {
  --r: 0.7;
  --r2: 0.3;
}

/* Sparkles effect */
@keyframes sparkle-twinkle {
  0%, 100% {
    transform: scale(0) rotate(0deg);
    opacity: 0;
  }
  50% {
    transform: scale(1) rotate(180deg);
    opacity: 1;
  }
}

.sparkle-particle {
  animation: sparkle-twinkle 2s ease-in-out infinite;
}
</style>
