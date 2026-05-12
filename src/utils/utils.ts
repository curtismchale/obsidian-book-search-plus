import { Book, FrontMatter } from '@models/book.model';
import { moment } from 'obsidian';
import { DefaultFrontmatterKeyType } from '@settings/settings';

// Obsidian exports moment as a namespace type, but bundles moment.js callable on window.
// This alias gives TypeScript the correct instance type for calling moment() as a function.
type MomentInstance = ReturnType<typeof moment.utc>;

// == Format Syntax == //
export const NUMBER_REGEX = /^-?[0-9]*$/;
export const DATE_REGEX = /{{DATE(\+-?[0-9]+)?}}/;
export const DATE_REGEX_FORMATTED = /{{DATE:([^}\n\r+]*)(\+-?[0-9]+)?}}/;

export function replaceIllegalFileNameCharactersInString(text: string) {
  return text.replace(/[\\#%&{}/*<>$":@.?|]/g, '').replace(/\s+/g, ' ');
}

export function isISBN(str: string) {
  return /^(97(8|9))?\d{9}(\d|X)$/.test(str);
}

export function makeFileName(book: Book, fileNameFormat?: string, extension = 'md') {
  let result: string;
  if (fileNameFormat) {
    result = replaceVariableSyntax(book, replaceDateInString(fileNameFormat));
  } else {
    result = !book.author ? book.title : `${book.title} - ${book.author}`;
  }
  return replaceIllegalFileNameCharactersInString(result) + `.${extension}`;
}

function safeToString(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

export function changeSnakeCase(book: Book): Record<string, unknown> {
  return Object.entries(book).reduce<Record<string, unknown>>((acc, [key, value]) => {
    acc[camelToSnakeCase(key)] = value;
    return acc;
  }, {});
}

export function applyDefaultFrontMatter(
  book: Book,
  frontmatter: FrontMatter | string,
  keyType: DefaultFrontmatterKeyType = DefaultFrontmatterKeyType.snakeCase,
) {
  const frontMater: Record<string, unknown> =
    keyType === DefaultFrontmatterKeyType.camelCase ? { ...book } : changeSnakeCase(book);

  const extraFrontMatter = typeof frontmatter === 'string' ? parseFrontMatter(frontmatter) : frontmatter;
  for (const key in extraFrontMatter) {
    const raw = (extraFrontMatter as Record<string, unknown>)[key];
    const value = raw != null ? safeToString(raw).trim() : '';
    if (frontMater[key] && frontMater[key] !== value) {
      frontMater[key] = `${safeToString(frontMater[key])}, ${value}`;
    } else {
      frontMater[key] = value;
    }
  }

  return frontMater as object;
}

export function replaceVariableSyntax(book: Book, text: string): string {
  if (!text?.trim()) {
    return '';
  }

  const data = book as unknown as Record<string, unknown>;

  const result = text.replace(/{{(?:(\w+):)?(\w+)}}/gi, (_match, modifier: string | undefined, key: string) => {
    const lowerKey = key.toLowerCase();
    // find the matching book property case-insensitively
    const bookKey = Object.keys(data).find(k => k.toLowerCase() === lowerKey);
    if (bookKey === undefined) return '';

    const val = data[bookKey];

    if (!modifier) {
      // original behavior: String() coercion (arrays become comma-joined via Array.prototype.toString)
      return val != null ? (Array.isArray(val) ? val.join(',') : safeToString(val)) : '';
    }

    const mod = modifier.toLowerCase();

    if (mod === 'list') {
      if (!Array.isArray(val)) {
        return val != null ? `\n  - ${safeToString(val)}` : '';
      }
      if (val.length === 0) return '';
      return val.map(item => `\n  - ${safeToString(item)}`).join('');
    }

    if (mod === 'enum') {
      if (!Array.isArray(val)) {
        return val != null ? safeToString(val) : '';
      }
      return val.map(item => safeToString(item)).join(', ');
    }

    if (mod === 'wikilist') {
      if (!Array.isArray(val)) {
        const safe = safeToString(val != null ? val : '').replace(/[\]"[]/g, '');
        return val != null ? `\n  - "[[${safe}]]"` : '';
      }
      if (val.length === 0) return '';
      return val
        .map(item => {
          const safe = safeToString(item).replace(/[\]"[]/g, '');
          return `\n  - "[[${safe}]]"`;
        })
        .join('');
    }

    return '';
  });

  // Trim trailing whitespace but preserve leading newlines produced by list modifiers.
  return result.replace(/\s+$/, '');
}

export function camelToSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

export function parseFrontMatter(frontMatterString: string): Record<string, string> {
  if (!frontMatterString) return {};
  return frontMatterString
    .split('\n')
    .map(item => {
      const index = item.indexOf(':');
      if (index === -1) return [item.trim(), ''] as [string, string];

      const key = item.slice(0, index)?.trim();
      const value = item.slice(index + 1)?.trim();
      return [key, value] as [string, string];
    })
    .reduce<Record<string, string>>((acc, [key, value]) => {
      if (key) {
        acc[key] = value?.trim() ?? '';
      }
      return acc;
    }, {});
}

export function toStringFrontMatter(frontMatter: object): string {
  return Object.entries(frontMatter)
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        if (value.length === 0) return '';
        const items = value
          .filter(item => !/\r|\n/.test(String(item)))
          .map(item => {
            const s = String(item);
            if (/:/.test(s)) {
              return `  - "${s.replace(/"/g, '&quot;')}"`;
            }
            return `  - ${s}`;
          });
        if (items.length === 0) return '';
        return `${key}:\n${items.join('\n')}\n`;
      }

      const newValue = value != null ? String(value).trim() : '';
      if (/\r|\n/.test(newValue)) {
        return '';
      }
      if (/:/.test(newValue)) {
        return `${key}: "${newValue.replace(/"/g, '&quot;')}"\n`;
      }
      return `${key}: ${newValue}\n`;
    })
    .join('')
    .trim();
}

export function getDate(input?: { format?: string; offset?: number }) {
  let duration: ReturnType<typeof moment.duration> | undefined;

  if (input?.offset !== null && input?.offset !== undefined && typeof input.offset === 'number') {
    duration = moment.duration(input.offset, 'days');
  }

  const m = window.moment as unknown as () => MomentInstance;
  return input?.format ? m().add(duration).format(input.format) : m().add(duration).format('YYYY-MM-DD');
}

export function replaceDateInString(input: string) {
  let output: string = input;

  while (DATE_REGEX.test(output)) {
    const dateMatch = DATE_REGEX.exec(output);
    let offset = 0;

    if (dateMatch?.[1]) {
      const offsetString = dateMatch[1].replace('+', '').trim();
      const offsetIsInt = NUMBER_REGEX.test(offsetString);
      if (offsetIsInt) offset = parseInt(offsetString);
    }
    output = replacer(output, DATE_REGEX, getDate({ offset }));
  }

  while (DATE_REGEX_FORMATTED.test(output)) {
    const dateMatch = DATE_REGEX_FORMATTED.exec(output);
    const format = dateMatch?.[1];
    let offset = 0;

    if (dateMatch?.[2]) {
      const offsetString = dateMatch[2].replace('+', '').trim();
      const offsetIsInt = NUMBER_REGEX.test(offsetString);
      if (offsetIsInt) offset = parseInt(offsetString);
    }

    output = replacer(output, DATE_REGEX_FORMATTED, getDate({ format, offset }));
  }

  return output;
}

function replacer(str: string, reg: RegExp, replaceValue: string) {
  return str.replace(reg, function () {
    return replaceValue;
  });
}
