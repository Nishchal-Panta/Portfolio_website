/**
 * The mark geometry, imported raw.
 *
 * Each file was downloaded once by tools/fetch-logos.mjs, stripped of its
 * title, fixed dimensions and hard-coded fills, and given fill="currentColor"
 * on every path. Importing them as raw text rather than as asset URLs is the
 * whole point: an <img> pointing at an external or even a local file cannot
 * inherit the theme's ink, and this page needs the marks to be one flat token
 * colour on paper and another on night, then to take a brand colour only on
 * hover where that colour is still legible.
 *
 * Nothing here is fetched at runtime. The geometry is part of the bundle.
 */

import aws from '@assets/logos/aws.svg?raw';
import css3 from '@assets/logos/css3.svg?raw';
import git from '@assets/logos/git.svg?raw';
import github from '@assets/logos/github.svg?raw';
import html5 from '@assets/logos/html5.svg?raw';
import huggingface from '@assets/logos/huggingface.svg?raw';
import java from '@assets/logos/java.svg?raw';
import laravel from '@assets/logos/laravel.svg?raw';
import mysql from '@assets/logos/mysql.svg?raw';
import pandas from '@assets/logos/pandas.svg?raw';
import python from '@assets/logos/python.svg?raw';
import pytorch from '@assets/logos/pytorch.svg?raw';

const RAW: Record<string, string> = {
  aws,
  css3,
  git,
  github,
  html5,
  huggingface,
  java,
  laravel,
  mysql,
  pandas,
  python,
  pytorch,
};

/** File stems stored here, so a build check can compare them with disk. */
export const MARK_FILES: string[] = Object.keys(RAW).sort();

/**
 * Return one mark ready to paste into the page.
 *
 * It is decorated the same way every time: aria-hidden and focusable="false",
 * because the tool's name sits directly underneath in text and a second copy
 * of it read aloud would be noise. The class carries the sizing that makes a
 * 24-unit octocat and a 24-unit pandas wordmark read at the same weight.
 *
 * Throws rather than rendering nothing - a missing mark should fail the build,
 * not quietly produce a nameless tile.
 */
export function mark(file: string): string {
  const raw = RAW[file];
  if (!raw) throw new Error(`no stored mark for "${file}"`);
  return raw.replace(
    '<svg',
    '<svg class="tile__glyph" aria-hidden="true" focusable="false"'
  );
}
