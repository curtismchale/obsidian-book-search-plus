import { Book } from '@models/book.model';
import { executeInlineScriptsTemplates } from './template';

const book: Book = {
  title: 'Cosmos',
  author: 'Carl Sagan',
  authors: ['Carl Sagan'],
  isbn10: '0394502949',
  isbn13: '9780394502946',
  publisher: 'Random House',
  publishDate: '1980',
  totalPage: 365,
  coverUrl: '',
  coverSmallUrl: '',
  description: '',
  link: '',
  previewLink: '',
  category: 'Science',
  categories: ['Science'],
  subtitle: '',
};

describe('executeInlineScriptsTemplates', () => {
  it('evaluates a single inline script', () => {
    const result = executeInlineScriptsTemplates(book, '<%= book.title %>');
    expect(result).toBe('Cosmos');
  });

  it('evaluates multiple inline scripts on separate lines', () => {
    const template = '<%= book.title %>\n<%= book.author %>';
    const result = executeInlineScriptsTemplates(book, template);
    expect(result).toBe('Cosmos\nCarl Sagan');
  });

  it('evaluates multiple inline scripts on the same line', () => {
    const template = '<%= book.isbn10 %> and <%= book.isbn13 %>';
    const result = executeInlineScriptsTemplates(book, template);
    expect(result).toBe('0394502949 and 9780394502946');
  });

  it('replaces all occurrences of the same inline script', () => {
    const template = '<%= book.title %> - <%= book.title %>';
    const result = executeInlineScriptsTemplates(book, template);
    expect(result).toBe('Cosmos - Cosmos');
  });

  it('handles inline script with fallback for missing field', () => {
    const template = '<%= book.isbn10 || "" %> and <%= book.isbn13 || "" %>';
    const result = executeInlineScriptsTemplates(book, template);
    expect(result).toBe('0394502949 and 9780394502946');
  });

  it('handles inline script with fallback when field is empty', () => {
    const bookWithoutIsbn = { ...book, isbn10: '', isbn13: '' };
    const template = '<%= book.isbn10 || "N/A" %> and <%= book.isbn13 || "N/A" %>';
    const result = executeInlineScriptsTemplates(bookWithoutIsbn, template);
    expect(result).toBe('N/A and N/A');
  });

  it('returns text unchanged when no inline scripts present', () => {
    const template = 'title: {{title}}';
    const result = executeInlineScriptsTemplates(book, template);
    expect(result).toBe('title: {{title}}');
  });
});
