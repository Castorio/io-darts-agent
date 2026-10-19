<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useModulesStore } from '../stores/modules'
import AppLayout from '../components/AppLayout.vue'
import BaseCard from '../components/BaseCard.vue'
import BaseButton from '../components/BaseButton.vue'
import StatusBadge from '../components/StatusBadge.vue'

const { t } = useI18n()
const modulesStore = useModulesStore()
const actionLoading = ref<string | null>(null)
const installingBuiltinId = ref<string | null>(null)

async function startModule(id: string) {
  actionLoading.value = id
  try {
    await modulesStore.startModule(id)
  } catch (e) {
    console.error('Failed to start module:', e)
  } finally {
    actionLoading.value = null
  }
}

async function stopModule(id: string) {
  actionLoading.value = id
  try {
    await modulesStore.stopModule(id)
  } catch (e) {
    console.error('Failed to stop module:', e)
  } finally {
    actionLoading.value = null
  }
}

async function installBuiltinModule(id: string) {
  installingBuiltinId.value = id
  try {
    await modulesStore.installBuiltinModule(id)
  } catch (e) {
    console.error('Failed to install builtin module:', e)
  } finally {
    installingBuiltinId.value = null
  }
}

onMounted(() => {
  modulesStore.fetchModules()
  modulesStore.fetchAvailableModules()
})
</script>

<template>
  <AppLayout>
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-white">{{ t('modules.title') }}</h1>
          <p class="text-dark-400">{{ t('modules.subtitle') }}</p>
        </div>
        <div class="flex items-center gap-3">
          <router-link to="/modules/store">
            <BaseButton variant="secondary">
              <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
              {{ t('store.openStore') }}
            </BaseButton>
          </router-link>
          <router-link to="/modules/install">
            <BaseButton>
              <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 4v16m8-8H4"
                />
              </svg>
              {{ t('modules.installNew') }}
            </BaseButton>
          </router-link>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="modulesStore.isLoading" class="flex items-center justify-center py-12">
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
      <BaseCard v-else-if="modulesStore.modules.length === 0">
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
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
          <h3 class="text-lg font-medium text-white mt-4">{{ t('modules.noModules') }}</h3>
          <p class="text-dark-400 mt-2">
            {{ t('modules.noModulesDescription') }}
          </p>
          <router-link to="/modules/install" class="inline-block mt-6">
            <BaseButton>
              {{ t('modules.installNew') }}
            </BaseButton>
          </router-link>
        </div>
      </BaseCard>

      <!-- Module List -->
      <div v-else class="grid gap-4">
        <div
          v-for="module in modulesStore.modules"
          :key="module.id"
          class="bg-dark-800 rounded-xl border border-dark-700 p-6"
        >
          <div class="flex items-start justify-between">
            <div class="flex items-start gap-4">
              <!-- Module Icon -->
              <div
                :class="[
                  'w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0',
                  module.status === 'running' ? 'bg-green-500/20' : 'bg-dark-700',
                ]"
              >
                <svg
                  :class="[
                    'w-6 h-6',
                    module.status === 'running' ? 'text-green-400' : 'text-dark-400',
                  ]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>

              <!-- Module Info -->
              <div>
                <div class="flex items-center gap-3">
                  <h3 class="text-lg font-semibold text-white">{{ module.name }}</h3>
                  <StatusBadge :status="module.status" />
                </div>
                <p class="text-dark-400 text-sm mt-1">{{ module.description }}</p>
                <div class="flex items-center gap-4 mt-3 text-sm text-dark-500">
                  <span>v{{ module.version }}</span>
                  <span>{{ module.events.length }} Events</span>
                </div>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex items-center gap-2">
              <router-link :to="`/modules/${module.id}`">
                <BaseButton variant="ghost" size="sm">
                  <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    />
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  {{ t('modules.configure') }}
                </BaseButton>
              </router-link>

              <BaseButton
                v-if="module.status === 'running'"
                variant="secondary"
                size="sm"
                :loading="actionLoading === module.id"
                @click="stopModule(module.id)"
              >
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
                  />
                </svg>
                {{ t('modules.stop') }}
              </BaseButton>
              <BaseButton
                v-else
                size="sm"
                :loading="actionLoading === module.id"
                @click="startModule(module.id)"
              >
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                  />
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                {{ t('modules.start') }}
              </BaseButton>
            </div>
          </div>
        </div>
      </div>

      <!-- Available Modules Section -->
      <div v-if="modulesStore.availableModules.length > 0" class="mt-8">
        <div class="mb-4">
          <h2 class="text-xl font-semibold text-white">{{ t('modules.availableModules') }}</h2>
          <p class="text-dark-400 text-sm">{{ t('modules.availableModulesDesc') }}</p>
        </div>

        <div class="grid gap-4">
          <div
            v-for="module in modulesStore.availableModules"
            :key="module.id"
            class="bg-dark-800 rounded-xl border border-dark-700 border-dashed p-6"
          >
            <div class="flex items-start justify-between">
              <div class="flex items-start gap-4">
                <!-- Module Icon -->
                <div class="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-autodarts-500/10">
                  <svg
                    class="w-6 h-6 text-autodarts-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                    />
                  </svg>
                </div>

                <!-- Module Info -->
                <div>
                  <div class="flex items-center gap-3">
                    <h3 class="text-lg font-semibold text-white">{{ module.name }}</h3>
                    <span class="px-2 py-0.5 text-xs rounded-full bg-autodarts-500/20 text-autodarts-400">
                      Built-in
                    </span>
                  </div>
                  <p class="text-dark-400 text-sm mt-1">{{ module.description }}</p>
                  <div class="flex items-center gap-4 mt-3 text-sm text-dark-500">
                    <span>v{{ module.version }}</span>
                  </div>
                </div>
              </div>

              <!-- Install Button -->
              <BaseButton
                size="sm"
                :loading="installingBuiltinId === module.id"
                @click="installBuiltinModule(module.id)"
              >
                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                {{ t('modules.installBuiltin') }}
              </BaseButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>
