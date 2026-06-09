import { Book } from '@models/book.model';
import { BookSearchPluginSettings } from '@settings/settings';
import { ServiceProvider } from '@src/constants';
import { requestUrl } from 'obsidian';
import { GoogleBooksApi } from './google_books_api';
import { NaverBooksApi } from './naver_books_api';

export interface BaseBooksApiImpl {
  getByQuery(query: string, options?: Record<string, string>): Promise<Book[]>;
}

class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export function factoryServiceProvider(settings: BookSearchPluginSettings): BaseBooksApiImpl {
  switch (settings.serviceProvider) {
    case ServiceProvider.google:
      return new GoogleBooksApi(settings.localePreference, settings.enableCoverImageEdgeCurl, settings.apiKey);
    case ServiceProvider.naver:
      validateNaverSettings(settings);
      return new NaverBooksApi(settings.naverClientId, settings.naverClientSecret);
    default:
      throw new Error('Unsupported service provider.');
  }
}

function validateNaverSettings(settings: BookSearchPluginSettings): void {
  if (!settings.naverClientId || !settings.naverClientSecret) {
    throw new ConfigurationError('네이버 개발자센터에서 "Client ID"와 "Client Secret"를 발급받아 설정해주세요.');
  }
}

// Obsidian's requestUrl has no built-in timeout, so a stalled connection would
// hang the search modal on "Requesting..." forever. Bound every attempt.
const REQUEST_TIMEOUT_MS = 15000;

function requestWithTimeout(options: Parameters<typeof requestUrl>[0], ms: number) {
  let timeoutId: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = activeWindow.setTimeout(
      () => reject(Object.assign(new Error(`Request timed out after ${ms} ms`), { timeout: true })),
      ms,
    );
  });
  return Promise.race([requestUrl(options), timeout]).finally(() => activeWindow.clearTimeout(timeoutId));
}

export async function apiGet<T>(
  url: string,
  params: Record<string, string | number> = {},
  headers?: Record<string, string>,
): Promise<T> {
  const apiURL = new URL(url);
  appendQueryParams(apiURL, params);

  const requestOptions = {
    url: apiURL.href,
    method: 'GET',
    headers: {
      Accept: '*/*',
      'Content-Type': 'application/json; charset=utf-8',
      ...headers,
    },
  };

  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await requestWithTimeout(requestOptions, REQUEST_TIMEOUT_MS);
      return res.json as T;
    } catch (error) {
      lastError = error;
      const status = (error as { status?: number }).status;
      const message = error instanceof Error ? error.message : '';
      // Retry only transient server errors (503). A 429 is a quota/rate limit
      // that will not clear within a few seconds, so retrying just freezes the
      // modal — surface it immediately so the user sees the rate-limit notice.
      const isRetryable = status === 503 || message.includes('503');
      if (attempt < 3 && isRetryable) {
        await new Promise(resolve => activeWindow.setTimeout(resolve, 1000 * Math.pow(2, attempt)));
      } else {
        throw error;
      }
    }
  }
  throw lastError;
}

function appendQueryParams(url: URL, params: Record<string, string | number>): void {
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value.toString());
  });
}
