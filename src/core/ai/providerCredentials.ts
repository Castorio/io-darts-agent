/**
 * API keys for services that predate the AI settings page
 *
 * ElevenLabs (darts caller, TTS) and Runway (animations) used to read their
 * keys from `aiProviders` in hub.config.json, which no UI writes anymore.
 * The AI settings (ai-providers.json) are the source of truth; the legacy
 * value only applies when the AI settings provider is missing or disabled.
 */

interface ProviderLookup {
  getProvider(id: string): { config: { apiKey: string; options?: Record<string, unknown> }; isAvailable(): boolean } | undefined;
}

export function resolveProviderApiKey(
  service: ProviderLookup,
  providerId: string,
  legacy: { apiKey?: string } | undefined
): string | undefined {
  const provider = service.getProvider(providerId);
  if (provider?.isAvailable() && provider.config.apiKey) {
    return provider.config.apiKey;
  }
  return legacy?.apiKey || undefined;
}

function nonEmpty(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/**
 * Model chosen in the AI settings (`options.defaultModel`), even when the
 * provider is disabled and only the legacy key applies; the legacy hub config
 * model is the fallback. Callers validate the id against their catalog.
 */
export function resolveProviderDefaultModel(
  service: ProviderLookup,
  providerId: string,
  legacy: { model?: string } | undefined
): string | undefined {
  const options = service.getProvider(providerId)?.config.options;
  return nonEmpty(options?.defaultModel) ?? nonEmpty(legacy?.model);
}
