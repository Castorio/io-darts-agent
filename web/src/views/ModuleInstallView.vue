<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useModulesStore } from '../stores/modules'
import AppLayout from '../components/AppLayout.vue'
import BaseCard from '../components/BaseCard.vue'
import BaseButton from '../components/BaseButton.vue'
import BaseInput from '../components/BaseInput.vue'

const { t } = useI18n()
const router = useRouter()
const modulesStore = useModulesStore()

const source = ref<'git' | 'local'>('git')
const gitUrl = ref('')
const gitBranch = ref('')
const localPath = ref('')
const error = ref<string | null>(null)
const success = ref(false)

async function installModule() {
  error.value = null

  try {
    const result = await modulesStore.installModule(
      source.value,
      source.value === 'git' ? gitUrl.value : undefined,
      source.value === 'local' ? localPath.value : undefined,
      source.value === 'git' && gitBranch.value ? gitBranch.value : undefined
    )

    if (result.success && result.moduleId) {
      success.value = true
      setTimeout(() => {
        router.push(`/modules/${result.moduleId}`)
      }, 1500)
    } else {
      error.value = result.error || t('modules.installFailed')
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : t('modules.installFailed')
  }
}
</script>

<template>
  <AppLayout>
    <div class="space-y-6 max-w-2xl">
      <!-- Back Link -->
      <router-link
        to="/modules"
        class="inline-flex items-center gap-2 text-dark-400 hover:text-white transition-colors"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M15 19l-7-7 7-7"
          />
        </svg>
        {{ t('modules.backToModules') }}
      </router-link>

      <!-- Header -->
      <div>
        <h1 class="text-2xl font-bold text-white">{{ t('modules.installTitle') }}</h1>
        <p class="text-dark-400">{{ t('modules.installSubtitle') }}</p>
      </div>

      <!-- Success State -->
      <BaseCard v-if="success">
        <div class="text-center py-8">
          <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
            <svg class="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h3 class="text-lg font-medium text-white">{{ t('modules.installSuccess') }}</h3>
          <p class="text-dark-400 mt-2">{{ t('modules.redirecting') }}</p>
        </div>
      </BaseCard>

      <!-- Installation Form -->
      <BaseCard v-else :title="t('modules.installSource')">
        <form @submit.prevent="installModule" class="space-y-6">
          <!-- Source Selection -->
          <div class="grid grid-cols-2 gap-4">
            <button
              type="button"
              @click="source = 'git'"
              :class="[
                'p-4 rounded-lg border-2 text-left transition-colors',
                source === 'git'
                  ? 'border-autodarts-500 bg-autodarts-600/10'
                  : 'border-dark-600 hover:border-dark-500',
              ]"
            >
              <svg class="w-8 h-8 text-dark-300 mb-2" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              <p class="text-white font-medium">{{ t('modules.gitRepository') }}</p>
              <p class="text-sm text-dark-400">{{ t('modules.gitRepositoryDesc') }}</p>
            </button>

            <button
              type="button"
              @click="source = 'local'"
              :class="[
                'p-4 rounded-lg border-2 text-left transition-colors',
                source === 'local'
                  ? 'border-autodarts-500 bg-autodarts-600/10'
                  : 'border-dark-600 hover:border-dark-500',
              ]"
            >
              <svg class="w-8 h-8 text-dark-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                />
              </svg>
              <p class="text-white font-medium">{{ t('modules.localPath') }}</p>
              <p class="text-sm text-dark-400">{{ t('modules.localPathDesc') }}</p>
            </button>
          </div>

          <!-- Git Fields -->
          <div v-if="source === 'git'" class="space-y-4">
            <BaseInput
              v-model="gitUrl"
              :label="t('modules.repositoryUrl')"
              placeholder="https://github.com/user/autodarts-module.git"
              required
            />
            <BaseInput
              v-model="gitBranch"
              :label="t('modules.branchOptional')"
              placeholder="main"
            />
            <p class="text-sm text-dark-400">
              {{ t('modules.gitCloneInfo') }}
            </p>
          </div>

          <!-- Local Path Field -->
          <div v-if="source === 'local'" class="space-y-4">
            <BaseInput
              v-model="localPath"
              :label="t('modules.modulePath')"
              placeholder="/home/user/my-module"
              required
            />
            <p class="text-sm text-dark-400">
              {{ t('modules.localPathInfo') }}
            </p>
          </div>

          <!-- Error Message -->
          <div
            v-if="error"
            class="p-4 rounded-lg bg-red-500/10 border border-red-500/30"
          >
            <p class="text-sm text-red-400">{{ error }}</p>
          </div>

          <!-- Submit Button -->
          <div class="flex justify-end gap-3">
            <router-link to="/modules">
              <BaseButton variant="ghost">{{ t('common.cancel') }}</BaseButton>
            </router-link>
            <BaseButton
              type="submit"
              :loading="modulesStore.isInstalling"
              :disabled="(source === 'git' && !gitUrl) || (source === 'local' && !localPath)"
            >
              {{ t('modules.installTitle') }}
            </BaseButton>
          </div>
        </form>
      </BaseCard>

      <!-- Info Card -->
      <BaseCard :title="t('modules.requirements')">
        <ul class="space-y-3 text-dark-300">
          <li class="flex items-start gap-2">
            <svg class="w-5 h-5 text-autodarts-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
            <i18n-t keypath="modules.requirementPackageJson" tag="span">
              <template #code>
                <code class="px-1.5 py-0.5 rounded bg-dark-700 text-dark-200 text-sm">package.json</code>
              </template>
            </i18n-t>
          </li>
          <li class="flex items-start gap-2">
            <svg class="w-5 h-5 text-autodarts-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
            <i18n-t keypath="modules.requirementAutodartsModule" tag="span">
              <template #code>
                <code class="px-1.5 py-0.5 rounded bg-dark-700 text-dark-200 text-sm">autodarts-module</code>
              </template>
            </i18n-t>
          </li>
          <li class="flex items-start gap-2">
            <svg class="w-5 h-5 text-autodarts-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span>{{ t('modules.requirementIpc') }}</span>
          </li>
        </ul>
      </BaseCard>
    </div>
  </AppLayout>
</template>
