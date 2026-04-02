/**
 * Type definitions for module configuration system
 */

// Supported comparison operators for showIf conditions
export type ShowIfOperator = '==' | '!=' | '>' | '<' | '>=' | '<=' | 'includes' | 'notIncludes'

// ShowIf condition interface
export interface ShowIfCondition {
  field: string
  operator?: ShowIfOperator
  value: unknown
}

// Base config field schema
export interface ConfigFieldSchemaBase {
  type: string
  label?: string
  description?: string
  default?: unknown
  required?: boolean
  showIf?: ShowIfCondition | ShowIfCondition[]
}

// String field
export interface StringFieldSchema extends ConfigFieldSchemaBase {
  type: 'string'
  default?: string
  placeholder?: string
}

// Password field
export interface PasswordFieldSchema extends ConfigFieldSchemaBase {
  type: 'password'
  default?: string
}

// Number field
export interface NumberFieldSchema extends ConfigFieldSchemaBase {
  type: 'number'
  default?: number
  min?: number
  max?: number
  step?: number
}

// Boolean field
export interface BooleanFieldSchema extends ConfigFieldSchemaBase {
  type: 'boolean'
  default?: boolean
}

// Select field
export interface SelectOption {
  value: string | number
  label: string
}

export interface SelectFieldSchema extends ConfigFieldSchemaBase {
  type: 'select'
  options: SelectOption[]
  default?: string | number
}

// Color field
export interface ColorFieldSchema extends ConfigFieldSchemaBase {
  type: 'color'
  default?: string
}

// Slider field
export interface SliderFieldSchema extends ConfigFieldSchemaBase {
  type: 'slider'
  default?: number
  min?: number
  max?: number
  step?: number
  unit?: string
  showValue?: boolean
}

// Textarea field
export interface TextareaFieldSchema extends ConfigFieldSchemaBase {
  type: 'textarea'
  default?: string
  rows?: number
}

// Group field (nested fields)
export interface GroupFieldSchema extends ConfigFieldSchemaBase {
  type: 'group'
  fields: Record<string, ConfigFieldSchema>
}

// Union type for all field schemas
export type ConfigFieldSchema =
  | StringFieldSchema
  | PasswordFieldSchema
  | NumberFieldSchema
  | BooleanFieldSchema
  | SelectFieldSchema
  | ColorFieldSchema
  | SliderFieldSchema
  | TextareaFieldSchema
  | GroupFieldSchema

// Event metadata type (from module.json)
export interface EventMeta {
  label: string | Record<string, string>
  description?: string | Record<string, string>
}

// Event group type (from module.json)
export interface EventGroup {
  title: string | Record<string, string>
  events: string[]
}

// Intent action type (from module.json)
export interface IntentAction {
  type: string
  label: string
  description?: string
  configSchema?: Record<string, ConfigFieldSchema>
}

// Intent subscription type
export interface IntentSubscription {
  intentId: string
  enabled: boolean
  action: {
    type: string
    config?: Record<string, unknown>
  }
}

// i18n config field translation
export interface ConfigFieldI18n {
  label?: string
  description?: string
  options?: Record<string, string>
}

// Full module manifest i18n structure
export interface ModuleI18n {
  name?: string
  description?: string
  config?: Record<string, ConfigFieldI18n>
  strings?: Record<string, string>
}
