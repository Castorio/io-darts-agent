/**
 * Template Resolver for Intent System
 *
 * Provides utilities for resolving template strings with variables from intent payloads.
 * Template variables use curly brace syntax: {variableName}
 *
 * @example
 * const template = "{playerName} hat {score} Punkte geworfen!";
 * const payload = { playerName: "Max", score: 180 };
 * const result = resolveTemplate(template, payload);
 * // Result: "Max hat 180 Punkte geworfen!"
 */

/**
 * Resolves a template string by replacing {variableName} placeholders
 * with values from the payload object.
 *
 * Supports nested paths like {player.name} for accessing nested objects.
 *
 * @param template - The template string with {variable} placeholders
 * @param payload - The data object containing values for variables
 * @returns The resolved string with all variables replaced
 */
export function resolveTemplate(
  template: string,
  payload: Record<string, unknown>
): string {
  if (!template) return '';

  return template.replace(/\{([^}]+)\}/g, (match, path: string) => {
    const value = getNestedValue(payload, path.trim());

    if (value === undefined || value === null) {
      // Return original placeholder if value not found
      return match;
    }

    return String(value);
  });
}

/**
 * Gets a nested value from an object using dot notation path.
 *
 * @example
 * getNestedValue({ player: { name: "Max" } }, "player.name") // "Max"
 * getNestedValue({ score: 180 }, "score") // 180
 *
 * @param obj - The object to extract the value from
 * @param path - Dot-notation path (e.g., "player.name")
 * @returns The value at the path, or undefined if not found
 */
function getNestedValue(
  obj: Record<string, unknown>,
  path: string
): unknown {
  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (typeof current !== 'object') {
      return undefined;
    }

    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

/**
 * Extracts all variable names from a template string.
 *
 * @example
 * extractVariables("{playerName} scored {score}!") // ["playerName", "score"]
 *
 * @param template - The template string
 * @returns Array of variable names found in the template
 */
export function extractVariables(template: string): string[] {
  const matches = template.matchAll(/\{([^}]+)\}/g);
  const variables: string[] = [];

  for (const match of matches) {
    const variable = match[1].trim();
    if (!variables.includes(variable)) {
      variables.push(variable);
    }
  }

  return variables;
}

/**
 * Validates that all template variables have corresponding values in the payload.
 *
 * @param template - The template string
 * @param payload - The payload object
 * @returns Object with validation result and any missing variables
 */
export function validateTemplate(
  template: string,
  payload: Record<string, unknown>
): { valid: boolean; missingVariables: string[] } {
  const variables = extractVariables(template);
  const missingVariables: string[] = [];

  for (const variable of variables) {
    const value = getNestedValue(payload, variable);
    if (value === undefined) {
      missingVariables.push(variable);
    }
  }

  return {
    valid: missingVariables.length === 0,
    missingVariables,
  };
}

/**
 * Resolves all template fields in an action config object.
 *
 * This function identifies which config fields are template strings
 * (based on configSchema) and resolves them using the intent payload.
 *
 * @param config - The action config object
 * @param configSchema - Schema defining field types (identifies template fields)
 * @param payload - Intent payload with values for template variables
 * @returns New config object with all template fields resolved
 */
export function resolveActionConfigTemplates(
  config: Record<string, unknown> | undefined,
  configSchema: Record<string, { type: string }> | undefined,
  payload: Record<string, unknown>
): Record<string, unknown> {
  if (!config || !configSchema) {
    return config ?? {};
  }

  const resolved: Record<string, unknown> = { ...config };

  for (const [fieldKey, fieldSchema] of Object.entries(configSchema)) {
    if (fieldSchema.type === 'template' && typeof config[fieldKey] === 'string') {
      resolved[fieldKey] = resolveTemplate(config[fieldKey], payload);
    }
  }

  return resolved;
}
