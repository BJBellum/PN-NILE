#!/usr/bin/env node
/**
 * migrate-fetches.js
 *
 * Run this script ONCE in your repo to migrate all frontend HTML files
 * from direct GitHub API fetches to /api/data endpoint.
 *
 * Before:
 *   fetch('https://api.github.com/repos/BJBellum/UKN/contents/data/bourse.json', {
 *     headers: { 'Accept': 'application/vnd.github.v3.raw' }, cache: 'no-store'
 *   }).then(r => r.json())
 *
 * After:
 *   fetch('/api/data?key=bourse')
 *   .then(r => r.json())
 *
 * Usage:
 *   node migrate-fetches.js              # dry run (shows what would change)
 *   node migrate-fetches.js --write      # actually write changes
 */

const fs   = require('fs');
const path = require('path');

const DRY_RUN = !process.argv.includes('--write');

// Map: GitHub file path → API key
const KEY_MAP = {
  'data/bourse.json':              'bourse',
  'data/fan.json':                 'fan',
  'data/catalogue-militaire.json': 'catalogue',
  'data/parlement.json':           'parlement',
};

// Regex patterns for fetch calls to GitHub contents API
const FETCH_PATTERNS = [
  // Full fetch with headers
  {
    pattern: /fetch\(\s*[`'"](https?:\/\/api\.github\.com\/repos\/[^/]+\/[^/]+\/contents\/(data\/[^'"` ]+))[`'"]\s*,\s*\{[^}]*'Accept'[^}]*'application\/vnd\.github\.v3\.raw'[^}]*\}\s*\)/g,
    replace: (match, url, filePath) => {
      const key = KEY_MAP[filePath];
      if (!key) return match;
      return `fetch('/api/data?key=${key}')`;
    },
  },
  // Raw githubusercontent URL
  {
    pattern: /fetch\(\s*[`'"](https?:\/\/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[^/]+\/(data\/[^'"` ]+))[`'"]\s*\)/g,
    replace: (match, url, filePath) => {
      const key = KEY_MAP[filePath];
      if (!key) return match;
      return `fetch('/api/data?key=${key}')`;
    },
  },
];

// Regex for PUT write operations — replace with /api/write
const WRITE_PATTERN = /fetch\(\s*`https:\/\/api\.github\.com\/repos\/\$\{REPO\}\/contents\/\$\{([^}]+)\}`\s*,\s*\{[^}]*method:\s*['"]PUT['"][^}]*\}\s*\)/g;

// Also migrate admin save functions
const ADMIN_SAVE_PATTERN = /const\s+body\s*=\s*\{[^}]*message:[^}]*content:[^}]*\};[\s\n]*(?:if\s*\(sha\)[\s\n]*body\.sha\s*=\s*sha;[\s\n]*)?const\s+pr\s*=\s*await\s+fetch\([^)]+\)/g;

function findHTMLFiles(dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...findHTMLFiles(fullPath));
    } else if (entry.name.endsWith('.html')) {
      result.push(fullPath);
    }
  }
  return result;
}

function migrateFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let modified = content;
  let changes = [];

  for (const { pattern, replace } of FETCH_PATTERNS) {
    const before = modified;
    modified = modified.replace(pattern, (...args) => {
      const result = replace(...args);
      if (result !== args[0]) {
        changes.push(`  fetch → /api/data (${args[2] || args[1]})`);
      }
      return result;
    });
  }

  // Replace write operations (admin page)
  if (modified.includes("method:'PUT'") || modified.includes('method: "PUT"')) {
    // Replace the complex GitHub write with a simple /api/write call
    modified = modified.replace(
      /\/\/ Write to GitHub[\s\S]*?await\s+fetch\(`https:\/\/api\.github\.com\/repos\/\$\{REPO\}\/contents\/\$\{([^}]+)\}`[\s\S]*?\}\s*\)/g,
      (match, varName) => {
        const key = Object.entries({
          FILE: 'bourse', FAN_FILE: 'fan', PARL_FILE: 'parlement', CAT_FILE: 'catalogue'
        }).find(([k]) => varName.includes(k))?.[1] || 'unknown';
        changes.push(`  PUT → /api/write (key: ${key})`);
        return `await fetch('/api/write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ key: '${key}', data: body_data }),
    })`;
      }
    );
  }

  // Remove old PAT-related code
  modified = modified
    .replace(/localStorage\.getItem\(['"]pharos_gh_pat['"]\)/g, "''/* PAT removed — use /api/write */")
    .replace(/localStorage\.setItem\(['"]pharos_gh_pat['"],.*?\)/g, '/* PAT storage removed */');

  const hasChanges = modified !== content;
  const rel = filePath.replace(process.cwd() + '/', '');

  if (hasChanges) {
    console.log(`\n${DRY_RUN ? '[DRY RUN] Would change' : 'Changed'}: ${rel}`);
    changes.forEach(c => console.log(c));
    if (!DRY_RUN) {
      fs.writeFileSync(filePath, modified, 'utf-8');
    }
  }

  return hasChanges;
}

// ── Main ──────────────────────────────────────────────────────────────────────
const rootDir = process.cwd();
const files   = findHTMLFiles(rootDir);
let changeCount = 0;

console.log(`\n🔍 Scanning ${files.length} HTML files in ${rootDir}`);
if (DRY_RUN) console.log('   (dry run — use --write to apply changes)\n');

for (const file of files) {
  if (migrateFile(file)) changeCount++;
}

console.log(`\n${DRY_RUN ? '[DRY RUN] ' : ''}${changeCount} file(s) ${DRY_RUN ? 'would be' : 'were'} modified.`);
if (DRY_RUN && changeCount > 0) {
  console.log('\nRun with --write to apply:\n  node migrate-fetches.js --write\n');
}
