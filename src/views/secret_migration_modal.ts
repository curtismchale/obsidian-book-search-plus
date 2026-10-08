import {
  fieldsWithMismatchedValues,
  getSecretState,
  migrateFieldOnDevice,
  MigrateOptions,
  removeLegacySecrets,
  resolveSecretId,
  SECRET_FIELDS,
  SECRET_MIGRATION_SNOOZE_KEY,
} from '@settings/secrets';
import { ServiceProvider } from '@src/constants';
import BookSearchPlugin from '@src/main';
import { Modal, Notice, Setting } from 'obsidian';
import { buildManualStepsText, buildMigrateIntroText } from './secret_migration_notice';

type ModalView = 'migrate' | 'conflict' | 'finish-confirm' | 'failed';

/**
 * Walks the user through moving legacy plaintext secrets into this device's
 * Keychain. All decisions (which state a field is in, what migrating does,
 * what finishing removes) live in the pure functions in `@settings/secrets`;
 * this modal only renders the current step and wires up button clicks.
 */
export class SecretMigrationModal extends Modal {
  private view: ModalView = 'migrate';
  private conflictField?: ServiceProvider;
  private failedFields: ServiceProvider[] = [];

  constructor(
    private plugin: BookSearchPlugin,
    private onCloseCallback?: () => void,
  ) {
    super(plugin.app);
  }

  private get storage() {
    return this.plugin.app.secretStorage;
  }

  private get fieldsWithLegacyValue(): ServiceProvider[] {
    return (Object.keys(SECRET_FIELDS) as ServiceProvider[]).filter(
      key => !!this.plugin.settings[SECRET_FIELDS[key].legacyKey],
    );
  }

  private allMigratedHere(): boolean {
    const fields = this.fieldsWithLegacyValue;
    return fields.length > 0 && fields.every(key => this.stateFor(key) === 'migrated-here');
  }

  private stateFor(key: ServiceProvider) {
    return getSecretState(this.plugin.settings, SECRET_FIELDS[key], this.storage);
  }

  onOpen(): void {
    this.render();
  }

  onClose(): void {
    this.contentEl.empty();
    this.onCloseCallback?.();
  }

  private render(): void {
    this.contentEl.empty();
    if (this.view === 'conflict' && this.conflictField) return this.renderConflict(this.conflictField);
    if (this.view === 'finish-confirm') return this.renderFinishConfirm();
    if (this.view === 'failed' && this.failedFields.length) return this.renderFailed(this.failedFields);
    this.renderMigrate();
  }

  private renderMigrate(): void {
    const { contentEl } = this;
    const legacyLabels = this.fieldsWithLegacyValue.map(key => SECRET_FIELDS[key].label);
    const migratedLabels = this.fieldsWithLegacyValue
      .filter(key => this.stateFor(key) === 'migrated-here')
      .map(key => SECRET_FIELDS[key].label);

    contentEl.createEl('h2', { text: 'Move your key to the keychain' });
    contentEl.createEl('p', { text: buildMigrateIntroText(legacyLabels) });

    contentEl.createEl('p', {
      text: 'Step 1: move the key to the keychain on every device you use with this vault. Step 2: once every device is done, remove the key from the settings file. Removing it any earlier leaves devices that have not moved their key without one.',
    });

    if (migratedLabels.length) {
      contentEl.createEl('p', { text: `Moved on this device: ${migratedLabels.join(', ')}` });
    }

    new Setting(contentEl)
      .setName('Step 1: this device')
      .setDesc(
        'Copies your key into this device’s keychain. The settings file keeps its copy so your other devices can do the same.',
      )
      .addButton(btn =>
        btn
          .setButtonText('Move to keychain on this device')
          .setCta()
          .onClick(() => this.migrateAll()),
      );

    new Setting(contentEl)
      .setName('Step 2: after every device is done')
      .setDesc(
        this.allMigratedHere()
          ? 'Only do this after you have moved the key on all of your devices.'
          : 'Available once this device has moved its key. Only do this after you have moved the key on all of your devices.',
      )
      .addButton(btn =>
        btn
          .setButtonText('Remove key from settings file')
          .setClass('mod-warning')
          .setDisabled(!this.allMigratedHere())
          .onClick(() => {
            this.view = 'finish-confirm';
            this.render();
          }),
      )
      .addButton(btn =>
        btn.setButtonText('Not now').onClick(() => {
          this.plugin.app.saveLocalStorage(SECRET_MIGRATION_SNOOZE_KEY, Date.now());
          this.close();
        }),
      );
  }

  /**
   * Migrates every field that still needs it. `conflictField`/`options` apply
   * only to the one field the user was just asked about — every other field
   * migrates with no options, so if it also conflicts it gets its own
   * conflict view on a later call rather than silently inheriting this
   * choice. A `'failed'` field doesn't stop the others from being attempted;
   * failures are collected and shown together once the loop is done.
   */
  private migrateAll(conflictField?: ServiceProvider, options: MigrateOptions = {}): void {
    const failedFields: ServiceProvider[] = [];
    let nextConflictField: ServiceProvider | undefined;

    for (const key of this.fieldsWithLegacyValue) {
      if (this.stateFor(key) === 'migrated-here') continue;

      const field = SECRET_FIELDS[key];
      const fieldOptions = key === conflictField ? options : {};
      const { data, result } = migrateFieldOnDevice(this.plugin.settings, field, this.storage, fieldOptions);

      if (result === 'conflict') {
        if (!nextConflictField) nextConflictField = key;
        continue;
      }
      if (result === 'failed') {
        failedFields.push(key);
        continue;
      }

      Object.assign(this.plugin.settings, data);
    }

    void this.plugin.saveSettings();

    if (failedFields.length) {
      this.failedFields = failedFields;
      this.view = 'failed';
      return this.render();
    }

    if (nextConflictField) {
      this.conflictField = nextConflictField;
      this.view = 'conflict';
      return this.render();
    }

    new Notice('Moved to this device’s keychain.');
    this.view = 'migrate';
    this.render();
  }

  private renderConflict(key: ServiceProvider): void {
    const field = SECRET_FIELDS[key];
    const id = resolveSecretId(this.plugin.settings, field);
    const { contentEl } = this;

    contentEl.createEl('h2', { text: field.label });
    contentEl.createEl('p', {
      text: `A secret named "${id}" already exists on this device with a different value.`,
    });

    new Setting(contentEl)
      .addButton(btn =>
        btn.setButtonText('Use existing secret').onClick(() => {
          this.conflictField = undefined;
          this.migrateAll(key, { onConflict: 'use-existing' });
        }),
      )
      .addButton(btn =>
        btn
          .setButtonText('Replace with key from settings')
          .setClass('mod-warning')
          .onClick(() => {
            this.conflictField = undefined;
            this.migrateAll(key, { onConflict: 'replace' });
          }),
      );
  }

  private renderFailed(keys: ServiceProvider[]): void {
    const { contentEl } = this;

    contentEl.createEl('h2', { text: 'Could not move the key automatically' });
    for (const key of keys) {
      const field = SECRET_FIELDS[key];
      const id = resolveSecretId(this.plugin.settings, field);
      contentEl.createEl('p', { text: buildManualStepsText(field, id) });
    }

    new Setting(contentEl).addButton(btn => btn.setButtonText('Close').onClick(() => this.close()));
  }

  private renderFinishConfirm(): void {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: 'Remove key from settings file' });
    contentEl.createEl('p', {
      text: "This removes the plaintext key from data.json. Any device that hasn't moved its key to keychain will stop using your key. Only continue if you've done this on every device.",
    });

    const mismatched = fieldsWithMismatchedValues(this.plugin.settings, this.storage);
    if (mismatched.length) {
      contentEl.createEl('p', {
        text: `The keychain value on this device differs from the settings file value for: ${mismatched
          .map(field => field.label)
          .join(', ')}. Removing will delete the only copy of the settings file value.`,
      });
    }

    new Setting(contentEl)
      .addButton(btn =>
        btn.setButtonText('Cancel').onClick(() => {
          this.view = 'migrate';
          this.render();
        }),
      )
      .addButton(btn =>
        btn
          .setButtonText('Remove from all devices')
          .setClass('mod-warning')
          .onClick(() => void this.finishMigration()),
      );
  }

  private async finishMigration(): Promise<void> {
    const { data, removed } = removeLegacySecrets(this.plugin.settings, this.storage);
    Object.assign(this.plugin.settings, data);
    for (const key of removed) {
      delete (this.plugin.settings as unknown as Record<string, unknown>)[key];
    }
    this.plugin.settings.legacySecretsRemoved = true;

    try {
      await this.plugin.saveSettings();
    } catch (error) {
      console.error('Book Search: failed to save settings after removing legacy secrets', error);
      new Notice('Could not save the settings file. Try again.');
      return;
    }

    new Notice(removed.length ? 'Removed the key from the settings file.' : 'Nothing needed to be removed.');
    this.close();
  }
}
