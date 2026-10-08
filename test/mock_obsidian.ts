import * as obsidian from 'obsidian';

// Set up Obsidian globals for test environment
(global as unknown as Record<string, unknown>)['activeWindow'] = window;
(global as unknown as Record<string, unknown>)['activeDocument'] = document;

export const requestUrl: typeof obsidian.requestUrl = (request: string | obsidian.RequestUrlParam) => {
  return fetch(request as string).then(res => res.json()) as obsidian.RequestUrlResponsePromise;
};

// Export moment so test files that import from 'obsidian' get a working moment
export { moment } from 'obsidian';

// In-memory stand-in for Obsidian's `app.secretStorage`. Real ids are
// "lowercase alphanumeric with dashes"; invalid ids throw, matching the real
// API's documented behaviour. `setForceThrow` lets a test simulate the
// Keychain itself failing (e.g. OS-level denial) regardless of id validity.
export class SecretStorage {
  private readonly secrets = new Map<string, string>();
  private forceThrow = false;

  setForceThrow(force: boolean): void {
    this.forceThrow = force;
  }

  setSecret(id: string, secret: string): void {
    if (this.forceThrow) throw new Error('Forced setSecret failure');
    if (!/^[a-z0-9-]+$/.test(id)) throw new Error(`Invalid secret id: ${id}`);
    this.secrets.set(id, secret);
  }

  getSecret(id: string): string | null {
    return this.secrets.get(id) ?? null;
  }

  listSecrets(): string[] {
    return Array.from(this.secrets.keys());
  }
}

// Stub for Obsidian's `SecretComponent`. It only needs to round-trip the
// value a test sets/reads and record the `onChange` handler so a test can
// simulate the user picking or creating a secret.
export class SecretComponent {
  private value = '';
  private changeHandler: (value: string) => unknown = () => undefined;

  constructor(_app: unknown, _containerEl: HTMLElement) {}

  setValue(value: string): this {
    this.value = value;
    return this;
  }

  getValue(): string {
    return this.value;
  }

  onChange(cb: (value: string) => unknown): this {
    this.changeHandler = cb;
    return this;
  }

  triggerChange(value: string): void {
    this.value = value;
    void this.changeHandler(value);
  }
}

// Minimal mock `App` carrying the pieces the secret-migration flow depends
// on: a per-instance `secretStorage` and vault-scoped, device-local
// `loadLocalStorage`/`saveLocalStorage`.
export class App {
  secretStorage = new SecretStorage();
  private readonly localStorageData = new Map<string, unknown>();

  loadLocalStorage(key: string): unknown {
    return this.localStorageData.get(key) ?? null;
  }

  saveLocalStorage(key: string, data: unknown): void {
    if (data === null) {
      this.localStorageData.delete(key);
    } else {
      this.localStorageData.set(key, data);
    }
  }
}
