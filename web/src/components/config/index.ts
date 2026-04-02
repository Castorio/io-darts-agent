/**
 * Module Configuration Components
 *
 * This module exports reusable components for rendering dynamic module configurations.
 * These components work together to provide a consistent configuration UI across all modules.
 *
 * Usage:
 * ```vue
 * <script setup>
 * import { ModuleConfigCard, DynamicConfigForm, EventConfigList } from '@/components/config'
 * </script>
 * ```
 */

// Main configuration components
export { default as DynamicConfigForm } from '../DynamicConfigForm.vue'
export { default as ModuleConfigCard } from '../ModuleConfigCard.vue'
export { default as EventConfigList } from '../EventConfigList.vue'
export { default as IntentSubscriptionConfig } from '../IntentSubscriptionConfig.vue'

// Base UI components used by config components
export { default as BaseCard } from '../BaseCard.vue'
export { default as BaseButton } from '../BaseButton.vue'
export { default as BaseInput } from '../BaseInput.vue'
export { default as MediaUpload } from '../MediaUpload.vue'

// Module-specific config components
export { default as WledEventConfig } from '../WledEventConfig.vue'

// Type exports for TypeScript support
export type {
  // Config field types
  ConfigFieldSchema,
  ShowIfCondition,
  ShowIfOperator,
} from './types'
