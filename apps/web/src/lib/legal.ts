/**
 * Company and contact details used across the legal pages.
 *
 * Everything marked TODO has to come from Neeraj — the registered entity name,
 * the address on the incorporation certificate, the GSTIN. These are deliberately
 * left as visible placeholders rather than filled with plausible-looking values:
 * a wrong address on a published grievance page is worse than an obvious blank,
 * and Razorpay checks these against the documents you upload.
 *
 * Razorpay will not activate an account until Terms, Privacy, Refunds and
 * Contact are reachable at public URLs, so these pages gate the payment work
 * going live.
 */
export const LEGAL = {
  /** Registered name of the entity, exactly as incorporated. */
  entity: 'TODO — registered company name',
  /** The trading name people know. */
  brand: 'PG Platform',
  /** Registered office, as on the incorporation certificate. */
  address: 'TODO — registered office address, Hyderabad, Telangana',
  /** Once registered. Leave empty until then rather than guessing. */
  gstin: '',
  cin: '',

  supportEmail: 'TODO@example.com',
  supportPhone: 'TODO — support number',

  /**
   * Required by the IT (Intermediary Guidelines) Rules 2021 and by the DPDP
   * Act 2023. Must be a named person, reachable, who answers within the
   * statutory timelines below.
   */
  grievanceOfficer: {
    name: 'TODO — officer name',
    email: 'TODO@example.com',
    phone: 'TODO — number',
  },

  /** Statutory: acknowledge within 24 hours, resolve within 15 days. */
  grievanceAckHours: 24,
  grievanceResolveDays: 15,

  /** How long a refund takes to reach the payment method it came from. */
  refundWorkingDays: '5 to 7 working days',

  jurisdiction: 'Hyderabad, Telangana',

  /** Shown on every legal page until a lawyer has signed these off. */
  underReview: true,

  /** Bumped whenever the substance changes, not on typo fixes. */
  lastUpdated: '16 August 2026',
} as const;

export const LEGAL_PAGES = [
  { href: '/terms', label: 'Terms of use' },
  { href: '/privacy', label: 'Privacy policy' },
  { href: '/refunds', label: 'Cancellation and refunds' },
  { href: '/contact', label: 'Contact us' },
] as const;
