import type { ComponentPropsWithoutRef, ReactNode } from 'react';

function cx(...classes: Array<string | false | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--action)] text-[var(--on-action)] hover:bg-[var(--action-hover)] disabled:opacity-50',
  secondary:
    'border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--bg-deep)]',
  ghost: 'text-[var(--text-muted)] hover:bg-[var(--bg-deep)] hover:text-[var(--text)]',
  danger: 'bg-rust-600 text-white hover:bg-rust-500 disabled:bg-rust-600/50',
};

const ACTION_BASE =
  'pressable inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70 disabled:active:translate-y-0';

export function Button({
  variant = 'primary',
  className,
  fullWidth,
  ...props
}: ComponentPropsWithoutRef<'button'> & { variant?: ButtonVariant; fullWidth?: boolean }) {
  return (
    <button
      {...props}
      className={cx(ACTION_BASE, BUTTON_VARIANTS[variant], fullWidth && 'w-full', className)}
    />
  );
}

/** An anchor styled as a button, so middle-click and keyboard still work. */
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
      className={cx(ACTION_BASE, BUTTON_VARIANTS[variant], fullWidth && 'w-full', className)}
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
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'li' | 'article';
  padded?: boolean;
}) {
  return (
    <Tag
      className={cx(
        'rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)]',
        padded && 'p-4 sm:p-5',
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="eyebrow">{children}</p>;
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <h1 className="display mt-1 text-2xl leading-tight sm:text-3xl">{title}</h1>
        {subtitle ? (
          <p className="mt-1.5 max-w-prose text-sm text-[var(--text-muted)]">{subtitle}</p>
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
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium">
        {label}
        {required ? (
          <span className="text-rust-500" aria-hidden="true">
            {' '}
            *
          </span>
        ) : null}
      </label>
      {hint ? (
        <p id={`${htmlFor}-hint`} className="text-xs text-[var(--text-muted)]">
          {hint}
        </p>
      ) : null}
      {children}
      {/* Announced, not merely coloured. */}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-xs font-medium text-rust-500">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const CONTROL_CLASS =
  'w-full min-h-11 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-base ' +
  'text-[var(--text)] placeholder:text-[var(--text-muted)] transition-colors ' +
  'hover:border-teal-300 focus:border-[var(--action)]';

export function Input({ className, ...props }: ComponentPropsWithoutRef<'input'>) {
  return <input {...props} className={cx(CONTROL_CLASS, className)} />;
}

export function Select({ className, children, ...props }: ComponentPropsWithoutRef<'select'>) {
  return (
    <select {...props} className={cx(CONTROL_CLASS, className)}>
      {children}
    </select>
  );
}

export function Checkbox({
  label,
  id,
  ...props
}: ComponentPropsWithoutRef<'input'> & { label: string; id: string }) {
  return (
    <label
      htmlFor={id}
      className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg border border-[var(--border-strong)] px-3 text-sm transition-colors hover:border-teal-300"
    >
      <input id={id} type="checkbox" {...props} className="size-4 rounded accent-[var(--action)]" />
      <span>{label}</span>
    </label>
  );
}

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

type BadgeTone = 'neutral' | 'free' | 'taken' | 'warning' | 'danger';

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-[var(--bg-deep)] text-[var(--text-muted)] border-[var(--border)]',
  free: 'bg-moss-100 text-moss-700 border-moss-500/30',
  taken: 'bg-brass-100 text-brass-700 border-brass-500/30',
  warning: 'bg-brass-100 text-brass-700 border-brass-500/30',
  danger: 'bg-rust-100 text-rust-600 border-rust-500/30',
};

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium',
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
    danger: 'border-rust-500/40 bg-rust-100 text-rust-600',
    info: 'border-brass-500/30 bg-brass-100 text-brass-700',
    success: 'border-moss-500/40 bg-moss-100 text-moss-700',
  };
  return (
    <div role="alert" className={cx('rounded-lg border px-3 py-2.5 text-sm', tones[tone])}>
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
    <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--border-strong)] px-6 py-14 text-center">
      <p className="display text-lg">{title}</p>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-[var(--text-muted)]">{description}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

/** A figure and its label. Numbers are mono so columns of them line up. */
export function Stat({
  value,
  label,
  tone = 'default',
}: {
  value: string | number;
  label: string;
  tone?: 'default' | 'free' | 'taken';
}) {
  const colours = {
    default: 'text-[var(--text)]',
    free: 'text-[var(--ok)]',
    taken: 'text-[var(--accent-text)]',
  };
  return (
    <div>
      <p className={cx('figure text-2xl font-semibold leading-none', colours[tone])}>{value}</p>
      <p className="eyebrow mt-1.5">{label}</p>
    </div>
  );
}
