import { apiGet } from './base_api';

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
    mockRequestUrl
      .mockRejectedValueOnce(make503())
      .mockResolvedValue(successResponse);

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

  it('retries on 429 and succeeds on second attempt', async () => {
    mockRequestUrl
      .mockRejectedValueOnce(make429())
      .mockResolvedValue(successResponse);

    const promise = apiGet('https://example.com');
    await jest.runAllTimersAsync();
    const result = await promise;

    expect(result).toEqual(successResponse.json);
    expect(mockRequestUrl).toHaveBeenCalledTimes(2);
  });

  it('retries up to 4 times on repeated 429s then throws', async () => {
    mockRequestUrl.mockRejectedValue(make429());

    const promise = apiGet('https://example.com');
    const assertion = expect(promise).rejects.toMatchObject({ status: 429 });
    await jest.runAllTimersAsync();
    await assertion;

    expect(mockRequestUrl).toHaveBeenCalledTimes(4);
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
