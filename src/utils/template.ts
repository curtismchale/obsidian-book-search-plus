import { Book } from '@models/book.model';
import { App, moment, normalizePath, Notice, TFile } from 'obsidian';

// Obsidian exports moment as a namespace type, but bundles moment.js callable on window.
// This alias gives TypeScript the correct instance type for calling moment() as a function.
type MomentInstance = ReturnType<typeof moment.utc>;

export async function getTemplateContents(app: App, templatePath: string | undefined): Promise<string> {
  const { metadataCache, vault } = app;
  const normalizedTemplatePath = normalizePath(templatePath ?? '');
  if (templatePath === '/') {
    return Promise.resolve('');
  }

  try {
    const templateFile = metadataCache.getFirstLinkpathDest(normalizedTemplatePath, '');
    return templateFile ? vault.cachedRead(templateFile) : '';
  } catch (err) {
    console.error(`Failed to read the daily note template '${normalizedTemplatePath}'`, err);
    new Notice('Failed to read the daily note template');
    return '';
  }
}

export function applyTemplateTransformations(rawTemplateContents: string): string {
  return rawTemplateContents.replace(
    /{{\s*(date|time)\s*(([+-]\d+)([yqmwdhs]))?\s*(:.+?)?}}/gi,
    (_, _timeOrDate: string, calc: string | undefined, timeDelta: string, unit: string, momentFormat: string | undefined) => {
      // eslint-disable-next-line obsidianmd/prefer-active-doc -- Obsidian sets moment.js callable on window; activeWindow.moment is not typed as callable
      const m = window.moment as unknown as () => MomentInstance;
      const now = m();
      const currentDate = m().clone().set({
        hour: now.get('hour'),
        minute: now.get('minute'),
        second: now.get('second'),
      });
      if (calc) {
        currentDate.add(parseInt(timeDelta, 10), unit as unknown as moment.unitOfTime.DurationConstructor);
      }

      if (momentFormat) {
        return currentDate.format(momentFormat.substring(1).trim());
      }
      return currentDate.format('YYYY-MM-DD');
    },
  );
}

function safeToString(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

function evaluateBookExpression(book: Book, script: string): string {
  const trimmed = script.trim();
  const bookRecord = book as unknown as Record<string, unknown>;

  // book.prop || "fallback" or book.prop || 'fallback'
  const orStringMatch = trimmed.match(/^book\.(\w+)\s*\|\|\s*(?:"([^"]*)"|'([^']*)')$/);
  if (orStringMatch) {
    const value = bookRecord[orStringMatch[1]];
    const fallback = orStringMatch[2] ?? orStringMatch[3] ?? '';
    return value ? safeToString(value) : fallback;
  }

  // book.prop || book.otherProp
  const orPropMatch = trimmed.match(/^book\.(\w+)\s*\|\|\s*book\.(\w+)$/);
  if (orPropMatch) {
    const value1 = bookRecord[orPropMatch[1]];
    const value2 = bookRecord[orPropMatch[2]];
    return value1 ? safeToString(value1) : safeToString(value2);
  }

  // book.prop
  const propMatch = trimmed.match(/^book\.(\w+)$/);
  if (propMatch) {
    return safeToString(bookRecord[propMatch[1]]);
  }

  console.warn(`Unsupported inline script expression: ${trimmed}`);
  return '';
}

export function executeInlineScriptsTemplates(book: Book, text: string) {
  return text.replace(/<%=\s*(.+?)\s*%>/g, (_match, script: string) => {
    try {
      return evaluateBookExpression(book, script);
    } catch (err) {
      console.warn(err);
      return _match;
    }
  });
}

interface AppWithTemplater {
  plugins: {
    plugins: Record<
      string,
      | {
          settings: Record<string, unknown>;
          templater: { overwrite_file_commands: (file: TFile) => Promise<void> };
        }
      | undefined
    >;
  };
}

export async function useTemplaterPluginInFile(app: App, file: TFile) {
  const appWithPlugins = app as unknown as AppWithTemplater;
  const templater = appWithPlugins.plugins.plugins['templater-obsidian'];
  if (templater && !templater.settings['trigger_on_file_creation']) {
    await templater.templater.overwrite_file_commands(file);
  }
}
