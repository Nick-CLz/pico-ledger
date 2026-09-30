import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Hexagonal boundary check. ESLint enforces this in the editor; this test
 * enforces it in CI so the rule can't be silently disabled.
 */
const root = join(__dirname, '..', '..');
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(f) ? [p] : [];
  });
const importsOf = (file: string) =>
  [...readFileSync(file, 'utf8').matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);

describe('architecture', () => {
  it('core imports nothing outside core', () => {
    const offenders = walk(join(root, 'src/core')).flatMap((f) =>
      importsOf(f)
        .filter((i) => !i.startsWith('.') || /adapters|ui|composition/.test(i))
        .map((i) => `${relative(root, f)} -> ${i}`),
    );
    expect(offenders).toEqual([]);
  });

  it('UI never imports adapters directly', () => {
    const offenders = walk(join(root, 'src/ui')).flatMap((f) =>
      importsOf(f).filter((i) => i.includes('adapters')).map((i) => `${relative(root, f)} -> ${i}`),
    );
    expect(offenders).toEqual([]);
  });
});
