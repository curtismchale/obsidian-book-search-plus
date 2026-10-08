import { SECRET_FIELDS } from '@settings/secrets';
import { buildManualStepsText, buildMigrateIntroText, buildMissingSecretNoticeText } from './secret_migration_notice';
import { ServiceProvider } from '@src/constants';

describe('buildManualStepsText', () => {
  it('includes the actual secret id, not just the field default', () => {
    const field = SECRET_FIELDS[ServiceProvider.google];
    const text = buildManualStepsText(field, 'a-custom-synced-name');
    expect(text).toContain('a-custom-synced-name');
    expect(text).not.toContain(field.defaultId);
  });

  it('includes the field label', () => {
    const field = SECRET_FIELDS[ServiceProvider.naver];
    const text = buildManualStepsText(field, field.defaultId);
    expect(text).toContain(field.label);
  });
});

describe('buildMissingSecretNoticeText', () => {
  it('includes the actual secret id', () => {
    const field = SECRET_FIELDS[ServiceProvider.google];
    const text = buildMissingSecretNoticeText(field, 'a-custom-synced-name');
    expect(text).toContain('a-custom-synced-name');
  });

  it('mentions that secrets do not sync between devices', () => {
    const field = SECRET_FIELDS[ServiceProvider.naver];
    const text = buildMissingSecretNoticeText(field, field.defaultId);
    expect(text).toContain("don't sync between devices");
  });
});

describe('buildMigrateIntroText', () => {
  it('names a single field', () => {
    const text = buildMigrateIntroText(['Google Books API key']);
    expect(text).toContain('your Google Books API key');
  });

  it('joins two fields with "and"', () => {
    const text = buildMigrateIntroText(['Google Books API key', 'Naver client secret']);
    expect(text).toContain('your Google Books API key and Naver client secret');
  });

  it('falls back to generic wording when no fields are given', () => {
    const text = buildMigrateIntroText([]);
    expect(text).toContain('your key');
  });
});
