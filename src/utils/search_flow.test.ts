import { Book } from '@models/book.model';
import {
  isSearchAgain,
  nextRequest,
  runSearch,
  runSearchFlow,
  SearchAgain,
  searchAgainFor,
  SearchCancelledError,
  SearchRequest,
  BookSearchResult,
  Settler,
  suggestionsFor,
} from './search_flow';

const book = (title: string, author = '', publisher = ''): Book => ({ title, author, authors: [author], publisher });

const carl = book('Dungeon Crawler Carl', 'Matt Dinniman', 'DreamLitt');
const flow = book('Flow', 'Mihaly Csikszentmihalyi', 'Harper Collins');

describe('searchAgainFor', () => {
  it('reopens the search with the previous query when nothing is typed', () => {
    expect(searchAgainFor('', 'dungeon')).toEqual({ searchAgain: true, query: 'dungeon', immediate: false });
    expect(searchAgainFor('   ', 'dungeon')).toEqual({ searchAgain: true, query: 'dungeon', immediate: false });
  });

  it('searches for the typed text straight away', () => {
    expect(searchAgainFor('  Hyperion  ', 'dungeon')).toEqual({
      searchAgain: true,
      query: 'Hyperion',
      immediate: true,
    });
  });
});

describe('suggestionsFor', () => {
  it('lists every book, then "search again", when nothing is typed', () => {
    expect(suggestionsFor([carl, flow], '', 'dungeon')).toEqual([carl, flow, searchAgainFor('', 'dungeon')]);
  });

  it('filters on title, author and publisher, then offers to search for the typed text', () => {
    expect(suggestionsFor([carl, flow], 'harper', 'dungeon')).toEqual([flow, searchAgainFor('harper', 'dungeon')]);
    expect(suggestionsFor([carl, flow], 'dinniman', 'x')).toEqual([carl, searchAgainFor('dinniman', 'x')]);
    expect(suggestionsFor([carl, flow], 'dungeon', 'x')).toEqual([carl, searchAgainFor('dungeon', 'x')]);
  });

  it('still offers a new search when no book matches the typed text', () => {
    expect(suggestionsFor([carl, flow], 'Hyperion', 'dungeon')).toEqual([searchAgainFor('Hyperion', 'dungeon')]);
  });
});

describe('isSearchAgain', () => {
  it('tells a "search again" item from a book', () => {
    expect(isSearchAgain(searchAgainFor('', 'x'))).toBe(true);
    expect(isSearchAgain(carl)).toBe(false);
  });
});

describe('nextRequest', () => {
  it('opens the search dialog with the chosen query, how to search it, and the given locale', () => {
    expect(nextRequest(searchAgainFor('', 'dungeon'), 'en')).toEqual({
      query: 'dungeon',
      locale: 'en',
      immediate: false,
    });
    expect(nextRequest(searchAgainFor('hyperion', 'dungeon'), 'da')).toEqual({
      query: 'hyperion',
      locale: 'da',
      immediate: true,
    });
  });
});

describe('Settler', () => {
  it('passes on the first result only', () => {
    const callback = jest.fn();
    const settler = new Settler<string>(callback);
    expect(settler.settled).toBe(false);

    settler.settle(null, 'chosen');
    settler.settle(new SearchCancelledError());

    expect(settler.settled).toBe(true);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(null, 'chosen');
  });
});

describe('runSearch', () => {
  const provider = (getByQuery: jest.Mock) => ({ getByQuery });

  it('searches for the trimmed query and returns the books with the query and locale that produced them', async () => {
    const getByQuery = jest.fn().mockResolvedValue([carl]);
    await expect(runSearch(provider(getByQuery), '  carl  ', 'da')).resolves.toEqual({
      kind: 'results',
      result: { books: [carl], query: 'carl', locale: 'da' },
    });
    expect(getByQuery).toHaveBeenCalledWith('carl', { locale: 'da' });
  });

  it('does not search for an empty query', async () => {
    const getByQuery = jest.fn();
    await expect(runSearch(provider(getByQuery), '   ', 'da')).resolves.toEqual({ kind: 'noQuery' });
    await expect(runSearch(provider(getByQuery), '', 'da')).resolves.toEqual({ kind: 'noQuery' });
    expect(getByQuery).not.toHaveBeenCalled();
  });

  it('reports no results, with the trimmed query, for an empty list', async () => {
    await expect(runSearch(provider(jest.fn().mockResolvedValue([])), ' xyz ', 'en')).resolves.toEqual({
      kind: 'noResults',
      query: 'xyz',
    });
    await expect(runSearch(provider(jest.fn().mockResolvedValue(undefined)), 'xyz', 'en')).resolves.toEqual({
      kind: 'noResults',
      query: 'xyz',
    });
  });

  it('turns a rejection that is not an Error into a failure with an Error', async () => {
    for (const reason of [null, undefined, '', 'timeout']) {
      const outcome = await runSearch(provider(jest.fn().mockRejectedValue(reason)), 'carl', 'en');
      expect(outcome.kind).toBe('failed');
      expect(outcome.kind === 'failed' && outcome.error).toBeInstanceOf(Error);
    }
  });

  it('reports a rate limit (429) separately from other errors', async () => {
    const rateLimited = Object.assign(new Error('Request failed, status 429'), { status: 429 });
    await expect(runSearch(provider(jest.fn().mockRejectedValue(rateLimited)), 'carl', 'en')).resolves.toEqual({
      kind: 'rateLimited',
    });

    const failure = new Error('Request failed, status 500');
    await expect(runSearch(provider(jest.fn().mockRejectedValue(failure)), 'carl', 'en')).resolves.toEqual({
      kind: 'failed',
      error: failure,
    });
  });
});

describe('runSearchFlow', () => {
  const request: SearchRequest = { query: 'carl', locale: 'da', immediate: false };
  const result = (books: Book[], query: string, locale = 'da'): BookSearchResult => ({ books, query, locale });

  it('returns the chosen book after one search', async () => {
    const search = jest.fn().mockResolvedValue(result([carl], 'carl'));
    const choose = jest.fn().mockResolvedValue(carl);

    await expect(runSearchFlow(request, search, choose)).resolves.toBe(carl);
    expect(search).toHaveBeenCalledWith(request);
    expect(choose).toHaveBeenCalledWith(result([carl], 'carl'));
  });

  it('goes back to the search with the last query and locale, then returns the book chosen next', async () => {
    const back: SearchAgain = searchAgainFor('', 'dungeon crawler carl');
    const search = jest
      .fn()
      .mockResolvedValueOnce(result([flow], 'dungeon crawler carl', 'en'))
      .mockResolvedValueOnce(result([carl], 'dungeon crawler carl', 'en'));
    const choose = jest.fn().mockResolvedValueOnce(back).mockResolvedValueOnce(carl);

    await expect(runSearchFlow(request, search, choose)).resolves.toBe(carl);
    expect(choose).toHaveBeenNthCalledWith(1, result([flow], 'dungeon crawler carl', 'en'));
    // The locale picked in the first search ('en') carries over instead of resetting to 'da'.
    expect(search).toHaveBeenNthCalledWith(2, { query: 'dungeon crawler carl', locale: 'en', immediate: false });
  });

  it('searches the typed text straight away when asked to', async () => {
    const search = jest
      .fn()
      .mockResolvedValueOnce(result([flow], 'flow'))
      .mockResolvedValueOnce(result([carl], 'hyperion'));
    const choose = jest.fn().mockResolvedValueOnce(searchAgainFor('hyperion', 'flow')).mockResolvedValueOnce(carl);

    await expect(runSearchFlow(request, search, choose)).resolves.toBe(carl);
    expect(search).toHaveBeenNthCalledWith(2, { query: 'hyperion', locale: 'da', immediate: true });
  });

  it('passes on a cancellation or an error from either step', async () => {
    const cancelled = jest.fn().mockRejectedValue(new SearchCancelledError());
    await expect(runSearchFlow(request, cancelled, jest.fn())).rejects.toBeInstanceOf(SearchCancelledError);

    const search = jest.fn().mockResolvedValue(result([carl], 'carl'));
    await expect(runSearchFlow(request, search, cancelled)).rejects.toBeInstanceOf(SearchCancelledError);

    const failing = jest.fn().mockRejectedValue(new Error('Request failed'));
    await expect(runSearchFlow(request, failing, jest.fn())).rejects.toThrow('Request failed');
  });
});
