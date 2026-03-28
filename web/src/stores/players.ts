import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '../api/client'
import type { Player, CreatePlayerRequest, UpdatePlayerRequest } from '../types/player'

export const usePlayersStore = defineStore('players', () => {
  // State
  const players = ref<Player[]>([])
  const selectedPlayer = ref<Player | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Computed
  const playerCount = computed(() => players.value.length)

  const playerById = computed(() => {
    return (id: string) => players.value.find((p) => p.id === id)
  })

  const playerByAutodartsId = computed(() => {
    return (autodartsUserId: string) =>
      players.value.find((p) => p.autodartsUserId === autodartsUserId)
  })

  // Actions
  async function fetchPlayers() {
    isLoading.value = true
    error.value = null

    try {
      players.value = await api.listPlayers()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch players'
    } finally {
      isLoading.value = false
    }
  }

  async function fetchPlayer(id: string) {
    isLoading.value = true
    error.value = null

    try {
      selectedPlayer.value = await api.getPlayer(id)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch player'
      selectedPlayer.value = null
    } finally {
      isLoading.value = false
    }
  }

  async function createPlayer(playerData: CreatePlayerRequest) {
    try {
      const result = await api.createPlayer(playerData)
      if (result.success) {
        await fetchPlayers()
      }
      return result
    } catch (e) {
      throw e
    }
  }

  async function updatePlayer(id: string, playerData: UpdatePlayerRequest) {
    try {
      const result = await api.updatePlayer(id, playerData)
      if (result.success) {
        await fetchPlayers()
        if (selectedPlayer.value?.id === id) {
          await fetchPlayer(id)
        }
      }
      return result
    } catch (e) {
      throw e
    }
  }

  async function deletePlayer(id: string) {
    try {
      const result = await api.deletePlayer(id)
      if (result.success) {
        await fetchPlayers()
        if (selectedPlayer.value?.id === id) {
          selectedPlayer.value = null
        }
      }
      return result
    } catch (e) {
      throw e
    }
  }

  function clearSelectedPlayer() {
    selectedPlayer.value = null
  }

  return {
    // State
    players,
    selectedPlayer,
    isLoading,
    error,
    // Computed
    playerCount,
    playerById,
    playerByAutodartsId,
    // Actions
    fetchPlayers,
    fetchPlayer,
    createPlayer,
    updatePlayer,
    deletePlayer,
    clearSelectedPlayer,
  }
})
