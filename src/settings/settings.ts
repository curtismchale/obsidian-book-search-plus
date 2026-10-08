import { replaceDateInString } from '@utils/utils';
import { App, moment, PluginSettingTab, SecretComponent, Setting } from 'obsidian';

import { getSecretState, hasAnyLegacyValue, SECRET_FIELDS } from '@settings/secrets';
import { ServiceProvider } from '@src/constants';
import languages from '@utils/languages';
import { SecretMigrationModal } from '@views/secret_migration_modal';
import { SettingServiceProviderModal } from '@views/setting_service_provider_modal';
import BookSearchPlugin from '../main';
import { FileNameFormatSuggest } from './suggesters/FileNameFormatSuggester';
import { FileSuggest } from './suggesters/FileSuggester';
import { FolderSuggest } from './suggesters/FolderSuggester';

const docUrl = 'https://github.com/anpigon/obsidian-book-search-plugin';

export enum DefaultFrontmatterKeyType {
  snakeCase = 'Snake Case',
  camelCase = 'Camel Case',
}

export interface BookSearchPluginSettings {
  folder: string; // new file location
  fileNameFormat: string; // new file name format
  frontmatter: string; // frontmatter that is inserted into the file
  content: string; // what is automatically written to the file.
  useDefaultFrontmatter: boolean;
  defaultFrontmatterKeyType: DefaultFrontmatterKeyType;
  templateFile: string;
  serviceProvider: ServiceProvider;
  naverClientId: string;
  /** @deprecated legacy plaintext value; stays in data.json until the user finishes migrating every device to Keychain */
  naverClientSecret?: string;
  naverClientSecretName: string;
  localePreference: string;
  /** @deprecated legacy plaintext value; stays in data.json until the user finishes migrating every device to Keychain */
  apiKey?: string;
  googleApiKeySecret: string;
  openPageOnCompletion: boolean;
  showCoverImageInSearch: boolean;
  enableCoverImageSave: boolean;
  enableCoverImageEdgeCurl: boolean;
  coverImagePath: string;
  askForLocale: boolean;
  /** Set once the user confirms every device has moved its key to Keychain. Once true, legacy plaintext fields are stripped on every save and the migration modal stops offering to migrate. */
  legacySecretsRemoved: boolean;
}

export const DEFAULT_SETTINGS: BookSearchPluginSettings = {
  folder: '',
  fileNameFormat: '',
  frontmatter: '',
  content: '',
  useDefaultFrontmatter: true,
  defaultFrontmatterKeyType: DefaultFrontmatterKeyType.camelCase,
  templateFile: '',
  serviceProvider: ServiceProvider.google,
  naverClientId: '',
  naverClientSecretName: '',
  localePreference: 'default',
  googleApiKeySecret: '',
  openPageOnCompletion: true,
  showCoverImageInSearch: false,
  enableCoverImageSave: false,
  enableCoverImageEdgeCurl: true,
  coverImagePath: '',
  askForLocale: true,
  legacySecretsRemoved: false,
};

export class BookSearchSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private plugin: BookSearchPlugin,
  ) {
    super(app, plugin);
  }

  private createGeneralSettings(containerEl: HTMLElement) {
    this.createHeader('General settings', containerEl);
    this.createFileLocationSetting(containerEl);
    this.createFileNameFormatSetting(containerEl);
  }

  private createHeader(title: string, containerEl: HTMLElement) {
    return new Setting(containerEl).setName(title).setHeading();
  }

  private createFileLocationSetting(containerEl: HTMLElement) {
    new Setting(containerEl)
      .setName('New file location')
      .setDesc('New book notes will be placed here.')
      .addSearch(cb => {
        try {
          new FolderSuggest(this.app, cb.inputEl);
        } catch (e) {
          console.error(e); // Improved error handling
        }
        cb.setPlaceholder('Example: folder1/folder2')
          .setValue(this.plugin.settings.folder)
          .onChange(new_folder => {
            this.plugin.settings.folder = new_folder;
            void this.plugin.saveSettings();
          });
      });
  }

  private createFileNameFormatSetting(containerEl: HTMLElement) {
    const hintFrag: DocumentFragment = createFragment();
    const newFileNameHint = hintFrag.createEl('code', {
      text: replaceDateInString(this.plugin.settings.fileNameFormat) || '{{title}} - {{author}}',
    });
    new Setting(containerEl)
      .setClass('book-search-plugin__settings--new_file_name')
      .setName('New file name')
      .setDesc('Enter the file name format.')
      .addSearch(cb => {
        try {
          new FileNameFormatSuggest(this.app, cb.inputEl);
        } catch (e) {
          console.error(e); // Improved error handling
        }
        cb.setPlaceholder('Example: {{title}} - {{author}}')
          .setValue(this.plugin.settings.fileNameFormat)
          .onChange(newValue => {
            this.plugin.settings.fileNameFormat = newValue?.trim();
            void this.plugin.saveSettings();

            newFileNameHint.textContent = replaceDateInString(newValue) || '{{title}} - {{author}}';
          });
      });
    containerEl
      .createDiv({
        cls: ['setting-item-description', 'book-search-plugin__settings--new_file_name_hint'],
      })
      .append(newFileNameHint);
  }

  private createTemplateFileSetting(containerEl: HTMLElement) {
    const templateFileDesc: DocumentFragment = createFragment();
    templateFileDesc.createDiv({ text: 'Files will be available as templates.' });
    templateFileDesc.createEl('a', {
      text: 'Example template',
      href: `${docUrl}#example-template`,
    });
    new Setting(containerEl)
      .setName('Template file')
      .setDesc(templateFileDesc)
      .addSearch(cb => {
        try {
          new FileSuggest(this.app, cb.inputEl);
        } catch {
          // ignore suggester init errors
        }
        cb.setPlaceholder('Example: templates/template-file')
          .setValue(this.plugin.settings.templateFile)
          .onChange(newTemplateFile => {
            this.plugin.settings.templateFile = newTemplateFile;
            void this.plugin.saveSettings();
          });
      });
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.classList.add('book-search-plugin__settings');

    this.createGeneralSettings(containerEl);
    this.createTemplateFileSetting(containerEl);

    // Service Provider
    let serviceProviderExtraSettingButton: HTMLElement;
    let preferredLocaleDropdownSetting: Setting;
    let coverImageEdgeCurlToggleSetting: Setting;
    const hideServiceProviderExtraSettingButton = () => {
      serviceProviderExtraSettingButton.addClass('book-search-plugin__hide');
    };
    const showServiceProviderExtraSettingButton = () => {
      serviceProviderExtraSettingButton.removeClass('book-search-plugin__hide');
    };
    const hideServiceProviderExtraSettingDropdown = () => {
      if (preferredLocaleDropdownSetting !== undefined) {
        preferredLocaleDropdownSetting.settingEl.addClass('book-search-plugin__hide');
      }
    };
    const showServiceProviderExtraSettingDropdown = () => {
      if (preferredLocaleDropdownSetting !== undefined) {
        preferredLocaleDropdownSetting.settingEl.removeClass('book-search-plugin__hide');
      }
    };
    const hideCoverImageEdgeCurlToggle = () => {
      if (coverImageEdgeCurlToggleSetting !== undefined) {
        coverImageEdgeCurlToggleSetting.settingEl.addClass('book-search-plugin__hide');
      }
    };
    const showCoverImageEdgeCurlToggle = () => {
      if (coverImageEdgeCurlToggleSetting !== undefined) {
        coverImageEdgeCurlToggleSetting.settingEl.removeClass('book-search-plugin__hide');
      }
    };

    const toggleServiceProviderExtraSettings = (
      serviceProvider: ServiceProvider = this.plugin.settings?.serviceProvider,
    ) => {
      if (serviceProvider === ServiceProvider.naver) {
        showServiceProviderExtraSettingButton();
        hideServiceProviderExtraSettingDropdown();
        hideCoverImageEdgeCurlToggle();
      } else {
        hideServiceProviderExtraSettingButton();
        showServiceProviderExtraSettingDropdown();
        showCoverImageEdgeCurlToggle();
      }
    };
    new Setting(containerEl)
      .setName('Service provider')
      .setDesc('Choose the service provider you want to use to search your books.')
      .setClass('book-search-plugin__settings--service_provider')
      .addDropdown(dropDown => {
        dropDown.addOption(ServiceProvider.google, `${ServiceProvider.google} (Global)`);
        dropDown.addOption(ServiceProvider.naver, `${ServiceProvider.naver} (Korean)`);
        dropDown.setValue(this.plugin.settings?.serviceProvider ?? ServiceProvider.google);
        dropDown.onChange(async value => {
          const newValue = value as ServiceProvider;
          toggleServiceProviderExtraSettings(newValue);
          this.plugin.settings['serviceProvider'] = newValue;
          await this.plugin.saveSettings();
        });
      })
      .addExtraButton(component => {
        serviceProviderExtraSettingButton = component.extraSettingsEl;
        toggleServiceProviderExtraSettings();
        component.onClick(() => {
          new SettingServiceProviderModal(this.plugin).open();
        });
      });

    preferredLocaleDropdownSetting = new Setting(containerEl)
      .setName('Preferred locale')
      .setDesc('Sets the preferred locale to use when searching for books.')
      .addDropdown(dropDown => {
        const langs = languages as Record<string, string | undefined>;
        const defaultLocale = moment.locale();
        dropDown.addOption(defaultLocale, `${langs[defaultLocale] ?? defaultLocale} (Default Locale)`);
        moment.locales().forEach(locale => {
          const localeName = langs[locale];
          if (localeName && locale !== defaultLocale) dropDown.addOption(locale, localeName);
        });
        const localeValue = this.plugin.settings.localePreference;
        dropDown
          .setValue(localeValue === DEFAULT_SETTINGS.localePreference ? defaultLocale : localeValue)
          .onChange(async value => {
            const newValue = value;
            this.plugin.settings.localePreference = newValue;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName('Open new book note')
      .setDesc('Enable or disable the automatic opening of the note on creation.')
      .addToggle(toggle =>
        toggle.setValue(this.plugin.settings.openPageOnCompletion).onChange(async value => {
          this.plugin.settings.openPageOnCompletion = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName('Show cover images in search')
      .setDesc('Toggle to show or hide cover images in the search results.')
      .addToggle(toggle =>
        toggle.setValue(this.plugin.settings.showCoverImageInSearch).onChange(async value => {
          this.plugin.settings.showCoverImageInSearch = value;
          await this.plugin.saveSettings();
        }),
      );

    // A toggle whether or not to ask for the locale every time a search is made
    new Setting(containerEl)
      .setName('Ask for locale')
      .setDesc('Toggle to enable or disable asking for the locale every time a search is made.')
      .addToggle(toggle =>
        toggle.setValue(this.plugin.settings.askForLocale).onChange(async value => {
          this.plugin.settings.askForLocale = value;
          await this.plugin.saveSettings();
        }),
      );

    coverImageEdgeCurlToggleSetting = new Setting(containerEl)
      .setName('Enable cover image edge curl effect')
      .setDesc('Toggle to show or hide page curl effect in cover images.')
      .addToggle(toggle =>
        toggle.setValue(this.plugin.settings.enableCoverImageEdgeCurl).onChange(async value => {
          this.plugin.settings.enableCoverImageEdgeCurl = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName('Enable cover image save')
      .setDesc('Toggle to enable or disable saving cover images in notes.')
      .addToggle(toggle =>
        toggle.setValue(this.plugin.settings.enableCoverImageSave).onChange(async value => {
          this.plugin.settings.enableCoverImageSave = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName('Cover image path')
      .setDesc('Specify the path where cover images should be saved.')
      .addSearch(cb => {
        try {
          new FolderSuggest(this.app, cb.inputEl);
        } catch {
          // ignore suggester init errors
        }
        cb.setPlaceholder('Enter the path (e.g., images/covers)')
          .setValue(this.plugin.settings.coverImagePath)
          .onChange(async value => {
            this.plugin.settings.coverImagePath = value.trim();
            await this.plugin.saveSettings();
          });
      });

    // Google API settings
    this.createHeader('Google API settings', containerEl);
    new Setting(containerEl)
      .setName('Google API note')
      .setDesc('Use this field only after understanding Google cloud API key security.');

    new Setting(containerEl)
      .setName('API key')
      .setDesc('Select or create a keychain secret holding your Google books API key. Secrets are stored per device.')
      .addComponent(el =>
        new SecretComponent(this.app, el).setValue(this.plugin.settings.googleApiKeySecret).onChange(async value => {
          this.plugin.settings.googleApiKeySecret = value;
          await this.plugin.saveSettings();
        }),
      );

    if (hasAnyLegacyValue(this.plugin.settings)) {
      this.createMigrationSettings(containerEl);
    }
  }

  private createMigrationSettings(containerEl: HTMLElement): void {
    this.createHeader('Keychain migration', containerEl);
    new Setting(containerEl)
      .setName('Keychain migration note')
      .setDesc(
        'Secrets are stored per device and do not sync, so each device needs to move its key to the keychain before you remove it from the settings file.',
      );

    for (const field of Object.values(SECRET_FIELDS)) {
      if (!this.plugin.settings[field.legacyKey]) continue;

      const state = getSecretState(this.plugin.settings, field, this.app.secretStorage);
      const statusText = state === 'migrated-here' ? 'Moved on this device' : 'Not yet moved on this device';

      new Setting(containerEl)
        .setName(field.label)
        .setDesc(statusText)
        .addButton(button =>
          button.setButtonText('Migrate…').onClick(() => {
            new SecretMigrationModal(this.plugin, () => this.display()).open();
          }),
        );
    }
  }
}
