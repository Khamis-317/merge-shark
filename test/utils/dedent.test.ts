import { dedent } from '../../src/utils/dedent.js';
import { describe, expect, it } from 'vitest';

describe('dedent', () => {
  it('dedents a simple multiline string', () => {
    const result = dedent`
    hello
    world
    `;

    expect(result).toBe('hello\nworld');
  });

  it("respects last line's indentation", () => {
    const result = dedent`
    hello
    world
  `;

    expect(result).toBe('  hello\n  world');
  });

  it('requires the first line to be empty', () => {
    expect(() => {
      return dedent`hello
        world
        `;
    }).throws('First line must be empty');
  });

  it('requires the last line to contain spaces only', () => {
    expect(() => {
      return dedent`
        hello
        world`;
    }).throws('Last line must only contain spaces');
  });

  it('only supports spaces', () => {
    expect(() => {
      return dedent`
        hello
        \t`; // last line has a tab
    }).throws('Last line must only contain spaces');
  });

  it('requires the lines to have the same indentation as the last line', () => {
    expect(() => {
      return dedent`
        hello
        world
          `;
    }).throws('Line must start with indentation');
  });

  it('dedents a placeholder in the middle of a line', () => {
    const placeholder = 'foo bar';
    const result = dedent`
      hello ${placeholder}
      world
      `;

    expect(result).toBe('hello foo bar\nworld');
  });

  it('dedents a multiline placeholder at line start', () => {
    const placeholder = 'foo\nbar\nbaz';
    const result = dedent`
      hello
      ${placeholder}
      world
      `;

    expect(result).toBe('hello\nfoo\nbar\nbaz\nworld');
  });

  it('dedents a multiline placeholder in the middle of a line', () => {
    const placeholder = 'foo\nbar\nbaz';
    const result = dedent`
      hello
      interesting ${placeholder}
      world
      `;

    expect(result).toBe('hello\ninteresting foo\nbar\nbaz\nworld');
  });

  it('dedents a multiline placeholder indented at line start', () => {
    const placeholder = 'foo\nbar\nbaz';
    const result = dedent`
      hello
        ${placeholder}
      world
      `;

    expect(result).toBe('hello\n  foo\n  bar\n  baz\nworld');
  });

  it('dedents a multiline placeholder indented in the middle of a line', () => {
    const placeholder = 'foo\nbar\nbaz';
    const result = dedent`
      hello
        interesting ${placeholder}
      world
      `;

    expect(result).toBe('hello\n  interesting foo\nbar\nbaz\nworld');
  });
});
