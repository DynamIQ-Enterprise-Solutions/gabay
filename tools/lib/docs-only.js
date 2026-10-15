// Which pushed paths are documents only (L187 A.1). The pre-push hook (.githooks/pre-push) skips
// `npm run verify` when EVERY path a push changes is one of these; CI lint and e2e still gate every merge.
//
// Documents: any *.md, plan.html, and everything under docs/, plan/, spec/, intent/ and phase-reports/
// (screenshots included). `.claude/skills/**/*.md` and `.claude/agents/*.md` are *.md, so the first rule
// already covers them; a .claude/hooks script or settings.json is code and is not listed.
// Anything else (app/, functions/, db/, tools/, .github/, .githooks/, package.json, .env.example, ...) is code.
// The empty set is NOT docs-only: nothing to judge, so the hook keeps its old behaviour (it verifies).
//
// Command line (used by the hook): paths on stdin, one per line; prints the count and exits 0 when the set
// is docs-only, exits 1 (printing nothing) when it is not. Plain CommonJS, no dependencies, any Node >= 22.
'use strict';

/** Folders whose every file is a document, relative to the repository root. */
const DOC_FOLDERS = ['docs/', 'plan/', 'spec/', 'intent/', 'phase-reports/'];

/** Root files that are documents whatever their extension. */
const DOC_FILES = ['plan.html'];

/** A repository-relative path as git prints it on Windows or POSIX: forward slashes, no leading "./". */
const normalise = (p) => p.replace(/\\/g, '/').replace(/^(\.\/)+/, '');

/** True when the one path is a document. */
function isDocPath(rawPath) {
  const p = normalise(String(rawPath));
  if (p === '') return false;
  if (p.endsWith('.md')) return true;
  if (DOC_FILES.includes(p)) return true;
  return DOC_FOLDERS.some((folder) => p.startsWith(folder));
}

/** True when the set is not empty and every path in it is a document. */
function isDocsOnly(paths) {
  const list = [...paths].filter((p) => String(p).trim() !== '');
  return list.length > 0 && list.every(isDocPath);
}

module.exports = { isDocPath, isDocsOnly, DOC_FOLDERS, DOC_FILES };

if (require.main === module) {
  const chunks = [];
  process.stdin.on('data', (c) => chunks.push(c));
  process.stdin.on('end', () => {
    const paths = Buffer.concat(chunks)
      .toString('utf8')
      .split(/\r?\n/)
      .filter((l) => l !== '');
    if (isDocsOnly(paths)) {
      process.stdout.write(`${paths.length}\n`);
      process.exit(0);
    }
    process.exit(1);
  });
}
