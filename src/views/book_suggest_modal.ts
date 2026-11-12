import { App, setIcon, SuggestModal } from 'obsidian';
import { Book } from '@models/book.model';
import {
  isSearchAgain,
  SearchAgain,
  searchAgainFor,
  SearchCancelledError,
  BookSearchResult,
  Settler,
  Suggestion,
  suggestionsFor,
} from '@utils/search_flow';

export class BookSuggestModal extends SuggestModal<Suggestion> {
  showCoverImageInSearch: boolean;
  private readonly settler: Settler<Suggestion>;

  constructor(
    app: App,
    showCoverImageInSearch: boolean,
    private readonly result: BookSearchResult,
    onChoose: (error: Error | null, result?: Suggestion) => void,
  ) {
    super(app);
    this.showCoverImageInSearch = showCoverImageInSearch;
    this.settler = new Settler(onChoose);
    // Room for every book plus "search again", so the item is never cut off.
    this.limit = result.books.length + 1;
    this.setInstructions([
      { command: '↑↓', purpose: 'to navigate' },
      { command: '↵', purpose: 'to choose' },
      { command: 'shift ↵', purpose: 'to search again' },
      { command: 'esc', purpose: 'to dismiss' },
    ]);
    // Shift+Enter searches again from anywhere in the list, like "create" in the quick switcher.
    // Returning false makes Obsidian prevent the default; while an IME is composing,
    // the key is left to the IME.
    this.scope.register(['Shift'], 'Enter', event => {
      if (event.isComposing) return;
      this.selectSuggestion(searchAgainFor(this.inputEl.value, this.result.query), event);
      return false;
    });
  }

  // The books matching what's typed, followed by a "search again" item.
  getSuggestions(query: string): Suggestion[] {
    return suggestionsFor(this.result.books, query, this.result.query);
  }

  // Renders each suggestion item.
  renderSuggestion(item: Suggestion, el: HTMLElement) {
    if (isSearchAgain(item)) this.renderSearchAgain(item, el);
    else this.renderBook(item, el);
  }

  private renderBook(book: Book, el: HTMLElement) {
    el.addClass('book-suggestion-item');

    const coverImageUrl = book.coverLargeUrl || book.coverMediumUrl || book.coverSmallUrl || book.coverUrl;

    if (this.showCoverImageInSearch && coverImageUrl) {
      el.createEl('img', {
        cls: 'book-cover-image',
        attr: {
          src: coverImageUrl,
          alt: `Cover Image for ${book.title}`,
        },
      });
    }

    const textContainer = el.createDiv({ cls: 'book-text-info' });
    textContainer.createDiv({ text: book.title });

    const publisher = book.publisher ? `, ${book.publisher}` : '';
    const publishDate = book.publishDate ? `(${book.publishDate})` : '';
    const totalPage = book.totalPage ? `, p${book.totalPage}` : '';
    const subtitle = `${book.author}${publisher}${publishDate}${totalPage}`;
    textContainer.createEl('small', { text: subtitle });
  }

  // "← Search again" with nothing typed; "Search for “…”" with text typed.
  private renderSearchAgain(item: SearchAgain, el: HTMLElement) {
    el.addClass('book-suggestion-item', 'book-search-plugin__search-again');
    setIcon(el.createSpan(), item.immediate ? 'search' : 'arrow-left');
    el.createSpan({ text: item.immediate ? `Search for “${item.query}”` : 'Search again' });
  }

  // Settle with the choice before Obsidian closes the list (and onClose cancels).
  selectSuggestion(item: Suggestion, evt: MouseEvent | KeyboardEvent) {
    this.settler.settle(null, item);
    super.selectSuggestion(item, evt);
  }

  // The choice was passed on in selectSuggestion.
  onChooseSuggestion() {}

  // Closed without a choice (Esc or a click outside). Settled in close() as well
  // as onClose, which on mobile runs only after the close animation.
  close() {
    this.settler.settle(new SearchCancelledError());
    super.close();
  }

  onClose() {
    super.onClose();
    this.settler.settle(new SearchCancelledError());
  }
}
