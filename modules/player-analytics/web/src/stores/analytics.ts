import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  Player,
  PlayerStatistics,
  TrainingTip,
  PlayerTrend,
  MatchSummary,
  TipCategory,
  AnalyticsConfig,
} from '../types/api'

// Get base URL for API calls
const getApiBaseUrl = () => {
  // In production, use relative paths
  // In development, the proxy handles it
  return ''
}

export const useAnalyticsStore = defineStore('analytics', () => {
  // State
  const players = ref<Player[]>([])
  const selectedPlayerId = ref<string | null>(null)
  const statistics = ref<PlayerStatistics | null>(null)
  const tips = ref<TrainingTip[]>([])
  const trends = ref<PlayerTrend[]>([])
  const recentMatches = ref<MatchSummary[]>([])
  const config = ref<AnalyticsConfig | null>(null)
  const aiEnabled = ref(false)

  const isLoading = ref(false)
  const isGeneratingTips = ref(false)
  const error = ref<string | null>(null)

  // Computed
  const selectedPlayer = computed(() =>
    players.value.find((p) => p.id === selectedPlayerId.value)
  )

  const activeTips = computed(() =>
    tips.value.filter((t) => !t.acknowledged)
  )

  const isAIEnabled = computed(() => aiEnabled.value)

  // Actions
  async function fetchConfig(): Promise<void> {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/modules/player-analytics/config`)
      if (response.ok) {
        config.value = await response.json()
      }
      // Also check analytics status for AI enabled
      const statusResponse = await fetch(`${getApiBaseUrl()}/api/analytics/status`)
      if (statusResponse.ok) {
        const status = await statusResponse.json()
        aiEnabled.value = status.aiEnabled ?? false
      }
    } catch (err) {
      console.error('Failed to fetch config:', err)
    }
  }

  async function fetchPlayers(): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/analytics/players`)
      if (!response.ok) {
        throw new Error('Failed to fetch players')
      }
      const data = await response.json()
      players.value = data.players || []
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
      console.error('Failed to fetch players:', err)
    } finally {
      isLoading.value = false
    }
  }

  async function selectPlayer(playerId: string): Promise<void> {
    selectedPlayerId.value = playerId
    await Promise.all([
      fetchStatistics(playerId),
      fetchTips(playerId),
      fetchTrends(playerId),
      fetchMatches(playerId),
    ])
  }

  async function fetchStatistics(playerId: string): Promise<void> {
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/api/analytics/players/${playerId}/statistics`
      )
      if (!response.ok) {
        throw new Error('Failed to fetch statistics')
      }
      statistics.value = await response.json()
    } catch (err) {
      console.error('Failed to fetch statistics:', err)
      statistics.value = null
    }
  }

  async function fetchTips(playerId: string): Promise<void> {
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/api/analytics/players/${playerId}/tips`
      )
      if (!response.ok) {
        throw new Error('Failed to fetch tips')
      }
      const data = await response.json()
      tips.value = data.tips || []
      // Update AI enabled status from tips endpoint
      if (data.aiEnabled !== undefined) {
        aiEnabled.value = data.aiEnabled
      }
    } catch (err) {
      console.error('Failed to fetch tips:', err)
      tips.value = []
    }
  }

  async function fetchTrends(playerId: string): Promise<void> {
    try {
      const [weekly, monthly] = await Promise.all([
        fetch(`${getApiBaseUrl()}/api/analytics/players/${playerId}/trends?period=weekly`),
        fetch(`${getApiBaseUrl()}/api/analytics/players/${playerId}/trends?period=monthly`),
      ])

      const trendsData: PlayerTrend[] = []
      if (weekly.ok) {
        const weeklyData = await weekly.json()
        trendsData.push(weeklyData.trends)
      }
      if (monthly.ok) {
        const monthlyData = await monthly.json()
        trendsData.push(monthlyData.trends)
      }
      trends.value = trendsData
    } catch (err) {
      console.error('Failed to fetch trends:', err)
      trends.value = []
    }
  }

  async function fetchMatches(playerId: string): Promise<void> {
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/api/analytics/players/${playerId}/matches?limit=10`
      )
      if (!response.ok) {
        throw new Error('Failed to fetch matches')
      }
      const data = await response.json()
      recentMatches.value = data.matches || []
    } catch (err) {
      console.error('Failed to fetch matches:', err)
      recentMatches.value = []
    }
  }

  async function generateTips(focusArea?: TipCategory): Promise<void> {
    if (!selectedPlayerId.value) return

    isGeneratingTips.value = true
    error.value = null

    try {
      const response = await fetch(
        `${getApiBaseUrl()}/api/analytics/players/${selectedPlayerId.value}/tips/generate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ focusArea }),
        }
      )

      if (!response.ok) {
        throw new Error('Failed to generate tips')
      }

      const result = await response.json()
      if (result.tips) {
        tips.value = [...result.tips, ...tips.value]
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
      console.error('Failed to generate tips:', err)
    } finally {
      isGeneratingTips.value = false
    }
  }

  async function acknowledgeTip(tipId: string): Promise<void> {
    if (!selectedPlayerId.value) return

    try {
      const response = await fetch(
        `${getApiBaseUrl()}/api/analytics/players/${selectedPlayerId.value}/tips/${tipId}/acknowledge`,
        {
          method: 'POST',
        }
      )

      if (response.ok) {
        const tip = tips.value.find((t) => t.id === tipId)
        if (tip) {
          tip.acknowledged = true
        }
      }
    } catch (err) {
      console.error('Failed to acknowledge tip:', err)
    }
  }

  async function refreshStatistics(): Promise<void> {
    if (!selectedPlayerId.value) return

    try {
      const response = await fetch(
        `${getApiBaseUrl()}/api/analytics/players/${selectedPlayerId.value}/statistics?recalculate=true`
      )

      if (response.ok) {
        statistics.value = await response.json()
      }
    } catch (err) {
      console.error('Failed to refresh statistics:', err)
    }
  }

  return {
    // State
    players,
    selectedPlayerId,
    selectedPlayer,
    statistics,
    tips,
    activeTips,
    trends,
    recentMatches,
    config,
    isLoading,
    isGeneratingTips,
    isAIEnabled,
    error,

    // Actions
    fetchConfig,
    fetchPlayers,
    selectPlayer,
    fetchStatistics,
    fetchTips,
    fetchTrends,
    fetchMatches,
    generateTips,
    acknowledgeTip,
    refreshStatistics,
  }
})
