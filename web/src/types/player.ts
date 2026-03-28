// Player Types

export interface Player {
  id: string
  name: string
  color: string
  avatar?: string
  autodartsUserId?: string
  createdAt: string
  updatedAt: string
}

export interface CreatePlayerRequest {
  name: string
  color: string
  avatar?: string
  autodartsUserId?: string
}

export interface UpdatePlayerRequest {
  name?: string
  color?: string
  avatar?: string
  autodartsUserId?: string
}

// Predefined colors for player selection
export const PLAYER_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#eab308', // yellow
  '#84cc16', // lime
  '#22c55e', // green
  '#10b981', // emerald
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#0ea5e9', // sky
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#d946ef', // fuchsia
  '#ec4899', // pink
  '#f43f5e', // rose
] as const

// Avatar icons
export const PLAYER_AVATARS = [
  'default',
  'dart',
  'bullseye',
  'trophy',
  'star',
  'crown',
  'fire',
  'bolt',
] as const
