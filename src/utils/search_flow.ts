// The search flow: the search dialog, then the results list, and back to the
// search as often as the user wants. Kept free of Obsidian imports so it can
// be tested without the modals.
import type { BaseBooksApiImpl } from '@apis/base_api';
import { Book } from '@models/book.model';

// What the search dialog opens with.
export interface SearchRequest {
  query: string;
  locale: string;
  immediate: boolean; // search straight away instead of waiting for the user
}

// What a search produced, and the query and locale that produced it.
export interface BookSearchResult {
  books: Book[];
  query: string;
  locale: string;
}

// The last item in the results list: go back to the search dialog.
export interface SearchAgain {
  searchAgain: true;
  query: string;
  immediate: boolean;
}

export type Suggestion = Book | SearchAgain;

export function isSearchAgain(item: Suggestion): item is SearchAgain {
  return 'searchAgain' in item;
}

// With nothing typed in the results list, reopen the search dialog with the
// previous query; with text typed, search for that text straight away.
export function searchAgainFor(typed: string, previousQuery: string): SearchAgain {
  const text = typed.trim();
  return text
    ? { searchAgain: true, query: text, immediate: true }
    : { searchAgain: true, query: previousQuery, immediate: false };
}

// The books matching what's typed in the results list (title, author or
// publisher), followed by the "search again" item.
export function suggestionsFor(books: Book[], typed: string, previousQuery: string): Suggestion[] {
  const needle = typed.trim().toLowerCase();
  const matches = books.filter(
    book =>
      book.title?.toLowerCase().includes(needle) ||
      book.author?.toLowerCase().includes(needle) ||
      book.publisher?.toLowerCase().includes(needle),
  );
  return [...matches, searchAgainFor(typed, previousQuery)];
}

// The search dialog to open after choosing "search again", in the given locale.
export function nextRequest(choice: SearchAgain, locale: string): SearchRequest {
  return { query: choice.query, locale, immediate: choice.immediate };
}

// A dialog was closed without a choice. Callers end the flow quietly.
export class SearchCancelledError extends Error {
  constructor() {
    super('Search cancelled');
    this.name = 'SearchCancelledError';
  }
}

// Passes on the first result only. A dialog settles when the user chooses and
// again, as cancelled, when it closes; whichever comes first wins, so a search
// that finishes after the dialog was closed is dropped.
export class Settler<T> {
  private done = false;

  constructor(private readonly callback: (error: Error | null, value?: T) => void) {}

  get settled(): boolean {
    return this.done;
  }

  settle(error: Error | null, value?: T): void {
    if (this.done) return;
    this.done = true;
    this.callback(error, value);
  }
}

type SearchOutcome =
  | { kind: 'results'; result: BookSearchResult }
  | { kind: 'noQuery' }
  | { kind: 'noResults'; query: string }
  | { kind: 'rateLimited' }
  | { kind: 'failed'; error: Error };

// One search with the provider, for the trimmed query. The query and locale are
// the values the search was started with, even if the dialog's fields change
// meanwhile.
export async function runSearch(provider: BaseBooksApiImpl, query: string, locale: string): Promise<SearchOutcome> {
  const text = query.trim();
  if (!text) return { kind: 'noQuery' };
  try {
    const books = await provider.getByQuery(text, { locale });
    return books?.length
      ? { kind: 'results', result: { books, query: text, locale } }
      : { kind: 'noResults', query: text };
  } catch (err) {
    // A 429 is a quota/rate limit; the dialog stays open and explains it.
    if ((err as { status?: number } | null | undefined)?.status === 429) return { kind: 'rateLimited' };
    return { kind: 'failed', error: err instanceof Error ? err : new Error(String(err || 'Search failed')) };
  }
}

// Runs search → results until the user picks a book. `search` opens the search
// dialog; `choose` opens the results list. The query and locale of the last
// search carry over into the next one.
export async function runSearchFlow(
  request: SearchRequest,
  search: (request: SearchRequest) => Promise<BookSearchResult>,
  choose: (result: BookSearchResult) => Promise<Suggestion>,
): Promise<Book> {
  let next = request;
  for (;;) {
    const result = await search(next);
    const choice = await choose(result);
    if (!isSearchAgain(choice)) return choice;
    next = nextRequest(choice, result.locale);
  }
}
