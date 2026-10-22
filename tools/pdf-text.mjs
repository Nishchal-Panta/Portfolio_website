/**
 * Extract readable text from a PDF, including CID-encoded text.
 *
 * The LinkedIn export in docs/ is Chrome's print-to-PDF: its fonts are subset
 * and Identity-H encoded, so the text-showing operators carry glyph indices
 * such as <0055005C0003> rather than Unicode. Decoding those needs each font's
 * /ToUnicode CMap, so this walks the object table rather than pattern-matching
 * the content streams blind.
 *
 * No dependency: everything here is node:zlib plus parsing.
 *
 *   node tools/pdf-text.mjs "docs/Skills_Nishchal Panta _ LinkedIn.pdf"
 */

import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

const file = process.argv[2];
if (!file) {
  console.error('usage: node tools/pdf-text.mjs <file.pdf>');
  process.exit(1);
}

const raw = readFileSync(file);
const latin = raw.toString('latin1');

/* ---- object table ------------------------------------------------------ */

const objects = new Map();
const objRe = /(\d+)\s+0\s+obj\b/g;
let om;
while ((om = objRe.exec(latin))) {
  const start = om.index + om[0].length;
  const end = latin.indexOf('endobj', start);
  if (end < 0) break;
  objects.set(Number(om[1]), latin.slice(start, end));
  objRe.lastIndex = end;
}

/** Inflate the stream body of an object, or return null if it is not deflated. */
function streamOf(id) {
  const body = objects.get(id);
  if (!body) return null;
  const s = body.indexOf('stream');
  if (s < 0) return null;
  let start = s + 6;
  if (body.charCodeAt(start) === 13) start++;
  if (body.charCodeAt(start) === 10) start++;
  const e = body.indexOf('endstream', start);
  const slice = Buffer.from(body.slice(start, e < 0 ? body.length : e), 'latin1');
  try {
    return inflateSync(slice).toString('latin1');
  } catch {
    return body.slice(start, e < 0 ? body.length : e);
  }
}

/** Resolve an indirect reference that appears inside an object dict. */
function ref(dict, key) {
  const m = new RegExp(`${key}\\s+(\\d+)\\s+0\\s+R`).exec(dict);
  return m ? Number(m[1]) : null;
}

/* ---- ToUnicode cmaps --------------------------------------------------- */

function parseCmap(text) {
  const map = new Map();
  const lines = text.split(/\r?\n/);
  let i = 0;
  /* Block markers carry a count in front of them - "1 beginbfchar" - so they
     are matched at the end of the line rather than at the start. */
  const opens = (line, name) => new RegExp(`\\b${name}\\s*$`).test(line);
  const closes = (line, name) => line.startsWith(name);
  while (i < lines.length) {
    const line = lines[i].trim();
    if (opens(line, 'beginbfchar')) {
      i++;
      while (i < lines.length && !closes(lines[i].trim(), 'endbfchar')) {
        const m = /<([0-9A-Fa-f]+)>\s+<([0-9A-Fa-f]+)>/.exec(lines[i]);
        if (m) {
          const src = parseInt(m[1], 16);
          let dst = '';
          for (let k = 0; k + 4 <= m[2].length; k += 4) {
            dst += String.fromCharCode(parseInt(m[2].slice(k, k + 4), 16));
          }
          map.set(src, dst);
        }
        i++;
      }
    } else if (opens(line, 'beginbfrange')) {
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('endbfrange')) {
        const m = /<([0-9A-Fa-f]+)>\s+<([0-9A-Fa-f]+)>\s+(?:<([0-9A-Fa-f]+)>|\[([^\]]*)\])/.exec(lines[i]);
        if (m) {
          const from = parseInt(m[1], 16);
          const to = parseInt(m[2], 16);
          if (m[3]) {
            const base = parseInt(m[3], 16);
            for (let g = from; g <= to && g - from < 65536; g++) {
              map.set(g, String.fromCharCode(base + (g - from)));
            }
          } else if (m[4]) {
            const targets = [...m[4].matchAll(/<([0-9A-Fa-f]+)>/g)];
            targets.forEach((t, n) => {
              let dst = '';
              for (let k = 0; k + 4 <= t[1].length; k += 4) {
                dst += String.fromCharCode(parseInt(t[1].slice(k, k + 4), 16));
              }
              map.set(from + n, dst);
            });
          }
        }
        i++;
      }
    }
    i++;
  }
  return map;
}

/** font resource name -> glyph map, gathered from every /Font dict present. */
const fontMaps = new Map();
const fontDictRe = /\/Font\s*<<([\s\S]*?)>>/g;
let fm;
const fontDebug = [];
while ((fm = fontDictRe.exec(latin))) {
  const entries = [...fm[1].matchAll(/\/(F[\w-]+)\s+(\d+)\s+0\s+R/g)];
  fontDebug.push(`dict:${entries.map((e) => e[1]).join(',')}`);
  for (const [, name, id] of entries) {
    const dict = objects.get(Number(id)) ?? '';
    const tu = ref(dict, '/ToUnicode');
    const cmap = tu === null ? null : parseCmap(streamOf(tu) ?? '');
    fontDebug.push(
      `  ${name} obj=${id} tu=${tu} streamLen=${streamOf(tu)?.length ?? 'null'} glyphs=${cmap ? cmap.size : 'null'}`
    );
    if (cmap && cmap.size) fontMaps.set(name, cmap);
  }
}

/* ---- content streams --------------------------------------------------- */

function decode(hex, cmap) {
  let out = '';
  for (let k = 0; k + 4 <= hex.length; k += 4) {
    const g = parseInt(hex.slice(k, k + 4), 16);
    out += cmap?.get(g) ?? '';
  }
  return out;
}

const pages = [];
/* Walk the object table rather than pattern-matching the file: an object's
   id sits immediately before its body, so the table is already the index. */
for (const [id, dict] of objects) {
  if (!/\/Type\s*\/Page\b/.test(dict) || /\/Type\s*\/Pages\b/.test(dict)) continue;
  const c = ref(dict, '/Contents');
  const text = c === null ? null : streamOf(c);
  if (!text) continue;

  let font = null;
  let line = '';
  const out = [];
  /* A horizontal Td carries on the same visual line; only a vertical move or
     an explicit T* starts a new one. Chrome emits one Td per word, so treating
     every positioning operator as a break tears the text into single glyphs. */
  const tok =
    /\/(F[\w-]+)\s+[\d.]+\s+Tf|\((?:\\.|[^\\()])*\)|<([0-9A-Fa-f]+)>|(-?[\d.]+)\s+(-?[\d.]+)\s+(T[dD])|TJ|Tj|T\*|ET/g;
  let m;
  while ((m = tok.exec(text))) {
    const t = m[0];
    if (t.startsWith('/')) {
      font = m[1];
    } else if (t.startsWith('(')) {
      line += t.slice(1, -1).replace(/\\([()\\])/g, '$1').replace(/\\n/g, ' ');
    } else if (t.startsWith('<')) {
      line += decode(m[2], fontMaps.get(font));
    } else if (m[5]) {
      if (parseFloat(m[4]) !== 0 && line.trim()) {
        out.push(line.trim());
        line = '';
      }
    } else if (line.trim()) {
      out.push(line.trim());
      line = '';
    }
  }
  if (line.trim()) out.push(line.trim());
  if (out.length) pages.push(`--- page object ${id} ---\n${out.join('\n')}`);
}

if (process.env.PDF_DEBUG) {
  console.error(fontDebug.join('\n'));
  console.error(
    `pages=${pages.length} fonts=${fontMaps.size} objects=${objects.size}`
  );
}
console.log(pages.join('\n\n'));
