import { BaseBooksApiImpl, factoryServiceProvider } from '@apis/base_api';
import { resolveSecret, SECRET_FIELDS } from '@settings/secrets';
import { DEFAULT_SETTINGS } from '@settings/settings';
import { ServiceProvider } from '@src/constants';
import BookSearchPlugin from '@src/main';
import languages from '@utils/languages';
import { runSearch, SearchCancelledError, SearchRequest, BookSearchResult, Settler } from '@utils/search_flow';
import { ButtonComponent, Modal, moment, Notice, SearchComponent, Setting } from 'obsidian';
import { buildRateLimitNoticeFragment } from './rate_limit_notice';

export class BookSearchModal extends Modal {
  private readonly SEARCH_BUTTON_TEXT = 'Search';
  private readonly REQUESTING_BUTTON_TEXT = 'Requesting...';
  private isBusy = false;
  private okBtnRef?: ButtonComponent;
  private serviceProvider: BaseBooksApiImpl;
  private options: { locale: string };
  private googleApiKey?: string;
  private query: string;
  // Search as soon as the dialog opens (coming from "Search for …" in the results list).
  private readonly searchImmediately: boolean;
  private readonly settler: Settler<BookSearchResult>;

  constructor(
    private plugin: BookSearchPlugin,
    request: SearchRequest,
    callback: (error: Error | null, result?: BookSearchResult) => void,
  ) {
    super(plugin.app);
    this.query = request.query;
    this.options = { locale: request.locale };
    this.searchImmediately = request.immediate;
    this.settler = new Settler(callback);
    // Resolved at search time (modal open), not at plugin load, so a secret
    // changed in Keychain works without a reload.
    this.googleApiKey = resolveSecret(plugin.settings, SECRET_FIELDS.google, plugin.app.secretStorage);
    const naverClientSecret = resolveSecret(plugin.settings, SECRET_FIELDS.naver, plugin.app.secretStorage);
    this.serviceProvider = factoryServiceProvider(plugin.settings, {
      googleApiKey: this.googleApiKey,
      naverClientSecret,
    });
  }

  setBusy(busy: boolean): void {
    this.isBusy = busy;
    this.okBtnRef?.setDisabled(busy).setButtonText(busy ? this.REQUESTING_BUTTON_TEXT : this.SEARCH_BUTTON_TEXT);
  }

  async searchBook(): Promise<void> {
    if (this.isBusy) return;

    // Captured before the request: the fields stay editable while it runs.
    const { query } = this;
    const { locale } = this.options;
    this.setBusy(true);
    const outcome = await runSearch(this.serviceProvider, query, locale);
    // Closed while the request ran: the search was cancelled, so drop the result.
    if (this.settler.settled) return;
    this.setBusy(false);

    // Apart from results, the dialog stays open so the query can be changed or retried.
    switch (outcome.kind) {
      case 'results':
        this.settler.settle(null, outcome.result);
        this.close();
        break;
      case 'noQuery':
        new Notice('No query entered.');
        break;
      case 'noResults':
        new Notice(`No results found for "${outcome.query}"`);
        break;
      case 'rateLimited':
        new Notice(buildRateLimitNoticeFragment(!!this.googleApiKey), 8000);
        break;
      case 'failed':
        console.warn(outcome.error);
        this.plugin.showNotice(outcome.error);
        break;
    }
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: 'Search book' });
    if (this.plugin.settings.serviceProvider === ServiceProvider.google && this.plugin.settings.askForLocale)
      this.renderSelectLocale();
    contentEl.createDiv({ cls: 'book-search-plugin__search-modal--input' }, el => {
      // Obsidian's search field, with a button that clears the query.
      const searchComponent = new SearchComponent(el)
        .setValue(this.query)
        .setPlaceholder('Search by keyword or isbn')
        .onChange(value => (this.query = value));
      searchComponent.inputEl.addEventListener('keydown', event => {
        if (event.key === 'Enter' && !event.isComposing) {
          void this.searchBook();
        }
      });
      activeWindow.setTimeout(() => searchComponent.inputEl.focus(), 0);
    });
    new Setting(this.contentEl).addButton(btn => {
      this.okBtnRef = btn
        .setButtonText(this.SEARCH_BUTTON_TEXT)
        .setCta()
        .onClick(() => {
          void this.searchBook();
        });
    });
    if (this.searchImmediately) void this.searchBook();
  }

  renderSelectLocale() {
    const langs = languages as Record<string, string | undefined>;
    const defaultLocale = moment.locale();
    new Setting(this.contentEl).setName('Locale').addDropdown(dropdown => {
      dropdown.addOption(defaultLocale, `${langs[defaultLocale] ?? defaultLocale}`);
      moment.locales().forEach(locale => {
        const localeName = langs[locale];
        if (localeName && locale !== defaultLocale) dropdown.addOption(locale, localeName);
      });
      dropdown
        .setValue(this.options.locale === DEFAULT_SETTINGS.localePreference ? defaultLocale : this.options.locale)
        .onChange(locale => (this.options.locale = locale));
    });
  }

  // Closed without results (Esc, or while a search was running). Settled here and
  // not only in onClose, which on mobile runs after the close animation: a search
  // finishing during the animation must not open the results list.
  close(): void {
    this.settler.settle(new SearchCancelledError());
    super.close();
  }

  onClose(): void {
    this.contentEl.empty();
    this.settler.settle(new SearchCancelledError());
  }
}
