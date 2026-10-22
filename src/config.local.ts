/**
 * Local configuration.
 *
 * `config.js` sits at the project root, is gitignored, and is never committed.
 * It holds environment identifiers only - an invoke URL, a role ARN, a region,
 * a bucket and a distribution id - not credentials. Nothing here is ever
 * printed, logged, or rendered into the page except the endpoint, which the
 * form already has to expose to submit to it.
 *
 * Precedence for the contact endpoint:
 *   1. PUBLIC_CONTACT_ENDPOINT, set by CI from a GitHub repository variable,
 *      so a hosted build works without this file existing.
 *   2. config.js, so a local build works without touching GitHub settings.
 *
 * This module runs in Node at build time only. It never ships to the browser
 * beyond the single endpoint string the form needs.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const CONFIG = join(HERE, '..', '..', 'config.js');

/** Pull one `const name = "value";` out of config.js without evaluating it. */
function readLocal(name: string): string {
  try {
    const src = readFileSync(CONFIG, 'utf8');
    const m = src.match(new RegExp(`const\\s+${name}\\s*=\\s*(['"\`])([\\s\\S]*?)\\1`));
    return m ? m[2].trim() : '';
  } catch {
    // No config.js: a hosted build is expected to use the env var instead.
    return '';
  }
}

const fromEnv = import.meta.env.PUBLIC_CONTACT_ENDPOINT ?? '';

export const CONTACT_ENDPOINT: string = fromEnv || readLocal('invokeURL');

/** Everything present, so the build can warn about what is missing by NAME only. */
export function localConfig(): Record<string, string> {
  return {
    invokeURL: readLocal('invokeURL'),
    mail_roleARN: readLocal('mail_roleARN'),
    aws_region: readLocal('aws_region'),
    S3_bucket: readLocal('S3_bucket'),
    CLOUDFRONT_DISTRIBUTION_ID: readLocal('CLOUDFRONT_DISTRIBUTION_ID'),
  };
}