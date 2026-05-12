import { Book } from '@models/book.model';
import * as utils from './utils';

jest.mock('@settings/settings', () => jest.fn());

describe('util.js', () => {
  const book: Book = {
    title: '코스모스',
    author: '칼 세이건',
    authors: ['칼 세이건'],
  };

  it('replaceIllegalFileNameCharactersInString 1', () => {
    expect(utils.replaceIllegalFileNameCharactersInString('재레드 다이아몬드의 <대변동 : 위기, 선택, 변화>')).toBe(
      '재레드 다이아몬드의 대변동 위기, 선택, 변화',
    );
  });

  it('replaceIllegalFileNameCharactersInString preserves commas', () => {
    expect(utils.replaceIllegalFileNameCharactersInString('McHale, Curtis')).toBe('McHale, Curtis');
  });

  it('replaceIllegalFileNameCharactersInString 2', () => {
    expect(utils.replaceIllegalFileNameCharactersInString('2022 고시넷 초록이 NCS 모듈형 1 | 통합기본서(2판)')).toBe(
      '2022 고시넷 초록이 NCS 모듈형 1 통합기본서(2판)',
    );
  });

  it('makeFileName 1', () => {
    expect(utils.makeFileName(book)).toBe('코스모스 - 칼 세이건.md');
  });

  it('makeFileName 2', () => {
    const newBook = {
      ...book,
      author: '',
    };
    expect(utils.makeFileName(newBook)).toBe('코스모스.md');
  });

  it('makeFileName 3', () => {
    expect(utils.makeFileName(book, '{{author}}-{{title}}')).toBe('칼 세이건-코스모스.md');
  });

  it('makeFileName 4', () => {
    expect(utils.makeFileName(book, '{{author}}-{{title}}')).toBe('칼 세이건-코스모스.md');
  });

  it('makeFileName 5', () => {
    const newBook = {
      ...book,
      title: '코스모스 : 창백한 푸른점',
    };
    expect(utils.makeFileName(newBook, '{{title}} - {{author}}')).toBe('코스모스 창백한 푸른점 - 칼 세이건.md');
  });

  it('makeFileName preserves comma in format string', () => {
    expect(utils.makeFileName(book, '{{author}}, {{title}}')).toBe('칼 세이건, 코스모스.md');
  });

  describe('toStringFrontMatter', () => {
    it('quotes values containing a colon followed by a space', () => {
      const result = utils.toStringFrontMatter({ title: 'Thinking, Fast and Slow: A Guide' });
      expect(result).toBe('title: "Thinking, Fast and Slow: A Guide"');
    });

    it('quotes values containing a colon with no trailing space', () => {
      const result = utils.toStringFrontMatter({ title: 'Cosmos:A Personal Voyage' });
      expect(result).toBe('title: "Cosmos:A Personal Voyage"');
    });

    it('leaves plain values unquoted', () => {
      const result = utils.toStringFrontMatter({ title: 'Cosmos' });
      expect(result).toBe('title: Cosmos');
    });

    it('escapes double quotes inside quoted values', () => {
      const result = utils.toStringFrontMatter({ title: 'A "Great" Title: Subtitle' });
      expect(result).toBe('title: "A &quot;Great&quot; Title: Subtitle"');
    });

    it('drops values that contain newlines', () => {
      const result = utils.toStringFrontMatter({ title: 'Line one\nLine two' });
      expect(result).toBe('');
    });

    it('serializes an array of two values as a YAML block list', () => {
      const result = utils.toStringFrontMatter({ authors: ['A', 'B'] });
      expect(result).toBe('authors:\n  - A\n  - B');
    });

    it('serializes a single-element array as a YAML block list', () => {
      const result = utils.toStringFrontMatter({ authors: ['A'] });
      expect(result).toBe('authors:\n  - A');
    });

    it('drops the key entirely for an empty array', () => {
      const result = utils.toStringFrontMatter({ authors: [] });
      expect(result).toBe('');
    });

    it('quotes array items containing a colon', () => {
      const result = utils.toStringFrontMatter({ authors: ['Carl: Master', 'B'] });
      expect(result).toBe('authors:\n  - "Carl: Master"\n  - B');
    });
  });

  describe('replaceVariableSyntax modifiers', () => {
    const multiBook = {
      ...book,
      authors: ['Carl Sagan', 'Ann Druyan'],
    };

    it('{{list:authors}} with two authors emits a YAML block list', () => {
      const result = utils.replaceVariableSyntax(multiBook, '{{list:authors}}');
      expect(result).toBe('\n  - Carl Sagan\n  - Ann Druyan');
    });

    it('{{list:authors}} with single-item array emits one list entry', () => {
      const result = utils.replaceVariableSyntax(book, '{{list:authors}}');
      expect(result).toBe('\n  - 칼 세이건');
    });

    it('{{list:authors}} with empty array emits empty string', () => {
      const emptyBook = { ...book, authors: [] };
      const result = utils.replaceVariableSyntax(emptyBook, '{{list:authors}}');
      expect(result).toBe('');
    });

    it('{{enum:authors}} with two authors emits comma-joined string', () => {
      const result = utils.replaceVariableSyntax(multiBook, '{{enum:authors}}');
      expect(result).toBe('Carl Sagan, Ann Druyan');
    });

    it('{{wikilist:authors}} with two authors emits wikilinked block list', () => {
      const result = utils.replaceVariableSyntax(multiBook, '{{wikilist:authors}}');
      expect(result).toBe('\n  - "[[Carl Sagan]]"\n  - "[[Ann Druyan]]"');
    });

    it('{{wikilist:authors}} strips brackets from item content', () => {
      const bracketBook = { ...book, authors: ['A]B'] };
      const result = utils.replaceVariableSyntax(bracketBook, '{{wikilist:authors}}');
      expect(result).toBe('\n  - "[[AB]]"');
    });

    it('{{LIST:authors}} (uppercase) works identically to {{list:authors}}', () => {
      const result = utils.replaceVariableSyntax(multiBook, '{{LIST:authors}}');
      expect(result).toBe('\n  - Carl Sagan\n  - Ann Druyan');
    });

    it('plain {{author}} (no modifier, scalar) still works', () => {
      const result = utils.replaceVariableSyntax(book, '{{author}}');
      expect(result).toBe('칼 세이건');
    });

    it('plain {{authors}} (no modifier, array) keeps current String() coercion behavior', () => {
      const result = utils.replaceVariableSyntax(multiBook, '{{authors}}');
      expect(result).toBe('Carl Sagan,Ann Druyan');
    });
  });
});
