import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Guards against confusing a browser route with an API path.
 *
 * The owner pages live under /dashboard, but the API has no such prefix. When
 * the owner tree was moved, a blanket find-and-replace rewrote both, and every
 * property page started asking the backend for /dashboard/properties/... —
 * which 404s, which the pages turn into a "not found" screen. Nothing failed
 * loudly; the pages simply vanished.
 *
 * revalidatePath and Link href legitimately carry /dashboard. Only the fetch
 * helpers are checked here.
 */
const SOURCE_ROOT = join(__dirname, '..');

/*
 * Only prefixes that exist in the browser and nowhere in the API.
 *
 * /bookings is deliberately absent: it is a real API path as well as a page
 * route, so flagging it would be noise. These three have no API counterpart,
 * so seeing one inside a fetch helper is always a mistake.
 */
const BAD_CALL = /\b(api|apiUpload|apiFetchRaw|apiPublic)(?:<[^>]*>)?\(\s*[`'"]\/(dashboard|pg|login)\b/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      return entry === 'node_modules' || entry === '.next' ? [] : sourceFiles(full);
    }
    return /\.tsx?$/.test(entry) && !entry.endsWith('.spec.ts') ? [full] : [];
  });
}

describe('API paths', () => {
  const files = sourceFiles(SOURCE_ROOT);

  it('finds source files to check', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it.each(files.map((file) => [file.replace(SOURCE_ROOT, 'src').replace(/\\/g, '/'), file]))(
    '%s does not send a browser route to the API',
    (_label, file) => {
      const lines = readFileSync(file, 'utf8').split('\n');
      const offenders = lines
        .map((line, index) => ({ line: line.trim(), number: index + 1 }))
        .filter((entry) => BAD_CALL.test(entry.line))
        .map((entry) => `line ${entry.number}: ${entry.line}`);

      expect(offenders).toEqual([]);
    },
  );
});
