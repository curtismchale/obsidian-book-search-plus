const API_KEY_DOCS_URL =
  'https://github.com/curtismchale/obsidian-book-search-plus#how-to-add-an-api-key-to-bypass-rate-limits';

/**
 * Build the DocumentFragment shown in a Notice when Google Books returns HTTP 429.
 *
 * The anchor is created with `fragment.createEl(...)` so it is appended to the
 * fragment. Calling `createEl` on `activeDocument` (as an earlier lint-driven
 * change did) appends to the document, which already has a root <html> element,
 * throwing `HierarchyRequestError: Only one element on document allowed` and
 * crashing every rate-limited search.
 */
export function buildRateLimitNoticeFragment(hasApiKey: boolean): DocumentFragment {
  return createFragment(fragment => {
    fragment.appendText('Google Books rate limit reached. ');
    if (hasApiKey) {
      fragment.appendText('Wait a moment and try again.');
      return;
    }
    fragment.createEl('a', {
      text: 'Add a Google books API key',
      href: API_KEY_DOCS_URL,
      attr: { target: '_blank', rel: 'noopener noreferrer' },
    });
    fragment.appendText(' for a higher quota, or wait a moment and try again.');
  });
}
