import { MarkdownView, Notice, Plugin, TFile, requestUrl } from 'obsidian';

import { BookSearchModal } from '@views/book_search_modal';
import { BookSuggestModal } from '@views/book_suggest_modal';
import { SecretMigrationModal } from '@views/secret_migration_modal';
import { buildMissingSecretNoticeText } from '@views/secret_migration_notice';
import { CursorJumper } from '@utils/cursor_jumper';
import { Book } from '@models/book.model';
import { BookSearchSettingTab, BookSearchPluginSettings, DEFAULT_SETTINGS } from '@settings/settings';
import {
  fieldsNeedingMissingNotice,
  getSecretState,
  isSnoozeActive,
  resolveSecretId,
  SECRET_FIELDS,
  SECRET_MIGRATION_SNOOZE_KEY,
  stripLegacySecrets,
} from '@settings/secrets';
import {
  getTemplateContents,
  applyTemplateTransformations,
  useTemplaterPluginInFile,
  executeInlineScriptsTemplates,
} from '@utils/template';
import { replaceVariableSyntax, makeFileName, applyDefaultFrontMatter, toStringFrontMatter } from '@utils/utils';

export default class BookSearchPlugin extends Plugin {
  settings: BookSearchPluginSettings;
  private migrationModalOpen = false;

  onload(): void {
    void this.initialize();
  }

  /**
   * Called by Obsidian when `data.json` is modified externally (e.g. by a
   * Sync service). Reloads settings so a stale in-memory copy — which could
   * otherwise write legacy secrets back into `data.json` on its next save,
   * or miss that `legacySecretsRemoved` is now true — catches up. Only the
   * missing-secret notice re-runs here; the migration modal is intentionally
   * not reopened on every external change.
   */
  async onExternalSettingsChange(): Promise<void> {
    await this.loadSettings();
    this.checkMissingSecretNotice();
  }

  private async initialize(): Promise<void> {
    await this.loadSettings();

    // This creates an icon in the left ribbon.
    const ribbonIconEl = this.addRibbonIcon('book', 'Create new book note', () => {
      void this.createNewBookNote();
    });
    // Perform additional things with the ribbon
    ribbonIconEl.addClass('obsidian-book-search-plugin-ribbon-class');

    // This adds a simple command that can be triggered anywhere
    this.addCommand({
      id: 'open-book-search-modal',
      name: 'Create new book note',
      callback: () => {
        void this.createNewBookNote();
      },
    });

    this.addCommand({
      id: 'open-book-search-modal-to-insert',
      name: 'Insert the metadata',
      callback: () => {
        void this.insertMetadata();
      },
    });

    // This adds a settings tab so the user can configure various aspects of the plugin
    this.addSettingTab(new BookSearchSettingTab(this.app, this));

    // Don't fire the secret-migration check during startup.
    this.app.workspace.onLayoutReady(() => this.checkSecretMigration());

    console.debug(`Book Search: version ${this.manifest.version} (requires obsidian ${this.manifest.minAppVersion})`);
  }

  private checkMissingSecretNotice(): void {
    const storage = this.app.secretStorage;
    for (const field of fieldsNeedingMissingNotice(this.settings, storage)) {
      const id = resolveSecretId(this.settings, field);
      new Notice(buildMissingSecretNoticeText(field, id), 0);
    }
  }

  private checkSecretMigration(): void {
    this.checkMissingSecretNotice();

    // Once the user has confirmed every device is done, legacy values are
    // stripped on every save. Don't offer to migrate again even if a stale
    // write momentarily resurrects one.
    if (this.settings.legacySecretsRemoved) return;

    const storage = this.app.secretStorage;
    const needsMigration = Object.values(SECRET_FIELDS).some(
      field => getSecretState(this.settings, field, storage) === 'needs-migrate',
    );
    if (!needsMigration) return;

    const snoozedAt: unknown = this.app.loadLocalStorage(SECRET_MIGRATION_SNOOZE_KEY);
    if (isSnoozeActive(snoozedAt)) return;

    if (this.migrationModalOpen) return;
    this.migrationModalOpen = true;
    new SecretMigrationModal(this, () => {
      this.migrationModalOpen = false;
    }).open();
  }

  showNotice(message: unknown) {
    try {
      let text: string;
      if (message instanceof Error) {
        text = message.message;
      } else if (typeof message === 'string') {
        text = message;
      } else if (message != null) {
        text = JSON.stringify(message);
      } else {
        text = '';
      }
      new Notice(text);
    } catch {
      // silently ignored
    }
  }

  // open modal for book search
  async searchBookMetadata(query?: string): Promise<Book> {
    const searchedBooks = await this.openBookSearchModal(query);
    return await this.openBookSuggestModal(searchedBooks);
  }

  async getRenderedContents(book: Book) {
    const {
      templateFile,
      useDefaultFrontmatter,
      defaultFrontmatterKeyType,
      enableCoverImageSave,
      coverImagePath,
      frontmatter, // @deprecated
      content, // @deprecated
    } = this.settings;

    let contentBody = '';

    if (enableCoverImageSave) {
      const coverImageUrl = book.coverLargeUrl || book.coverMediumUrl || book.coverSmallUrl || book.coverUrl;
      if (coverImageUrl) {
        const imageName = makeFileName(book, this.settings.fileNameFormat, 'jpg');
        book.localCoverImage = await this.downloadAndSaveImage(imageName, coverImagePath, coverImageUrl);
      }
    }

    if (templateFile) {
      const templateContents = await getTemplateContents(this.app, templateFile);
      const replacedVariable = replaceVariableSyntax(book, applyTemplateTransformations(templateContents));
      contentBody += executeInlineScriptsTemplates(book, replacedVariable);
    } else {
      let replacedVariableFrontmatter = replaceVariableSyntax(book, frontmatter); // @deprecated
      if (useDefaultFrontmatter) {
        replacedVariableFrontmatter = toStringFrontMatter(
          applyDefaultFrontMatter(book, replacedVariableFrontmatter, defaultFrontmatterKeyType),
        );
      }
      const replacedVariableContent = replaceVariableSyntax(book, content);
      contentBody += replacedVariableFrontmatter
        ? `---\n${replacedVariableFrontmatter}\n---\n${replacedVariableContent}`
        : replacedVariableContent;
    }

    return contentBody;
  }

  async downloadAndSaveImage(imageName: string, directory: string, imageUrl: string): Promise<string> {
    const { enableCoverImageSave } = this.settings;
    if (!enableCoverImageSave) {
      console.warn('Cover image saving is not enabled.');
      return '';
    }

    try {
      // Use Obsidian's requestUrl method to fetch the image data:
      const response = await requestUrl({
        url: imageUrl,
        method: 'GET',
        headers: {
          Accept: 'image/*',
        },
      });

      if (response.status !== 200) {
        throw new Error(`Failed to download image: ${response.status}`);
      }

      const imageData = response.arrayBuffer;
      const filePath = `${directory}/${imageName}`;
      await this.app.vault.adapter.writeBinary(filePath, imageData);
      return filePath;
    } catch (error) {
      console.error('Error downloading or saving image:', error);
      return '';
    }
  }

  async insertMetadata(): Promise<void> {
    try {
      const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (!markdownView) {
        console.warn('Can not find an active markdown view');
        return;
      }

      // TODO: Try using a search query on the selected text
      const book = await this.searchBookMetadata(markdownView.file.basename);

      if (!markdownView.editor) {
        console.warn('Can not find editor from the active markdown view');
        return;
      }

      const renderedContents = await this.getRenderedContents(book);
      markdownView.editor.replaceRange(renderedContents, { line: 0, ch: 0 });
    } catch (err) {
      console.warn(err);
      this.showNotice(err);
    }
  }

  async ensureFolderExists(folderPath: string): Promise<void> {
    if (!folderPath) return;
    const folder = this.app.vault.getAbstractFileByPath(folderPath);
    if (!folder) {
      await this.app.vault.createFolder(folderPath);
    }
  }

  async createNewBookNote(): Promise<void> {
    try {
      const book = await this.searchBookMetadata();
      const renderedContents = await this.getRenderedContents(book);

      // TODO: If the same file exists, it asks if you want to overwrite it.
      // create new File
      const fileName = makeFileName(book, this.settings.fileNameFormat);
      const folderPath = this.settings.folder;
      const filePath = `${folderPath}/${fileName}`;
      await this.ensureFolderExists(folderPath);
      const targetFile = await this.app.vault.create(filePath, renderedContents);

      // if use Templater plugin
      await useTemplaterPluginInFile(this.app, targetFile);
      await this.openNewBookNote(targetFile);
    } catch (err) {
      console.warn(err);
      this.showNotice(err);
    }
  }

  async openNewBookNote(targetFile: TFile) {
    if (!this.settings.openPageOnCompletion) return;

    // open file
    const activeLeaf = this.app.workspace.getLeaf();
    if (!activeLeaf) {
      console.warn('No active leaf');
      return;
    }

    await activeLeaf.openFile(targetFile, { state: { mode: 'source' } });
    activeLeaf.setEphemeralState({ rename: 'all' });
    // cursor focus
    await new CursorJumper(this.app).jumpToNextCursorLocation();
  }

  async openBookSearchModal(query = ''): Promise<Book[]> {
    return new Promise((resolve, reject) => {
      return new BookSearchModal(this, query, (error, results) => {
        return error ? reject(error) : resolve(results);
      }).open();
    });
  }

  async openBookSuggestModal(books: Book[]): Promise<Book> {
    return new Promise((resolve, reject) => {
      return new BookSuggestModal(this.app, this.settings.showCoverImageInSearch, books, (error, selectedBook) => {
        return error ? reject(error) : resolve(selectedBook);
      }).open();
    });
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, (await this.loadData()) as Partial<BookSearchPluginSettings>);
    // Defend against a stale sync write that resurrected a legacy value
    // after this device already finished migration — don't let it fall back
    // into use again in memory.
    if (this.settings.legacySecretsRemoved) {
      this.settings = stripLegacySecrets(this.settings);
    }
  }

  async saveSettings() {
    const data = this.settings.legacySecretsRemoved ? stripLegacySecrets(this.settings) : this.settings;
    await this.saveData(data);
  }
}
