import { ServiceProvider } from '@src/constants';
import BookSearchPlugin from '@src/main';
import { Modal, SecretComponent, Setting } from 'obsidian';

export class SettingServiceProviderModal extends Modal {
  private readonly plugin: BookSearchPlugin;
  private readonly currentServiceProvider: ServiceProvider;

  constructor(
    plugin: BookSearchPlugin,
    private callback?: () => void,
  ) {
    super(plugin.app);
    this.plugin = plugin;
    this.currentServiceProvider = plugin.settings?.serviceProvider ?? ServiceProvider.google;
  }

  get settings() {
    return this.plugin.settings;
  }

  async saveSetting() {
    return this.plugin.saveSettings();
  }

  saveClientId(clientId: string) {
    if (this.currentServiceProvider === ServiceProvider.naver) {
      this.plugin.settings['naverClientId'] = clientId;
    }
  }

  saveClientSecretName(secretName: string) {
    if (this.currentServiceProvider === ServiceProvider.naver) {
      this.settings['naverClientSecretName'] = secretName;
    }
  }

  get currentClientId() {
    if (this.currentServiceProvider === ServiceProvider.naver) {
      return this.settings.naverClientId;
    }
    return '';
  }

  get currentClientSecretName() {
    if (this.currentServiceProvider === ServiceProvider.naver) {
      return this.settings.naverClientSecretName;
    }
    return '';
  }

  onOpen() {
    const { contentEl } = this;

    contentEl.createEl('h2', { text: 'Service provider setting' });

    new Setting(contentEl).setName('Client ID').addText(text => {
      text.setValue(this.currentClientId).onChange(value => this.saveClientId(value));
    });

    new Setting(contentEl)
      .setName('Client secret')
      .setDesc('Select or create a keychain secret holding your naver client secret. Secrets are stored per device.')
      .addComponent(el =>
        new SecretComponent(this.app, el)
          .setValue(this.currentClientSecretName)
          .onChange(value => this.saveClientSecretName(value)),
      );

    new Setting(contentEl).addButton(btn =>
      btn
        .setButtonText('Save')
        .setCta()
        .onClick(async () => {
          await this.plugin.saveSettings();
          this.close();
          this.callback?.();
        }),
    );
  }

  onClose() {
    this.contentEl.empty();
  }
}
