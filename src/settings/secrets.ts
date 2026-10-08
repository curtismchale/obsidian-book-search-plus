import { ServiceProvider } from '@src/constants';
import type { SecretStorage } from 'obsidian';

// Shape of the settings fields a secret field reads and writes. Deliberately
// decoupled from `BookSearchPluginSettings` so this module stays testable
// without importing the full settings interface; `BookSearchPluginSettings`
// is structurally compatible and can be passed in directly.
export interface SecretFieldData {
  apiKey?: string;
  naverClientSecret?: string;
  googleApiKeySecret?: string;
  naverClientSecretName?: string;
}

export interface SecretFieldConfig {
  legacyKey: keyof SecretFieldData;
  nameKey: keyof SecretFieldData;
  defaultId: string;
  label: string;
}

export const SECRET_FIELDS: Record<ServiceProvider, SecretFieldConfig> = {
  [ServiceProvider.google]: {
    legacyKey: 'apiKey',
    nameKey: 'googleApiKeySecret',
    defaultId: 'book-search-plus-google-api-key',
    label: 'Google Books API key',
  },
  [ServiceProvider.naver]: {
    legacyKey: 'naverClientSecret',
    nameKey: 'naverClientSecretName',
    defaultId: 'book-search-plus-naver-client-secret',
    label: 'Naver client secret',
  },
};

export type SecretState = 'none' | 'secret-only' | 'needs-migrate' | 'migrated-here' | 'missing-here';

export type ReadableSecretStorage = Pick<SecretStorage, 'getSecret'>;
export type WritableSecretStorage = Pick<SecretStorage, 'getSecret' | 'setSecret'>;

export function getSecretState(
  data: SecretFieldData,
  field: SecretFieldConfig,
  storage: ReadableSecretStorage,
): SecretState {
  const hasLegacy = !!data[field.legacyKey];
  const name = data[field.nameKey];

  if (!name) return hasLegacy ? 'needs-migrate' : 'none';

  const resolves = !!storage.getSecret(name);
  if (resolves) return hasLegacy ? 'migrated-here' : 'secret-only';
  return hasLegacy ? 'needs-migrate' : 'missing-here';
}

export function resolveSecret(
  data: SecretFieldData,
  field: SecretFieldConfig,
  storage: ReadableSecretStorage,
): string | undefined {
  const name = data[field.nameKey];
  if (name) {
    const value = storage.getSecret(name);
    if (value) return value;
  }
  return data[field.legacyKey] || undefined;
}

/**
 * Secret ids must be lowercase alphanumeric with dashes — the same rule
 * `app.secretStorage.setSecret` enforces by throwing.
 */
export function isValidSecretId(id: string): boolean {
  return /^[a-z0-9-]+$/.test(id);
}

/**
 * The id actually in use for a field: the synced name, unless it's not a
 * valid secret id (e.g. hand-edited `data.json`), in which case fall back to
 * the field's default id rather than carry a broken name forward.
 */
export function resolveSecretId(data: SecretFieldData, field: SecretFieldConfig): string {
  const name = data[field.nameKey];
  return name && isValidSecretId(name) ? name : field.defaultId;
}

export type MigrateResult = 'migrated' | 'conflict' | 'failed';

export interface MigrateOptions {
  onConflict?: 'replace' | 'use-existing';
}

/**
 * Copy a field's legacy plaintext value into this device's Keychain and
 * record the secret name. The legacy value is intentionally left in place —
 * secrets are per device and `data.json` syncs, so other devices still need
 * it until they migrate too.
 */
export function migrateFieldOnDevice(
  data: SecretFieldData,
  field: SecretFieldConfig,
  storage: WritableSecretStorage,
  options: MigrateOptions = {},
): { data: SecretFieldData; result: MigrateResult } {
  const legacyValue = data[field.legacyKey];
  if (!legacyValue) return { data, result: 'failed' };

  const id = resolveSecretId(data, field);
  const existing = storage.getSecret(id);

  if (existing != null && existing !== legacyValue) {
    if (options.onConflict === 'use-existing') {
      return { data: { ...data, [field.nameKey]: id }, result: 'migrated' };
    }
    if (options.onConflict !== 'replace') {
      return { data, result: 'conflict' };
    }
  }

  try {
    storage.setSecret(id, legacyValue);
  } catch {
    return { data, result: 'failed' };
  }

  if (storage.getSecret(id) !== legacyValue) {
    return { data, result: 'failed' };
  }

  return { data: { ...data, [field.nameKey]: id }, result: 'migrated' };
}

/**
 * Remove the legacy plaintext value for every field that resolves on this
 * device, leaving fields that are not yet migrated here untouched.
 */
export function removeLegacySecrets(
  data: SecretFieldData,
  storage: ReadableSecretStorage,
): { data: SecretFieldData; removed: (keyof SecretFieldData)[] } {
  const next: SecretFieldData = { ...data };
  const removed: (keyof SecretFieldData)[] = [];

  for (const field of Object.values(SECRET_FIELDS)) {
    if (getSecretState(data, field, storage) === 'migrated-here') {
      delete next[field.legacyKey];
      removed.push(field.legacyKey);
    }
  }

  return { data: next, removed };
}

export function hasAnyLegacyValue(data: SecretFieldData): boolean {
  return Object.values(SECRET_FIELDS).some(field => !!data[field.legacyKey]);
}

/**
 * Strip every legacy plaintext field. Used before every save once the user
 * has finished migration, so a device that saves settings in memory from
 * before that point (e.g. an unrelated setting change on a stale load)
 * cannot write the legacy value back into `data.json`.
 */
export function stripLegacySecrets<T extends SecretFieldData>(data: T): T {
  const next = { ...data };
  for (const field of Object.values(SECRET_FIELDS)) {
    delete next[field.legacyKey];
  }
  return next;
}

/**
 * Fields that are `migrated-here` but whose Keychain value no longer matches
 * the legacy plaintext value in `data.json` — e.g. a conflict was resolved
 * with "Use existing secret". Removing the legacy value in that case deletes
 * the only copy of the settings-file value, so the finish-migration
 * confirmation warns about these specifically.
 */
export function fieldsWithMismatchedValues(data: SecretFieldData, storage: ReadableSecretStorage): SecretFieldConfig[] {
  return Object.values(SECRET_FIELDS).filter(field => {
    if (getSecretState(data, field, storage) !== 'migrated-here') return false;
    const id = resolveSecretId(data, field);
    return storage.getSecret(id) !== data[field.legacyKey];
  });
}

/**
 * Fields needing the persistent "secret missing on this device" notice —
 * only the active service provider, since an inactive provider's missing
 * secret doesn't affect anything the user is currently doing.
 */
export function fieldsNeedingMissingNotice(
  data: SecretFieldData & { serviceProvider: ServiceProvider },
  storage: ReadableSecretStorage,
): SecretFieldConfig[] {
  const activeField = SECRET_FIELDS[data.serviceProvider];
  return getSecretState(data, activeField, storage) === 'missing-here' ? [activeField] : [];
}

export const SECRET_MIGRATION_SNOOZE_KEY = 'book-search-plus-secret-migration-snooze';
const SNOOZE_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export function isSnoozeActive(snoozedAt: unknown, now: number = Date.now()): boolean {
  return typeof snoozedAt === 'number' && now - snoozedAt < SNOOZE_DURATION_MS;
}
