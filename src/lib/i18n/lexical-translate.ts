/**
 * Lexical Body Translation Engine — extract -> (offline translate) -> reinject
 * for the localized `body` field of Articles.
 *  - Structure-preserving: only text-node `.text` is translated; all other fields
 *    (format bitmask, style, link url/fields, upload value/relationTo/id, ...) pass through.
 *  - Image-safe: upload nodes carry the Payload media id in `.value` (shared across
 *    locales) — never altered.
 *  - Deterministic path ids so reinjection is unambiguous.
 *  - Fail-closed: validators throw if a translation would change structure.
 * Out of scope: image `alt` (stored on the Media doc, shared across locales).
 */
export interface LexicalNode {
  type: string;
  version?: number;
  children?: LexicalNode[];
  direction?: 'ltr' | 'rtl' | null;
  text?: string;
  format?: number | string;
  mode?: string;
  style?: string;
  detail?: number;
  [k: string]: unknown;
}
export interface LexicalRoot {
  root: {
    type: string;
    children: LexicalNode[];
    direction: 'ltr' | 'rtl' | null;
    format: string;
    indent: number;
    version: number;
    [k: string]: unknown;
  };
  [k: string]: unknown;
}
export interface Segment { id: string; text: string; }
export type TranslatedById = Record<string, string>;

function isTextNode(node: LexicalNode): boolean {
  // Only true Lexical "text" leaf nodes carry translatable content. We check the
  // type explicitly so element nodes that also expose a `text` field (e.g.
  // `autolink`, which has BOTH `text` and `children`) are never mistaken for a
  // leaf — their inner text nodes are reached by ordinary recursion instead.
  return node.type === 'text' && typeof node.text === 'string';
}
function isTranslatable(node: LexicalNode): boolean {
  return isTextNode(node) && node.text!.trim().length > 0;
}
function deepClone<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Depth-first; ordered { id, text } for every translatable text node. id is the
 *  dotted child-index path from root (e.g. "0.1.0"). */
export function extractSegments(body: LexicalRoot): Segment[] {
  const out: Segment[] = [];
  if (!body?.root?.children) return out;
  const walk = (nodes: LexicalNode[], prefix: string): void => {
    nodes.forEach((node, i) => {
      const id = prefix === '' ? String(i) : `${prefix}.${i}`;
      if (isTranslatable(node)) out.push({ id, text: node.text! });
      if (Array.isArray(node.children) && node.children.length > 0) walk(node.children, id);
    });
  };
  walk(body.root.children, '');
  return out;
}

/** NEW body (deep-cloned) with each translatable text replaced by its translated
 *  string, looked up by path id. Missing ids
 *  keep their original text. Everything non-text passes through. */
export function reinjectSegments(body: LexicalRoot, translatedById: TranslatedById): LexicalRoot {
  const clone = deepClone(body);
  if (!clone?.root?.children) return clone;
  const walk = (nodes: LexicalNode[], prefix: string): void => {
    nodes.forEach((node, i) => {
      const id = prefix === '' ? String(i) : `${prefix}.${i}`;
      if (isTranslatable(node)) {
        const t = translatedById[id];
        if (typeof t === 'string') node.text = t;
      }
      if (Array.isArray(node.children) && node.children.length > 0) walk(node.children, id);
    });
  };
  walk(clone.root.children, '');
  return clone;
}

/** NEW body with root + every node that ALREADY has `direction` set to `dir`.
 *  Never invents the field on nodes that lacked it. */
export function setDirection(body: LexicalRoot, dir: 'ltr' | 'rtl'): LexicalRoot {
  const clone = deepClone(body);
  if (!clone?.root) return clone;
  clone.root.direction = dir;
  const walk = (nodes: LexicalNode[] | undefined): void => {
    if (!Array.isArray(nodes)) return;
    for (const node of nodes) {
      if (Object.prototype.hasOwnProperty.call(node, 'direction')) node.direction = dir;
      walk(node.children);
    }
  };
  walk(clone.root.children);
  return clone;
}

export class ReinjectionMismatchError extends Error {
  constructor(message: string) { super(message); this.name = 'ReinjectionMismatchError'; }
}
function countNodes(body: LexicalRoot): number {
  let n = 0;
  const walk = (nodes: LexicalNode[] | undefined): void => {
    if (!Array.isArray(nodes)) return;
    for (const node of nodes) { n += 1; walk(node.children); }
  };
  walk(body?.root?.children);
  return n;
}

/** Asserts identical node count + identical segment-id set. */
export function validateReinjection(original: LexicalRoot, reinjected: LexicalRoot): void {
  const oc = countNodes(original), nc = countNodes(reinjected);
  if (oc !== nc) throw new ReinjectionMismatchError(`Node count changed: original=${oc}, reinjected=${nc}.`);
  const oi = new Set(extractSegments(original).map((s) => s.id));
  const ni = new Set(extractSegments(reinjected).map((s) => s.id));
  if (oi.size !== ni.size) throw new ReinjectionMismatchError(`Segment id count changed: ${oi.size} -> ${ni.size}.`);
  for (const id of oi) if (!ni.has(id)) throw new ReinjectionMismatchError(`Missing segment id "${id}".`);
}

/** Strict: every extracted id translated, no stray ids. */
export function assertFullCoverage(original: LexicalRoot, translatedById: TranslatedById): void {
  const ids = extractSegments(original).map((s) => s.id);
  const missing = ids.filter((id) => typeof translatedById[id] !== 'string');
  if (missing.length > 0) {
    throw new ReinjectionMismatchError(`Translation is missing ${missing.length} segment(s): ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? ' …' : ''}`);
  }
  const idSet = new Set(ids);
  const stray = Object.keys(translatedById).filter((k) => !idSet.has(k));
  if (stray.length > 0) {
    throw new ReinjectionMismatchError(`Translation has ${stray.length} unknown segment id(s): ${stray.slice(0, 10).join(', ')}${stray.length > 10 ? ' …' : ''}`);
  }
}

/** Import helper: reinject -> validate -> setDirection in one call. */
export function buildTranslatedBody(original: LexicalRoot, translatedById: TranslatedById, dir: 'ltr' | 'rtl' = 'ltr'): LexicalRoot {
  const reinjected = reinjectSegments(original, translatedById);
  validateReinjection(original, reinjected);
  return setDirection(reinjected, dir);
}
