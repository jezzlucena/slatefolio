// Copies the opencv.js build from @techstark/opencv-js (version pinned by the
// lockfile) into public/vendor/, where Flipdots loads it with a <script> tag.
// It is served as-is instead of bundled: Turbopack overflows its stack on the
// file's single ~10 MB line, and webpack would need fs/path/crypto stubs.
//
// Runs before `dev` and `build` (see package.json) and once in the frontend
// Dockerfile right after the source is copied, so the image ships the file
// baked in; the output is gitignored and dockerignored.
//
// Idempotent on purpose: when the copy is already current (same byte size as
// the package's build) nothing is written. That matters when the container's
// filesystem is read-only at runtime — the `dev` CMD re-runs this script, and
// a write there fails with EROFS even though the file is already in place.
import { copyFileSync, mkdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = require.resolve('@techstark/opencv-js');
const targetDir = join(root, 'public', 'vendor');
const target = join(targetDir, 'opencv.js');

const sizeOf = (path) => {
  try {
    return statSync(path).size;
  } catch {
    return -1;
  }
};

const sourceSize = sizeOf(source);
if (sizeOf(target) === sourceSize) {
  process.exit(0); // already vendored at this version
}

try {
  mkdirSync(targetDir, { recursive: true });
  copyFileSync(source, target);
} catch (error) {
  const readOnly = ['EROFS', 'EACCES', 'EPERM'].includes(error?.code);
  if (readOnly && sizeOf(target) > 0) {
    // Can't refresh it, but a copy exists — serve what's there rather than
    // refuse to start. (Likely a stale version: rebuild the image to fix.)
    console.warn(`[vendor-opencv] ${target} is read-only; keeping the existing copy`);
    process.exit(0);
  }
  throw error;
}
