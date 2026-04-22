import * as obsidian from 'obsidian';

// Set up Obsidian globals for test environment
(global as unknown as Record<string, unknown>)['activeWindow'] = window;
(global as unknown as Record<string, unknown>)['activeDocument'] = document;

export const requestUrl: typeof obsidian.requestUrl = (request: string | obsidian.RequestUrlParam) => {
  return fetch(request as string).then(res => res.json()) as obsidian.RequestUrlResponsePromise;
};

// Export moment so test files that import from 'obsidian' get a working moment
export { moment } from 'obsidian';
