<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { usePlayersStore } from '../stores/players'
import AppLayout from '../components/AppLayout.vue'
import BaseCard from '../components/BaseCard.vue'
import BaseButton from '../components/BaseButton.vue'
import PlayerAvatar from '../components/PlayerAvatar.vue'
import PlayerEditModal from '../components/PlayerEditModal.vue'
import type { Player, CreatePlayerRequest, UpdatePlayerRequest } from '../types/player'

const playersStore = usePlayersStore()

// Modal state
const showModal = ref(false)
const editingPlayer = ref<Player | null>(null)
const isSaving = ref(false)
const message = ref<{ type: 'success' | 'error'; text: string } | null>(null)

function openCreateModal() {
  editingPlayer.value = null
  showModal.value = true
}

function openEditModal(player: Player) {
  editingPlayer.value = player
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  editingPlayer.value = null
}

async function handleSave(data: CreatePlayerRequest | UpdatePlayerRequest) {
  isSaving.value = true
  message.value = null

  try {
    if (editingPlayer.value) {
      await playersStore.updatePlayer(editingPlayer.value.id, data)
      message.value = { type: 'success', text: 'Spieler aktualisiert' }
    } else {
      await playersStore.createPlayer(data as CreatePlayerRequest)
      message.value = { type: 'success', text: 'Spieler erstellt' }
    }
    closeModal()
    setTimeout(() => {
      message.value = null
    }, 3000)
  } catch (e) {
    message.value = {
      type: 'error',
      text: e instanceof Error ? e.message : 'Fehler beim Speichern',
    }
  } finally {
    isSaving.value = false
  }
}

async function handleDelete(id: string) {
  isSaving.value = true
  message.value = null

  try {
    await playersStore.deletePlayer(id)
    message.value = { type: 'success', text: 'Spieler gelöscht' }
    closeModal()
    setTimeout(() => {
      message.value = null
    }, 3000)
  } catch (e) {
    message.value = {
      type: 'error',
      text: e instanceof Error ? e.message : 'Fehler beim Löschen',
    }
  } finally {
    isSaving.value = false
  }
}

onMounted(() => {
  playersStore.fetchPlayers()
})
</script>

<template>
  <AppLayout>
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-white">Spieler</h1>
          <p class="text-dark-400">Verwalten Sie Ihre lokalen Spieler</p>
        </div>
        <BaseButton @click="openCreateModal">
          <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Neuer Spieler
        </BaseButton>
      </div>

      <!-- Message -->
      <div
        v-if="message"
        :class="[
          'p-4 rounded-lg',
          message.type === 'success'
            ? 'bg-green-500/10 border border-green-500/30 text-green-400'
            : 'bg-red-500/10 border border-red-500/30 text-red-400',
        ]"
      >
        {{ message.text }}
      </div>

      <!-- Loading State -->
      <div v-if="playersStore.isLoading" class="flex items-center justify-center py-12">
        <svg
          class="animate-spin h-8 w-8 text-autodarts-500"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          />
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      </div>

      <!-- Empty State -->
      <BaseCard v-else-if="playersStore.players.length === 0">
        <div class="text-center py-12">
          <svg
            class="w-16 h-16 mx-auto text-dark-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          <h3 class="text-lg font-medium text-white mt-4">Keine Spieler vorhanden</h3>
          <p class="text-dark-400 mt-2 max-w-md mx-auto">
            Erstellen Sie Spieler um sie in Modulen für individuelle Aktionen nutzen zu können.
            Spieler können auch mit einem Autodarts-Account verknüpft werden.
          </p>
          <BaseButton class="mt-6" @click="openCreateModal">
            Ersten Spieler erstellen
          </BaseButton>
        </div>
      </BaseCard>

      <!-- Players Grid -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="player in playersStore.players"
          :key="player.id"
          class="bg-dark-800 rounded-xl border border-dark-700 p-5 hover:border-dark-600 transition-colors cursor-pointer group"
          @click="openEditModal(player)"
        >
          <div class="flex items-center gap-4">
            <PlayerAvatar
              :name="player.name"
              :color="player.color"
              :avatar="player.avatar"
              size="lg"
            />
            <div class="flex-1 min-w-0">
              <h3 class="text-lg font-semibold text-white truncate">
                {{ player.name }}
              </h3>
              <div class="flex items-center gap-2 mt-1">
                <div
                  class="w-3 h-3 rounded-full"
                  :style="{ backgroundColor: player.color }"
                />
                <span class="text-sm text-dark-400">{{ player.color }}</span>
              </div>
              <p
                v-if="player.autodartsUserId"
                class="text-xs text-dark-500 mt-1 truncate"
              >
                Autodarts: {{ player.autodartsUserId.slice(0, 8) }}...
              </p>
            </div>
            <svg
              class="w-5 h-5 text-dark-500 group-hover:text-white transition-colors flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </div>
        </div>
      </div>

      <!-- Info Card -->
      <BaseCard title="Spieler-Einstellungen in Modulen">
        <p class="text-dark-400 mb-4">
          Sobald Sie Spieler erstellt haben, können Sie in Modulen wie WLED individuelle Aktionen für jeden Spieler festlegen.
          Die Zuordnung erfolgt automatisch über die Autodarts Benutzer-ID oder manuell.
        </p>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="p-4 rounded-lg bg-dark-700/50">
            <div class="w-10 h-10 rounded-lg bg-autodarts-600/20 flex items-center justify-center mb-3">
              <svg class="w-5 h-5 text-autodarts-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              </svg>
            </div>
            <h4 class="text-white font-medium">Individuelle Farben</h4>
            <p class="text-sm text-dark-400 mt-1">Jeder Spieler kann seine eigene LED-Farbe haben</p>
          </div>
          <div class="p-4 rounded-lg bg-dark-700/50">
            <div class="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center mb-3">
              <svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>
            <h4 class="text-white font-medium">Persönliche Effekte</h4>
            <p class="text-sm text-dark-400 mt-1">Unterschiedliche Lichteffekte pro Spieler möglich</p>
          </div>
          <div class="p-4 rounded-lg bg-dark-700/50">
            <div class="w-10 h-10 rounded-lg bg-purple-600/20 flex items-center justify-center mb-3">
              <svg class="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <h4 class="text-white font-medium">Auto-Erkennung</h4>
            <p class="text-sm text-dark-400 mt-1">Automatische Zuordnung über Autodarts-Account</p>
          </div>
        </div>
      </BaseCard>
    </div>

    <!-- Edit Modal -->
    <PlayerEditModal
      :show="showModal"
      :player="editingPlayer"
      :is-loading="isSaving"
      @close="closeModal"
      @save="handleSave"
      @delete="handleDelete"
    />
  </AppLayout>
</template>
