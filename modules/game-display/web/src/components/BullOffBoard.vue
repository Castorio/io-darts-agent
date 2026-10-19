<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Player } from '../stores/gameDisplay'
import { BOARD_RADIUS_MM, bullOffRanking, dartMarkers, type BullOffState } from '../utils/bullOff'

const props = defineProps<{
  bullOff: BullOffState | null
  players: Player[]
  activePlayer: Player | null
  winner: { name: string } | null
}>()

const { t } = useI18n()

// Board geometry in mm (WDF), 1 coordinate unit = 170 mm (outer edge of the double)
const R = BOARD_RADIUS_MM
const BULL = 6.35
const OUTER_BULL = 15.9
const TRIPLE_IN = 99
const TRIPLE_OUT = 107
const DOUBLE_IN = 162
const NUMBERS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5]

/** Point on the board, angle in degrees clockwise from the top */
function polar(radius: number, angle: number): [number, number] {
  const rad = (angle * Math.PI) / 180
  return [radius * Math.sin(rad), -radius * Math.cos(rad)]
}

/** Ring sector between two radii for segment i (18 degrees, centred on its number) */
function sector(i: number, inner: number, outer: number): string {
  const a0 = i * 18 - 9
  const a1 = i * 18 + 9
  const [x0, y0] = polar(outer, a0)
  const [x1, y1] = polar(outer, a1)
  const [x2, y2] = polar(inner, a1)
  const [x3, y3] = polar(inner, a0)
  return `M ${x0} ${y0} A ${outer} ${outer} 0 0 1 ${x1} ${y1} L ${x2} ${y2} A ${inner} ${inner} 0 0 0 ${x3} ${y3} Z`
}

const segments = NUMBERS.map((number, i) => {
  const dark = i % 2 === 0
  return {
    number,
    single: dark ? '#1f1f1f' : '#e8dcc0',
    ring: dark ? '#c0392b' : '#2e8b57',
    inner: sector(i, OUTER_BULL, TRIPLE_IN),
    triple: sector(i, TRIPLE_IN, TRIPLE_OUT),
    outer: sector(i, TRIPLE_OUT, DOUBLE_IN),
    double: sector(i, DOUBLE_IN, R),
    label: polar(186, i * 18),
  }
})

function colorOf(index: number): string {
  return props.players.find((p) => p.index === index)?.color ?? '#3b82f6'
}

const darts = computed(() =>
  dartMarkers(props.bullOff?.players ?? []).map((d) => ({ ...d, color: colorOf(d.index) })),
)

const ranking = computed(() => bullOffRanking(props.bullOff))
</script>

<template>
  <div class="flex-1 flex flex-col items-center justify-center w-full" data-testid="bulloff-board">
    <h1 class="text-4xl lg:text-6xl font-bold text-white uppercase tracking-tight">{{ t('bullOff.title') }}</h1>
    <p v-if="winner" class="mt-3 text-2xl lg:text-3xl font-semibold text-yellow-300" data-testid="bulloff-winner">
      {{ t('bullOff.starts', { name: winner.name }) }}
    </p>
    <p v-else-if="activePlayer" class="mt-3 text-xl lg:text-2xl text-white/70">
      {{ t('bullOff.throwing', { name: activePlayer.name }) }}
    </p>

    <div class="mt-6 flex flex-col lg:flex-row items-center gap-8 lg:gap-14 w-full max-w-6xl justify-center">
      <svg viewBox="-205 -205 410 410" class="w-[min(70vh,90vw)] h-[min(70vh,90vw)]" role="img" :aria-label="t('bullOff.title')">
        <circle r="204" fill="#111" />
        <g v-for="s in segments" :key="s.number">
          <path :d="s.inner" :fill="s.single" />
          <path :d="s.triple" :fill="s.ring" />
          <path :d="s.outer" :fill="s.single" />
          <path :d="s.double" :fill="s.ring" />
          <text :x="s.label[0]" :y="s.label[1]" fill="#fff" font-size="15" font-weight="700" text-anchor="middle" dominant-baseline="middle">{{ s.number }}</text>
        </g>
        <circle :r="OUTER_BULL" fill="#2e8b57" />
        <circle :r="BULL" fill="#c0392b" />

        <g v-for="d in darts" :key="d.index" :data-dart="d.name">
          <line x1="0" y1="0" :x2="d.x" :y2="d.y" :stroke="d.color" stroke-width="2" stroke-dasharray="4 3" />
          <circle :cx="d.x" :cy="d.y" r="6" :fill="d.color" stroke="#fff" stroke-width="2" />
          <text :x="d.labelX" :y="d.labelY" :text-anchor="d.anchor" dominant-baseline="middle" font-size="14" font-weight="700" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke">
            {{ d.name }} · {{ d.distance }} mm
          </text>
        </g>
      </svg>

      <ol class="flex flex-col gap-3 min-w-[16rem]" data-testid="bulloff-ranking">
        <li
          v-for="(p, i) in ranking"
          :key="p.index"
          class="flex items-center gap-4 px-5 py-3 rounded-xl border"
          :class="winner && i === 0 ? 'border-yellow-300/70 bg-yellow-300/10' : 'border-white/10 bg-white/5'"
        >
          <span class="text-white/40 font-bold w-5">{{ i + 1 }}</span>
          <span class="w-3 h-3 rounded-full" :style="{ backgroundColor: colorOf(p.index) }" />
          <span class="text-white font-semibold uppercase flex-1">{{ p.name }}</span>
          <span class="text-2xl font-bold text-white tabular-nums">
            {{ p.distance === null ? t('bullOff.notThrown') : `${p.distance} mm` }}
          </span>
        </li>
      </ol>
    </div>
  </div>
</template>
