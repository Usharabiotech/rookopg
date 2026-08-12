import type { ComponentPropsWithoutRef, ReactNode } from 'react';

function cx(...classes: Array<string | false | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-teal-600 text-white hover:bg-teal-700 disabled:bg-teal-600/50',
  secondary:
    'bg-white text-ink-800 border border-sand-300 hover:bg-sand-100 dark:bg-transparent dark:text-sand-100 dark:border-ink-600 dark:hover:bg-ink-800',
  ghost: 'text-ink-600 hover:bg-sand-100 dark:text-sand-300 dark:hover:bg-ink-800',
  danger: 'bg-clay-600 text-white hover:bg-clay-500 disabled:bg-clay-600/50',
};

export function Button({
  variant = 'primary',
  className,
  fullWidth,
  ...props
}: ComponentPropsWithoutRef<'button'> & { variant?: ButtonVariant; fullWidth?: boolean }) {
  return (
    <button
      {...props}
      className={cx(
        // 44px min height — a thumb on a phone, not a mouse pointer.
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold',
        'transition-colors disabled:cursor-not-allowed disabled:opacity-70',
        BUTTON_VARIANTS[variant],
        fullWidth && 'w-full',
        className,
      )}
    />
  );
}

/**
 * A link that looks like a button. Deliberately an anchor, not a button with
 * an onClick — navigation must work with middle-click, right-click and
 * keyboard the way the rest of the web does.
 */
export function LinkButton({
  href,
  variant = 'primary',
  fullWidth,
  className,
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  fullWidth?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      className={cx(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors',
        BUTTON_VARIANTS[variant],
        fullWidth && 'w-full',
        className,
      )}
    >
      {children}
    </a>
  );
}

// ---------------------------------------------------------------------------
// Surfaces
// ---------------------------------------------------------------------------

export function Card({
  children,
  className,
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'li' | 'article';
}) {
  return (
    <Tag
      className={cx(
        'rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5',
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
        {subtitle ? (
          <p className="mt-1 text-sm text-[var(--text-muted)]">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </header>
  );
}

// ---------------------------------------------------------------------------
// Form controls
// ---------------------------------------------------------------------------

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  const hintId = hint ? `${htmlFor}-hint` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium">
        {label}
        {required ? (
          <span className="text-clay-600" aria-hidden="true">
            {' '}
            *
          </span>
        ) : null}
      </label>
      {hint ? (
        <p id={hintId} className="text-xs text-[var(--text-muted)]">
          {hint}
        </p>
      ) : null}
      {children}
      {/* Errors are announced, not merely coloured. */}
      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-clay-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const CONTROL_CLASS =
  'w-full min-h-11 rounded-xl border border-sand-300 bg-white px-3 text-base ' +
  'placeholder:text-ink-400 focus:border-teal-600 ' +
  'dark:border-ink-600 dark:bg-ink-900 dark:text-sand-100';

export function Input({ className, ...props }: ComponentPropsWithoutRef<'input'>) {
  return <input {...props} className={cx(CONTROL_CLASS, className)} />;
}

export function Select({ className, children, ...props }: ComponentPropsWithoutRef<'select'>) {
  return (
    <select {...props} className={cx(CONTROL_CLASS, 'appearance-none pr-8', className)}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...props }: ComponentPropsWithoutRef<'textarea'>) {
  return <textarea {...props} className={cx(CONTROL_CLASS, 'min-h-24 py-2', className)} />;
}

export function Checkbox({
  label,
  id,
  ...props
}: ComponentPropsWithoutRef<'input'> & { label: string; id: string }) {
  return (
    <label
      htmlFor={id}
      className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border border-sand-300 px-3 text-sm dark:border-ink-600"
    >
      <input
        id={id}
        type="checkbox"
        {...props}
        className="size-4 rounded border-sand-300 accent-teal-600"
      />
      <span>{label}</span>
    </label>
  );
}

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-sand-200 text-ink-800 dark:bg-ink-800 dark:text-sand-200',
  success: 'bg-teal-100 text-teal-900 dark:bg-teal-900 dark:text-teal-100',
  warning: 'bg-gold-100 text-gold-600',
  danger: 'bg-clay-100 text-clay-600',
  info: 'bg-teal-50 text-teal-700',
};

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        BADGE_TONES[tone],
      )}
    >
      {children}
    </span>
  );
}

export function Alert({
  tone = 'danger',
  children,
}: {
  tone?: 'danger' | 'info' | 'success';
  children: ReactNode;
}) {
  const tones = {
    danger: 'border-clay-500/40 bg-clay-100 text-clay-600',
    info: 'border-teal-500/30 bg-teal-50 text-teal-700',
    success: 'border-teal-500/40 bg-teal-100 text-teal-900',
  };
  return (
    <div role="alert" className={cx('rounded-xl border px-3 py-2.5 text-sm', tones[tone])}>
      {children}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--border)] px-6 py-12 text-center">
      <p className="font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--text-muted)]">{description}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div>
      <p className="tnum text-2xl font-bold leading-none">{value}</p>
      <p className="mt-1 text-xs text-[var(--text-muted)]">{label}</p>
    </div>
  );
}
