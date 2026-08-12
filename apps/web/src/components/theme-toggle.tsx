'use client';

import { useEffect, useState } from 'react';

export type Theme = 'system' | 'light' | 'dark';

const COOKIE = 'pg_theme';
const OPTIONS: Array<{ value: Theme; label: string; glyph: string }> = [
  { value: 'light', label: 'Light', glyph: '☀' },
  { value: 'dark', label: 'Dark', glyph: '☾' },
  { value: 'system', label: 'System', glyph: '◐' },
];

function apply(theme: Theme): void {
  const root = document.documentElement;
  // "system" removes the attribute entirely so the prefers-color-scheme
  // media query takes over again.
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);

  // A year-long cookie, so the server renders the right theme on the next
  // request and the page never flashes the wrong one.
  document.cookie = `${COOKIE}=${theme}; path=/; max-age=31536000; samesite=lax`;
}

export function ThemeToggle({ initial, variant = 'rail' }: { initial: Theme; variant?: 'rail' | 'bar' }) {
  const [theme, setTheme] = useState<Theme>(initial);
  const [ready, setReady] = useState(false);

  // Renders inert until mounted: a control that looks interactive before its
  // handler exists is worse than one that arrives a frame late.
  useEffect(() => setReady(true), []);

  const choose = (next: Theme) => {
    setTheme(next);
    apply(next);
  };

  const onRail = variant === 'rail';

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={
        'inline-flex rounded-lg border p-0.5 ' +
        (onRail ? 'border-white/10 bg-white/5' : 'border-[var(--border)] bg-[var(--bg-deep)]')
      }
    >
      {OPTIONS.map((option) => {
        const active = theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={!ready}
            onClick={() => choose(option.value)}
            title={option.label}
            className={
              'pressable inline-flex size-8 items-center justify-center rounded-md text-sm transition-colors ' +
              (active
                ? onRail
                  ? 'bg-white/15 text-white'
                  : 'bg-[var(--surface)] text-[var(--text)] shadow-[var(--shadow-card)]'
                : onRail
                  ? 'text-ink-400 hover:text-white'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]')
            }
          >
            <span aria-hidden="true">{option.glyph}</span>
            <span className="sr-only">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
