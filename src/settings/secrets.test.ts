// Imported from the mock file directly (rather than 'obsidian') so the test
// gets the mock's concrete type, including the `setForceThrow` test helper
// that isn't part of Obsidian's real public API.
import { ServiceProvider } from '@src/constants';
import { SecretStorage } from '../../test/mock_obsidian';
import {
  fieldsNeedingMissingNotice,
  fieldsWithMismatchedValues,
  getSecretState,
  hasAnyLegacyValue,
  isSnoozeActive,
  isValidSecretId,
  migrateFieldOnDevice,
  removeLegacySecrets,
  resolveSecret,
  SECRET_FIELDS,
  SecretFieldData,
  stripLegacySecrets,
} from './secrets';

describe('secrets', () => {
  let storage: SecretStorage;

  beforeEach(() => {
    storage = new SecretStorage();
  });

  describe.each(Object.entries(SECRET_FIELDS))('%s field', (_name, field) => {
    describe('getSecretState', () => {
      it('is "none" when there is no legacy value and no name', () => {
        const data: SecretFieldData = {};
        expect(getSecretState(data, field, storage)).toBe('none');
      });

      it('is "secret-only" when the name resolves and there is no legacy value', () => {
        storage.setSecret(field.defaultId, 'secret-value');
        const data: SecretFieldData = { [field.nameKey]: field.defaultId };
        expect(getSecretState(data, field, storage)).toBe('secret-only');
      });

      it('is "needs-migrate" when a legacy value is present and the secret does not resolve', () => {
        const data: SecretFieldData = { [field.legacyKey]: 'legacy-value' };
        expect(getSecretState(data, field, storage)).toBe('needs-migrate');
      });

      it('is "needs-migrate" when a legacy value is present even if a name is set but unresolved', () => {
        const data: SecretFieldData = { [field.legacyKey]: 'legacy-value', [field.nameKey]: field.defaultId };
        expect(getSecretState(data, field, storage)).toBe('needs-migrate');
      });

      it('is "migrated-here" when the legacy value is present and the secret resolves on this device', () => {
        storage.setSecret(field.defaultId, 'legacy-value');
        const data: SecretFieldData = { [field.legacyKey]: 'legacy-value', [field.nameKey]: field.defaultId };
        expect(getSecretState(data, field, storage)).toBe('migrated-here');
      });

      it('is "missing-here" when a name is set, no legacy value, and the secret does not resolve', () => {
        const data: SecretFieldData = { [field.nameKey]: field.defaultId };
        expect(getSecretState(data, field, storage)).toBe('missing-here');
      });
    });

    describe('resolveSecret', () => {
      it('prefers the secret value when the name resolves', () => {
        storage.setSecret(field.defaultId, 'secret-value');
        const data: SecretFieldData = { [field.legacyKey]: 'legacy-value', [field.nameKey]: field.defaultId };
        expect(resolveSecret(data, field, storage)).toBe('secret-value');
      });

      it('falls back to the legacy value when the name does not resolve', () => {
        const data: SecretFieldData = { [field.legacyKey]: 'legacy-value', [field.nameKey]: field.defaultId };
        expect(resolveSecret(data, field, storage)).toBe('legacy-value');
      });

      it('falls back to the legacy value when no name is set', () => {
        const data: SecretFieldData = { [field.legacyKey]: 'legacy-value' };
        expect(resolveSecret(data, field, storage)).toBe('legacy-value');
      });

      it('is undefined when neither a resolving secret nor a legacy value exist', () => {
        const data: SecretFieldData = {};
        expect(resolveSecret(data, field, storage)).toBeUndefined();
      });
    });

    describe('migrateFieldOnDevice', () => {
      it('uses the default id when no name is set', () => {
        const data: SecretFieldData = { [field.legacyKey]: 'legacy-value' };
        const { data: next, result } = migrateFieldOnDevice(data, field, storage);
        expect(result).toBe('migrated');
        expect(next[field.nameKey]).toBe(field.defaultId);
        expect(storage.getSecret(field.defaultId)).toBe('legacy-value');
      });

      it('uses the synced name when one is already set', () => {
        const data: SecretFieldData = { [field.legacyKey]: 'legacy-value', [field.nameKey]: 'synced-name' };
        const { data: next, result } = migrateFieldOnDevice(data, field, storage);
        expect(result).toBe('migrated');
        expect(next[field.nameKey]).toBe('synced-name');
        expect(storage.getSecret('synced-name')).toBe('legacy-value');
      });

      it('keeps the legacy value in data after migrating', () => {
        const data: SecretFieldData = { [field.legacyKey]: 'legacy-value' };
        const { data: next } = migrateFieldOnDevice(data, field, storage);
        expect(next[field.legacyKey]).toBe('legacy-value');
      });

      it('reuses an existing secret that already holds the same value', () => {
        storage.setSecret(field.defaultId, 'legacy-value');
        const data: SecretFieldData = { [field.legacyKey]: 'legacy-value' };
        const { data: next, result } = migrateFieldOnDevice(data, field, storage);
        expect(result).toBe('migrated');
        expect(next[field.nameKey]).toBe(field.defaultId);
      });

      it('returns "conflict" without touching storage when an existing secret has a different value', () => {
        storage.setSecret(field.defaultId, 'other-value');
        const data: SecretFieldData = { [field.legacyKey]: 'legacy-value' };
        const { data: next, result } = migrateFieldOnDevice(data, field, storage);
        expect(result).toBe('conflict');
        expect(next).toBe(data);
        expect(storage.getSecret(field.defaultId)).toBe('other-value');
      });

      it('resolves a conflict by keeping the existing secret when told to use it', () => {
        storage.setSecret(field.defaultId, 'other-value');
        const data: SecretFieldData = { [field.legacyKey]: 'legacy-value' };
        const { data: next, result } = migrateFieldOnDevice(data, field, storage, { onConflict: 'use-existing' });
        expect(result).toBe('migrated');
        expect(next[field.nameKey]).toBe(field.defaultId);
        expect(storage.getSecret(field.defaultId)).toBe('other-value');
      });

      it('resolves a conflict by replacing the existing secret when told to replace it', () => {
        storage.setSecret(field.defaultId, 'other-value');
        const data: SecretFieldData = { [field.legacyKey]: 'legacy-value' };
        const { result } = migrateFieldOnDevice(data, field, storage, { onConflict: 'replace' });
        expect(result).toBe('migrated');
        expect(storage.getSecret(field.defaultId)).toBe('legacy-value');
      });

      it('returns "failed" without changing data when setSecret throws', () => {
        storage.setForceThrow(true);
        const data: SecretFieldData = { [field.legacyKey]: 'legacy-value' };
        const { data: next, result } = migrateFieldOnDevice(data, field, storage);
        expect(result).toBe('failed');
        expect(next).toBe(data);
      });

      it('returns "failed" when there is no legacy value to migrate', () => {
        const data: SecretFieldData = {};
        const { result } = migrateFieldOnDevice(data, field, storage);
        expect(result).toBe('failed');
      });

      it('falls back to the default id when the stored name is not a valid secret id', () => {
        const data: SecretFieldData = { [field.legacyKey]: 'legacy-value', [field.nameKey]: 'Not Valid!' };
        const { data: next, result } = migrateFieldOnDevice(data, field, storage);
        expect(result).toBe('migrated');
        expect(next[field.nameKey]).toBe(field.defaultId);
        expect(storage.getSecret(field.defaultId)).toBe('legacy-value');
      });
    });
  });

  describe('removeLegacySecrets', () => {
    it('removes only fields that are migrated-here, leaving needs-migrate fields alone', () => {
      const googleField = SECRET_FIELDS.google;
      const naverField = SECRET_FIELDS.naver;

      storage.setSecret(googleField.defaultId, 'google-legacy');

      const data: SecretFieldData = {
        [googleField.legacyKey]: 'google-legacy',
        [googleField.nameKey]: googleField.defaultId,
        [naverField.legacyKey]: 'naver-legacy',
      };

      const { data: next, removed } = removeLegacySecrets(data, storage);

      expect(removed).toEqual([googleField.legacyKey]);
      expect(next[googleField.legacyKey]).toBeUndefined();
      expect(next[naverField.legacyKey]).toBe('naver-legacy');
    });

    it('removes nothing when no field is migrated-here', () => {
      const data: SecretFieldData = { apiKey: 'legacy-value' };
      const { data: next, removed } = removeLegacySecrets(data, storage);
      expect(removed).toEqual([]);
      expect(next.apiKey).toBe('legacy-value');
    });
  });

  describe('hasAnyLegacyValue', () => {
    it('is true when any field has a legacy value', () => {
      expect(hasAnyLegacyValue({ apiKey: 'value' })).toBe(true);
      expect(hasAnyLegacyValue({ naverClientSecret: 'value' })).toBe(true);
    });

    it('is false when no field has a legacy value', () => {
      expect(hasAnyLegacyValue({})).toBe(false);
    });
  });

  describe('isValidSecretId', () => {
    it('is true for lowercase alphanumeric ids with dashes', () => {
      expect(isValidSecretId('book-search-plus-google-api-key')).toBe(true);
      expect(isValidSecretId('abc123')).toBe(true);
    });

    it('is false for ids with spaces, uppercase letters, or other characters', () => {
      expect(isValidSecretId('Not Valid!')).toBe(false);
      expect(isValidSecretId('Has-Upper-Case')).toBe(false);
      expect(isValidSecretId('has_underscore')).toBe(false);
    });
  });

  describe('stripLegacySecrets', () => {
    it('removes every legacy field', () => {
      const data: SecretFieldData = { apiKey: 'google-legacy', naverClientSecret: 'naver-legacy' };
      const next = stripLegacySecrets(data);
      expect(next.apiKey).toBeUndefined();
      expect(next.naverClientSecret).toBeUndefined();
    });

    it('leaves non-legacy fields untouched', () => {
      const data: SecretFieldData = { apiKey: 'google-legacy', googleApiKeySecret: 'secret-name' };
      const next = stripLegacySecrets(data);
      expect(next.googleApiKeySecret).toBe('secret-name');
    });
  });

  describe('fieldsWithMismatchedValues', () => {
    it('includes a field that is migrated-here but whose secret value differs from the legacy value', () => {
      const googleField = SECRET_FIELDS.google;
      storage.setSecret(googleField.defaultId, 'different-value');
      const data: SecretFieldData = {
        [googleField.legacyKey]: 'legacy-value',
        [googleField.nameKey]: googleField.defaultId,
      };
      expect(fieldsWithMismatchedValues(data, storage)).toEqual([googleField]);
    });

    it('excludes a field that is migrated-here with a matching value', () => {
      const googleField = SECRET_FIELDS.google;
      storage.setSecret(googleField.defaultId, 'legacy-value');
      const data: SecretFieldData = {
        [googleField.legacyKey]: 'legacy-value',
        [googleField.nameKey]: googleField.defaultId,
      };
      expect(fieldsWithMismatchedValues(data, storage)).toEqual([]);
    });

    it('excludes a field that is not migrated-here', () => {
      const data: SecretFieldData = { apiKey: 'legacy-value' };
      expect(fieldsWithMismatchedValues(data, storage)).toEqual([]);
    });
  });

  describe('fieldsNeedingMissingNotice', () => {
    it('includes the active provider field when it is missing-here', () => {
      const googleField = SECRET_FIELDS.google;
      const data = { serviceProvider: ServiceProvider.google, [googleField.nameKey]: googleField.defaultId };
      expect(fieldsNeedingMissingNotice(data, storage)).toEqual([googleField]);
    });

    it('is empty when the active provider is not missing-here', () => {
      const data = { serviceProvider: ServiceProvider.google };
      expect(fieldsNeedingMissingNotice(data, storage)).toEqual([]);
    });

    it('ignores an inactive provider even if it is missing-here', () => {
      const naverField = SECRET_FIELDS.naver;
      const data = { serviceProvider: ServiceProvider.google, [naverField.nameKey]: naverField.defaultId };
      expect(fieldsNeedingMissingNotice(data, storage)).toEqual([]);
    });
  });

  describe('isSnoozeActive', () => {
    const DAY_MS = 24 * 60 * 60 * 1000;

    it('is false when nothing has been snoozed', () => {
      expect(isSnoozeActive(undefined)).toBe(false);
      expect(isSnoozeActive(null)).toBe(false);
    });

    it('is true within 7 days of the snooze timestamp', () => {
      const now = 1_000_000;
      expect(isSnoozeActive(now - 6 * DAY_MS, now)).toBe(true);
    });

    it('is false after 7 days have passed', () => {
      const now = 1_000_000;
      expect(isSnoozeActive(now - 7 * DAY_MS, now)).toBe(false);
    });
  });
});
