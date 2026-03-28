<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAppStore } from '../stores/app'
import BaseButton from '../components/BaseButton.vue'
import BaseInput from '../components/BaseInput.vue'

const router = useRouter()
const route = useRoute()
const appStore = useAppStore()

const username = ref('')
const password = ref('')
const isLoading = ref(false)
const error = ref<string | null>(null)

async function handleLogin() {
  if (!username.value || !password.value) {
    error.value = 'Bitte Benutzername und Passwort eingeben'
    return
  }

  isLoading.value = true
  error.value = null

  try {
    const result = await appStore.login(username.value, password.value)

    if (result.success) {
      const redirect = route.query.redirect as string | undefined
      router.push(redirect || '/')
    } else {
      error.value = result.message || 'Anmeldung fehlgeschlagen'
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Anmeldung fehlgeschlagen'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-dark-900 flex items-center justify-center p-4">
    <div class="w-full max-w-md">
      <!-- Header -->
      <div class="text-center mb-8">
        <div
          class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-autodarts-600 flex items-center justify-center"
        >
          <svg class="w-10 h-10 text-white" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" />
            <circle cx="12" cy="12" r="6" stroke="currentColor" stroke-width="2" fill="none" />
            <circle cx="12" cy="12" r="2" fill="currentColor" />
          </svg>
        </div>
        <h1 class="text-2xl font-bold text-white">IO-Darts-Agent</h1>
        <p class="text-dark-400 mt-1">Bitte melden Sie sich an</p>
      </div>

      <!-- Login Card -->
      <div class="bg-dark-800 rounded-2xl border border-dark-700 overflow-hidden">
        <form @submit.prevent="handleLogin" class="p-6 space-y-4">
          <BaseInput
            v-model="username"
            label="Benutzername"
            placeholder="Ihr Benutzername"
            autocomplete="username"
            required
          />
          <BaseInput
            v-model="password"
            type="password"
            label="Passwort"
            placeholder="Ihr Passwort"
            autocomplete="current-password"
            required
          />

          <!-- Error Message -->
          <div
            v-if="error"
            class="p-3 rounded-lg bg-red-500/10 border border-red-500/30"
          >
            <p class="text-sm text-red-400">{{ error }}</p>
          </div>

          <BaseButton
            type="submit"
            :loading="isLoading"
            class="w-full"
          >
            Anmelden
          </BaseButton>
        </form>
      </div>

      <!-- Footer -->
      <p class="text-center text-sm text-dark-500 mt-6">
        IO-Darts-Agent v{{ appStore.version }}
      </p>
    </div>
  </div>
</template>
