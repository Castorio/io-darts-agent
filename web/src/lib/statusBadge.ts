/**
 * Status shown by StatusBadge: module states plus the Autodarts connection.
 * Labels come from the `status` section of the locales.
 */
export const STATUS_KINDS = ['running', 'connected', 'stopped', 'disconnected', 'starting', 'stopping', 'error'] as const
export type StatusKind = (typeof STATUS_KINDS)[number]

export function statusLabelKey(status: StatusKind): string {
  return `status.${STATUS_KINDS.includes(status) ? status : 'stopped'}`
}
