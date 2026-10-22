/**
 * Push config.js into GitHub repository variables.
 *
 * The deploy workflow reads `vars.*`, and config.js is gitignored so it cannot
 * be committed. This is the bridge: it copies the values across as repository
 * variables, so CI has what it needs while the file stays local.
 *
 *   node tools/sync-vars.mjs            # set every key found
 *   node tools/sync-vars.mjs --dry      # report names only, set nothing
 *
 * Values are never printed, not even in dry-run mode. Requires the GitHub CLI
 * authenticated with permission to set repository variables.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const CONFIG = join(ROOT, 'config.js');
const dry = process.argv.includes('--dry');

/** config.js key -> GitHub repository variable name used by the workflow. */
const MAP = {
  invokeURL: 'CONTACT_ENDPOINT',
  mail_roleARN: 'AWS_DEPLOY_ROLE_ARN',
  aws_region: 'AWS_REGION',
  S3_bucket: 'S3_BUCKET',
  CLOUDFRONT_DISTRIBUTION_ID: 'CLOUDFRONT_DISTRIBUTION_ID',
};

if (!existsSync(CONFIG)) {
  console.error('config.js not found at the project root. Nothing to sync.');
  process.exit(1);
}

const src = readFileSync(CONFIG, 'utf8');
const values = {};
for (const key of Object.keys(MAP)) {
  const m = src.match(new RegExp(`const\\s+${key}\\s*=\\s*(['"\`])([\\s\\S]*?)\\1`));
  values[key] = m ? m[2].trim() : '';
}

const missing = Object.keys(MAP).filter((k) => !values[k]);
const present = Object.keys(MAP).filter((k) => values[k]);

if (dry) {
  console.log('dry run - nothing written. Names only, no values:\n');
  for (const k of present) console.log(`  ${k.padEnd(28)} -> ${MAP[k]}  (set)`);
  for (const k of missing) console.log(`  ${k.padEnd(28)} -> ${MAP[k]}  (MISSING, not sent)`);
  process.exit(missing.length ? 2 : 0);
}

for (const k of present) {
  // The value goes on stdin so it never appears in the process list or output.
  const name = MAP[k];
  try {
    execFileSync('gh', ['variable', 'set', name, '--body', values[k]], {
      cwd: ROOT,
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    console.log(`  set ${name}`);
  } catch (err) {
    console.error(`  FAILED to set ${name}: ${String(err.stderr || err.message).slice(0, 200)}`);
    process.exitCode = 1;
  }
}

if (missing.length) {
  console.log('\nstill missing, so these variables were not sent:');
  for (const k of missing) console.log(`  ${k} -> ${MAP[k]}`);
  process.exitCode = 2;
} else {
  console.log('\nall keys synced. No values were printed.');
}