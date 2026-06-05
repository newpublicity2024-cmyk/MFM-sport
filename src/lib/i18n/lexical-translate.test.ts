import { describe, it, expect } from 'vitest';
import {
  extractSegments,
  reinjectSegments,
  setDirection,
  validateReinjection,
  assertFullCoverage,
  buildTranslatedBody,
  ReinjectionMismatchError,
  type LexicalRoot,
} from './lexical-translate';

// Fixture A: heading + paragraph (with a bold span) + an upload image.
function fixtureA(): LexicalRoot {
  return {
    root: {
      type: 'root', format: '', indent: 0, version: 1, direction: 'rtl',
      children: [
        { type: 'heading', tag: 'h2', version: 1, format: '', indent: 0, direction: 'rtl',
          children: [{ type: 'text', version: 1, text: 'الجيش الملكي', format: 0, mode: 'normal', style: '', detail: 0 }] },
        { type: 'paragraph', version: 1, format: '', indent: 0, direction: 'rtl', textFormat: 0, textStyle: '',
          children: [
            { type: 'text', version: 1, text: 'أعلن النادي ', format: 0, mode: 'normal', style: '', detail: 0 },
            { type: 'text', version: 1, text: 'إصابة اللاعب', format: 1, mode: 'normal', style: '', detail: 0 },
          ] },
        { type: 'upload', version: 3, format: '', id: 'a1b2c3d4e5f6a7b8c9d0e1f2', relationTo: 'media', value: 4242, fields: {} },
      ],
    },
  };
}
// Fixture B: paragraph containing a link node (inline element with children).
function fixtureB(): LexicalRoot {
  return {
    root: {
      type: 'root', format: '', indent: 0, version: 1, direction: 'rtl',
      children: [
        { type: 'paragraph', version: 1, format: '', indent: 0, direction: 'rtl', textFormat: 0, textStyle: '',
          children: [
            { type: 'text', version: 1, text: 'اقرأ ', format: 0, mode: 'normal', style: '', detail: 0 },
            { type: 'link', version: 3, format: '', indent: 0, direction: 'rtl', id: 'link-node-id-001',
              fields: { linkType: 'custom', url: 'https://mfmsport.ma/article', newTab: true },
              children: [{ type: 'text', version: 1, text: 'الخبر الكامل', format: 0, mode: 'normal', style: '', detail: 0 }] },
          ] },
      ],
    },
  };
}
// Fixture C: nested list + whitespace/empty text + linebreak + a paragraph with NO direction key.
function fixtureC(): LexicalRoot {
  return {
    root: {
      type: 'root', format: '', indent: 0, version: 1, direction: 'rtl',
      children: [
        { type: 'list', listType: 'bullet', start: 1, tag: 'ul', version: 1, format: '', indent: 0, direction: 'rtl',
          children: [
            { type: 'listitem', value: 1, version: 1, format: '', indent: 0, direction: 'rtl',
              children: [
                { type: 'text', version: 1, text: 'العنصر الأول', format: 0, mode: 'normal', style: '', detail: 0 },
                { type: 'text', version: 1, text: '   ', format: 0, mode: 'normal', style: '', detail: 0 },
                { type: 'list', listType: 'bullet', start: 1, tag: 'ul', version: 1, format: '', indent: 1, direction: 'rtl',
                  children: [
                    { type: 'listitem', value: 1, version: 1, format: '', indent: 1, direction: 'rtl',
                      children: [{ type: 'text', version: 1, text: 'عنصر متداخل', format: 0, mode: 'normal', style: '', detail: 0 }] },
                  ] },
              ] },
          ] },
        { type: 'paragraph', version: 1, format: '', indent: 0,
          children: [
            { type: 'linebreak', version: 1 },
            { type: 'text', version: 1, text: '', format: 0, mode: 'normal', style: '', detail: 0 },
          ] },
      ],
    },
  };
}

describe('extractSegments', () => {
  it('extracts heading + both paragraph spans in order with path ids; upload yields none', () => {
    expect(extractSegments(fixtureA())).toEqual([
      { id: '0.0', text: 'الجيش الملكي' },
      { id: '1.0', text: 'أعلن النادي ' },
      { id: '1.1', text: 'إصابة اللاعب' },
    ]);
  });
  it('reaches text inside a link via normal recursion', () => {
    expect(extractSegments(fixtureB())).toEqual([
      { id: '0.0', text: 'اقرأ ' },
      { id: '0.1.0', text: 'الخبر الكامل' },
    ]);
  });
  it('treats an autolink (has BOTH text and children) as an element, not a leaf', () => {
    const body: LexicalRoot = {
      root: {
        type: 'root', format: '', indent: 0, version: 1, direction: 'ltr',
        children: [
          { type: 'paragraph', version: 1, format: '', indent: 0, direction: 'ltr',
            children: [
              { type: 'autolink', version: 1, text: 'https://mfmsport.ma', format: 0, direction: 'ltr',
                fields: { linkType: 'custom', url: 'https://mfmsport.ma' },
                children: [{ type: 'text', version: 1, text: 'https://mfmsport.ma', format: 0, mode: 'normal', style: '', detail: 0 }] },
            ] },
        ],
      },
    };
    // The autolink wrapper (0.0) must NOT be a segment; only its inner text child (0.0.0) is.
    expect(extractSegments(body)).toEqual([{ id: '0.0.0', text: 'https://mfmsport.ma' }]);
  });
  it('skips empty/whitespace-only text; handles nested lists', () => {
    expect(extractSegments(fixtureC())).toEqual([
      { id: '0.0.0', text: 'العنصر الأول' },
      { id: '0.0.2.0.0', text: 'عنصر متداخل' },
    ]);
  });
  it('returns [] for a degenerate body', () => {
    expect(extractSegments({ root: { type: 'root', children: [], direction: 'ltr', format: '', indent: 0, version: 1 } })).toEqual([]);
  });
});

describe('reinjectSegments', () => {
  it('replaces text by id, preserves bold bitmask + upload value, non-mutating', () => {
    const original = fixtureA();
    const snapshot = JSON.stringify(original);
    const out = reinjectSegments(original, { '0.0': 'Royal Army', '1.0': 'The club announced ', '1.1': 'the player injury' });
    expect(JSON.stringify(original)).toBe(snapshot);
    expect(out.root.children[1].children![1].format).toBe(1);
    expect(out.root.children[2]).toEqual({ type: 'upload', version: 3, format: '', id: 'a1b2c3d4e5f6a7b8c9d0e1f2', relationTo: 'media', value: 4242, fields: {} });
  });
  it('preserves link url/fields/id while translating link text', () => {
    const out = reinjectSegments(fixtureB(), { '0.0': 'Read ', '0.1.0': 'the full story' });
    const link = out.root.children[0].children![1];
    expect(link.fields).toEqual({ linkType: 'custom', url: 'https://mfmsport.ma/article', newTab: true });
    expect(link.children![0].text).toBe('the full story');
  });
  it('keeps original text for ids missing from the map', () => {
    const out = reinjectSegments(fixtureA(), { '0.0': 'Royal Army' });
    expect(out.root.children[1].children![0].text).toBe('أعلن النادي ');
  });
});

describe('setDirection', () => {
  it('flips root and nodes that HAVE direction, without inventing the field', () => {
    const out = setDirection(fixtureC(), 'ltr');
    expect(out.root.direction).toBe('ltr');
    expect(out.root.children[0].direction).toBe('ltr');
    expect(Object.prototype.hasOwnProperty.call(out.root.children[1], 'direction')).toBe(false);
  });
  it('leaves upload value untouched when flipping', () => {
    expect(setDirection(fixtureA(), 'ltr').root.children[2].value).toBe(4242);
  });
});

describe('validateReinjection', () => {
  it('passes for a correct reinjection', () => {
    const o = fixtureA();
    expect(() => validateReinjection(o, reinjectSegments(o, { '0.0': 'a', '1.0': 'b', '1.1': 'c' }))).not.toThrow();
  });
  it('throws when structure changes', () => {
    const o = fixtureA(); const broken = reinjectSegments(o, {}); broken.root.children.pop();
    expect(() => validateReinjection(o, broken)).toThrow(ReinjectionMismatchError);
  });
});

describe('assertFullCoverage', () => {
  it('throws when incomplete', () => { expect(() => assertFullCoverage(fixtureA(), { '0.0': 'x' })).toThrow(/missing 2 segment/); });
  it('throws on stray ids', () => { expect(() => assertFullCoverage(fixtureA(), { '0.0': 'a', '1.0': 'b', '1.1': 'c', '9.9': 'ghost' })).toThrow(/unknown segment id/); });
  it('passes on exact coverage', () => { expect(() => assertFullCoverage(fixtureA(), { '0.0': 'a', '1.0': 'b', '1.1': 'c' })).not.toThrow(); });
});

describe('buildTranslatedBody', () => {
  it('reinjects, validates, flips to ltr in one call', () => {
    const out = buildTranslatedBody(fixtureA(), { '0.0': 'Royal Army', '1.0': 'The club announced ', '1.1': 'the player injury' }, 'ltr');
    expect(out.root.direction).toBe('ltr');
    expect(out.root.children[2].value).toBe(4242);
  });
});
