import { SecretFieldConfig } from '@settings/secrets';

/**
 * Manual recovery steps shown when `migrateFieldOnDevice` fails, and reused
 * by the missing-secret notice below. Always names the id actually in use
 * (the synced name if one is set, otherwise the field's default), not
 * necessarily the default.
 */
export function buildManualStepsText(field: SecretFieldConfig, id: string): string {
  return `Open Settings → Keychain, add a secret named \`${id}\` with your ${field.label}, then select it in Book Search Plus settings.`;
}

/**
 * Persistent notice (duration 0) shown once per load when a secret name is
 * set but the secret is missing on this device and there is no legacy value
 * to fall back on — recoverable only by the user, not automatically.
 */
export function buildMissingSecretNoticeText(_field: SecretFieldConfig, id: string): string {
  return `Book Search Plus: the secret \`${id}\` isn't on this device. Secrets don't sync between devices. Open Settings → Keychain and add it, or pick a different secret in Book Search Plus settings.`;
}

function formatLabelList(labels: string[]): string {
  if (labels.length === 0) return 'your key';
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}

/**
 * Migration modal intro text, built from the labels of the fields that
 * actually have a legacy value on this device rather than hard-coding
 * "Google Books API key".
 */
export function buildMigrateIntroText(labels: string[]): string {
  return `Book search plus can now store your ${formatLabelList(labels)} in Obsidian's keychain instead of the plugin's settings file. Keychain secrets stay on this device and don't sync, so you'll do this once on each device.`;
}
