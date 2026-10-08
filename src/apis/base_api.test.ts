// `import type` so this stays a type-only, erased import — settings.ts pulls
// in SettingServiceProviderModal, which extends obsidian's `Modal`. The
// `jest.mock('obsidian', ...)` below replaces the whole module with just
// `requestUrl`, so actually loading settings.ts here would crash with
// "Class extends value undefined is not a constructor".
import type { BookSearchPluginSettings } from '@settings/settings';
import { ServiceProvider } from '@src/constants';
import { apiGet, factoryServiceProvider } from './base_api';
import { GoogleBooksApi } from './google_books_api';
import { NaverBooksApi } from './naver_books_api';

// Mock the obsidian module so we can control requestUrl behaviour
const mockRequestUrl = jest.fn();
jest.mock('obsidian', () => ({
  requestUrl: (...args: unknown[]) => mockRequestUrl(...args),
}));

// Fake a successful response
const successResponse = { json: { totalItems: 1, items: [] } };

// Fake a 503 error matching Obsidian's thrown error shape
const make503 = () => Object.assign(new Error('Request failed, status 503'), { status: 503 });

// Fake a 429 error matching Obsidian's thrown error shape
const make429 = () => Object.assign(new Error('Request failed, status 429'), { status: 429 });

describe('apiGet retry logic', () => {
  beforeEach(() => {
    mockRequestUrl.mockReset();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns immediately on success', async () => {
    mockRequestUrl.mockResolvedValue(successResponse);
    const result = await apiGet('https://example.com');
    expect(result).toEqual(successResponse.json);
    expect(mockRequestUrl).toHaveBeenCalledTimes(1);
  });

  it('retries on 503 and succeeds on second attempt', async () => {
    mockRequestUrl.mockRejectedValueOnce(make503()).mockResolvedValue(successResponse);

    const promise = apiGet('https://example.com');
    await jest.runAllTimersAsync();
    const result = await promise;

    expect(result).toEqual(successResponse.json);
    expect(mockRequestUrl).toHaveBeenCalledTimes(2);
  });

  it('retries up to 4 times on repeated 503s then throws', async () => {
    mockRequestUrl.mockRejectedValue(make503());

    const promise = apiGet('https://example.com');
    const assertion = expect(promise).rejects.toMatchObject({ status: 503 });
    await jest.runAllTimersAsync();
    await assertion;

    expect(mockRequestUrl).toHaveBeenCalledTimes(4);
  });

  it('does not retry on non-503/non-429 errors', async () => {
    const err = Object.assign(new Error('Request failed, status 401'), { status: 401 });
    mockRequestUrl.mockRejectedValue(err);

    await expect(apiGet('https://example.com')).rejects.toMatchObject({ status: 401 });
    expect(mockRequestUrl).toHaveBeenCalledTimes(1);
  });

  it('does not retry on 429 — surfaces the rate limit immediately instead of freezing', async () => {
    mockRequestUrl.mockRejectedValue(make429());

    await expect(apiGet('https://example.com')).rejects.toMatchObject({ status: 429 });
    expect(mockRequestUrl).toHaveBeenCalledTimes(1);
  });

  it('rejects with a timeout instead of hanging forever when the request never settles', async () => {
    // Obsidian's requestUrl has no built-in timeout; a stalled connection would
    // otherwise leave the search modal stuck on "Requesting..." indefinitely.
    mockRequestUrl.mockReturnValue(new Promise(() => {}) as ReturnType<typeof mockRequestUrl>);

    const promise = apiGet('https://example.com');
    const assertion = expect(promise).rejects.toMatchObject({ timeout: true });
    await jest.advanceTimersByTimeAsync(15000);
    await assertion;

    expect(mockRequestUrl).toHaveBeenCalledTimes(1);
  });

  it('succeeds on fourth attempt after three 503s', async () => {
    mockRequestUrl
      .mockRejectedValueOnce(make503())
      .mockRejectedValueOnce(make503())
      .mockRejectedValueOnce(make503())
      .mockResolvedValue(successResponse);

    const promise = apiGet('https://example.com');
    await jest.runAllTimersAsync();
    const result = await promise;

    expect(result).toEqual(successResponse.json);
    expect(mockRequestUrl).toHaveBeenCalledTimes(4);
  });
});

// Minimal settings fixture built by hand (rather than importing
// DEFAULT_SETTINGS) to keep settings.ts — and the obsidian `Modal` subclass
// it pulls in — out of this test file's runtime import graph. `localePreference`
// is set to a concrete locale rather than 'default' so `buildSearchParams`
// doesn't call the (mocked-away) `moment.locale()`.
function makeSettings(overrides: Partial<BookSearchPluginSettings>): BookSearchPluginSettings {
  return {
    folder: '',
    fileNameFormat: '',
    frontmatter: '',
    content: '',
    useDefaultFrontmatter: true,
    defaultFrontmatterKeyType: 'Camel Case' as BookSearchPluginSettings['defaultFrontmatterKeyType'],
    templateFile: '',
    serviceProvider: ServiceProvider.google,
    naverClientId: '',
    naverClientSecretName: '',
    localePreference: 'en',
    googleApiKeySecret: '',
    openPageOnCompletion: true,
    showCoverImageInSearch: false,
    enableCoverImageSave: false,
    enableCoverImageEdgeCurl: true,
    coverImagePath: '',
    askForLocale: true,
    legacySecretsRemoved: false,
    ...overrides,
  };
}

describe('factoryServiceProvider', () => {
  it('passes the resolved Google API key through to GoogleBooksApi', () => {
    const settings = makeSettings({ serviceProvider: ServiceProvider.google });
    const provider = factoryServiceProvider(settings, { googleApiKey: 'resolved-key' }) as GoogleBooksApi;
    expect(provider).toBeInstanceOf(GoogleBooksApi);
    expect(provider.buildSearchParams('flow')['key']).toBe('resolved-key');
  });

  it('omits the key param when no Google API key resolves', () => {
    const settings = makeSettings({ serviceProvider: ServiceProvider.google });
    const provider = factoryServiceProvider(settings) as GoogleBooksApi;
    expect(provider.buildSearchParams('flow')['key']).toBeUndefined();
  });

  it('passes the resolved Naver client secret through to NaverBooksApi', () => {
    const settings = makeSettings({ serviceProvider: ServiceProvider.naver, naverClientId: 'client-id' });
    const provider = factoryServiceProvider(settings, { naverClientSecret: 'resolved-secret' });
    expect(provider).toBeInstanceOf(NaverBooksApi);
  });

  it('throws when the Naver client secret does not resolve, even if a client id is set', () => {
    const settings = makeSettings({ serviceProvider: ServiceProvider.naver, naverClientId: 'client-id' });
    expect(() => factoryServiceProvider(settings)).toThrow();
  });

  it('throws when the Naver client secret resolves but the client id is missing', () => {
    const settings = makeSettings({ serviceProvider: ServiceProvider.naver, naverClientId: '' });
    expect(() => factoryServiceProvider(settings, { naverClientSecret: 'resolved-secret' })).toThrow();
  });
});
