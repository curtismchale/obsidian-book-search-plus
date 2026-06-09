import { buildRateLimitNoticeFragment } from './rate_limit_notice';

// Faithful polyfill of the Obsidian DOM helpers the production build provides.
// The critical, bug-revealing detail: `createEl` appends the new element to the
// node it is called on. So `activeDocument.createEl('a')` appends to the
// document, which already has a root <html> element — illegal, and jsdom throws
// the same `HierarchyRequestError` users saw in the console. Building on a
// DocumentFragment instead is always safe.
function installObsidianDomHelpers() {
  function createEl(
    this: Node,
    tag: string,
    o?: { text?: string; href?: string; cls?: string | string[]; attr?: Record<string, string> },
  ) {
    const el = document.createElement(tag);
    if (o?.text != null) el.textContent = o.text;
    if (o?.href != null) el.setAttribute('href', o.href);
    if (o?.cls) el.className = Array.isArray(o.cls) ? o.cls.join(' ') : o.cls;
    if (o?.attr) for (const [k, v] of Object.entries(o.attr)) el.setAttribute(k, String(v));
    this.appendChild(el); // appends to the receiver — the heart of the original bug
    return el;
  }
  (Node.prototype as unknown as Record<string, unknown>).createEl = createEl;
  (Node.prototype as unknown as Record<string, unknown>).appendText = function (this: Node, text: string) {
    this.appendChild(document.createTextNode(text));
  };
  (global as unknown as Record<string, unknown>).createFragment = (cb?: (f: DocumentFragment) => void) => {
    const f = document.createDocumentFragment();
    cb?.(f);
    return f;
  };
}

function renderToWrapper(frag: DocumentFragment): HTMLDivElement {
  const wrapper = document.createElement('div');
  wrapper.appendChild(frag);
  return wrapper;
}

describe('buildRateLimitNoticeFragment', () => {
  beforeAll(() => installObsidianDomHelpers());

  it('builds the notice without throwing HierarchyRequestError (regression for #createEl-on-document)', () => {
    expect(() => buildRateLimitNoticeFragment(false)).not.toThrow();
    expect(() => buildRateLimitNoticeFragment(true)).not.toThrow();
  });

  it('links to the API-key docs when no key is configured', () => {
    const wrapper = renderToWrapper(buildRateLimitNoticeFragment(false));
    const link = wrapper.querySelector('a');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toContain('how-to-add-an-api-key');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(wrapper.textContent).toContain('Google Books rate limit reached.');
  });

  it('omits the API-key link and tells the user to wait when a key is configured', () => {
    const wrapper = renderToWrapper(buildRateLimitNoticeFragment(true));
    expect(wrapper.querySelector('a')).toBeNull();
    expect(wrapper.textContent).toContain('Google Books rate limit reached.');
    expect(wrapper.textContent).toContain('Wait a moment and try again.');
  });
});
