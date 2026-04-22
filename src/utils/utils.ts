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
  const frontMater: Record<string, unknown> = keyType === DefaultFrontmatterKeyType.camelCase ? { ...book } : changeSnakeCase(book);

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

  const entries = Object.entries(book);

  return entries
    .reduce((result, [key, val]) => {
      const strVal = val != null ? String(val) : '';
      return result.replace(new RegExp(`{{${key}}}`, 'ig'), strVal);
    }, text)
    .replace(/{{\w+}}/gi, '')
    .trim();
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
      const newValue = value != null ? String(value).trim() : '';
      if (/\r|\n/.test(newValue)) {
        return '';
      }
      if (/:\s/.test(newValue)) {
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

  // eslint-disable-next-line obsidianmd/prefer-active-doc -- Obsidian sets moment.js callable on window; activeWindow.moment is not typed as callable
  const m = window.moment as unknown as () => MomentInstance;
  return input?.format
    ? m().add(duration).format(input.format)
    : m().add(duration).format('YYYY-MM-DD');
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
