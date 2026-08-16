import { LEGAL } from '@/lib/legal';

/**
 * Shared shell for the legal pages.
 *
 * A route group, so the URLs stay at /terms and /privacy rather than
 * /legal/terms — Razorpay and most people expect them at the root.
 *
 * Measure is capped near 68 characters. These are the pages nobody wants to
 * read; the least we can do is not set them the full width of a laptop.
 */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      {LEGAL.underReview ? (
        <p className="mb-8 rounded-[var(--radius-card)] border border-[var(--border-strong)] bg-[var(--bg-deep)] px-4 py-3 text-sm">
          <strong className="font-semibold">Draft, pending legal review.</strong>{' '}
          <span className="text-[var(--text-muted)]">
            This describes how the product actually works, which is the part a lawyer cannot
            write for us. It has not yet been reviewed by one, and must be before launch.
          </span>
        </p>
      ) : null}

      <article className="legal">{children}</article>

      <p className="mt-10 border-t border-[var(--border)] pt-5 text-xs text-[var(--text-muted)]">
        Last updated {LEGAL.lastUpdated}.
      </p>
    </div>
  );
}
