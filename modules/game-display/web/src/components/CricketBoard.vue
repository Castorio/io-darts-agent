<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Player } from '../stores/gameDisplay'
import { markSymbol } from '../utils/cricket'

const props = defineProps<{
  activePlayer: Player | null
  otherPlayers: Player[]
  /** Marks keyed by player.index */
  marks: Record<number, Record<string, number>>
  /** Fields of the game, high to low with Bull last (Tactics: 10 to 20) */
  fields: string[]
  deadFields: string[]
  cutThroat: boolean
  playerColor: string
}>()

const { t } = useI18n()

const dead = computed(() => new Set(props.deadFields))

function fieldLabel(field: string): string {
  return field === '25' ? t('cricket.bull') : field
}

function marksOf(player: Player | null, field: string): number {
  return player ? props.marks[player.index]?.[field] ?? 0 : 0
}
</script>

<template>
  <div class="flex-1 flex flex-col items-center justify-center -mt-6 w-full" data-testid="cricket-board">
    <!-- Points of the active player -->
    <div class="relative text-center">
      <div class="absolute inset-0 blur-3xl opacity-40" :style="{ background: playerColor }" />
      <div
        class="relative text-[9rem] lg:text-[13rem] font-black leading-none tracking-tighter text-white"
        :style="{ textShadow: `0 0 100px ${playerColor}60` }"
        data-testid="cricket-points"
      >
        {{ activePlayer?.score ?? 0 }}
      </div>
      <p class="relative text-white/50 uppercase tracking-widest text-sm lg:text-base">
        {{ cutThroat ? t('cricket.pointsAgainst') : t('cricket.points') }}
      </p>
    </div>

    <!-- Marks of the active player per field -->
    <div
      class="grid gap-2 lg:gap-4 w-full mt-8 lg:mt-10"
      :class="fields.length > 7 ? 'max-w-7xl' : 'max-w-5xl'"
      :style="{ gridTemplateColumns: `repeat(${fields.length}, minmax(0, 1fr))` }"
    >
      <div
        v-for="field in fields"
        :key="field"
        class="rounded-2xl border-2 flex flex-col items-center justify-center py-3 lg:py-5 transition-all duration-300"
        :class="dead.has(field) ? 'opacity-25 border-white/10' : 'border-white/15 bg-white/5'"
        :style="marksOf(activePlayer, field) >= 3 && !dead.has(field)
          ? { borderColor: playerColor, backgroundColor: playerColor + '25' }
          : undefined"
        :data-field="field"
      >
        <span class="text-white/60 text-lg lg:text-2xl font-semibold" :class="{ 'line-through': dead.has(field) }">
          {{ fieldLabel(field) }}
        </span>
        <span class="text-4xl lg:text-6xl font-bold text-white h-12 lg:h-16 leading-none flex items-center">
          {{ markSymbol(marksOf(activePlayer, field)) }}
        </span>
      </div>
    </div>

    <!-- Other players: points and their marks, small -->
    <div v-if="otherPlayers.length > 0" class="flex flex-wrap items-stretch justify-center gap-3 mt-6 lg:mt-8">
      <div
        v-for="player in otherPlayers"
        :key="player.index"
        class="flex items-center gap-4 px-4 py-2 rounded-xl bg-white/5 border border-white/10"
      >
        <div class="w-3 h-3 rounded-full" :style="{ backgroundColor: player.color }" />
        <span class="text-white/70 font-medium uppercase">{{ player.name }}</span>
        <span class="text-2xl font-bold text-white">{{ player.score }}</span>
        <div class="flex gap-1">
          <span
            v-for="field in fields"
            :key="field"
            class="w-8 text-center text-xs leading-tight"
            :class="dead.has(field) ? 'text-white/20' : 'text-white/60'"
          >
            <span class="block">{{ fieldLabel(field) }}</span>
            <span class="block text-base font-bold text-white h-5">{{ markSymbol(marksOf(player, field)) }}</span>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
