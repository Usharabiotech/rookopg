import type { Metadata } from 'next';
import { LEGAL } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Terms of use',
  description: `The agreement between you and ${LEGAL.brand} when you use the site to find or list a PG.`,
};

export default function TermsPage() {
  return (
    <>
      <h1>Terms of use</h1>

      <p>
        These terms govern your use of {LEGAL.brand}, operated by {LEGAL.entity}. By searching,
        booking or listing on the site you accept them. If you do not, please do not use the
        site.
      </p>

      <h2>1. What we are, and what we are not</h2>
      <p>
        We are a marketplace. We list paying-guest and hostel accommodation in Hyderabad, show
        what each place charges and how many beds are free, and let you reserve one.
      </p>
      <p>
        <strong>The accommodation itself is provided by the PG owner, not by us.</strong> When
        you book, the agreement to stay is between you and that owner. We are not the landlord,
        we do not own or run the buildings, and we do not control the condition of a room, the
        food, or how an owner behaves once you move in. What we are responsible for is the
        booking, the money that passes through the platform, and dealing fairly with you when
        something goes wrong.
      </p>

      <h2>2. Accounts</h2>
      <p>
        You can browse without an account. To book a bed or see an owner&apos;s contact details
        you sign in, and you verify a mobile number by one-time password. You are responsible
        for what happens under your account, so keep access to that number.
      </p>
      <p>
        You must be 18 or older to book. Owners must have the right to let the property they
        list.
      </p>

      <h2>3. Booking a bed</h2>
      <p>When you book, you pay:</p>
      <ul>
        <li>the first month&apos;s rent,</li>
        <li>the refundable security deposit the owner has set, and</li>
        <li>our booking fee, shown separately before you pay.</li>
      </ul>
      <p>
        Rent after the first month is paid to the owner directly, not through us, unless we tell
        you otherwise.
      </p>
      <p>
        The bed is held for you while you pay. If payment does not complete in time, the hold
        lapses and the bed goes back to whoever wants it.
      </p>

      <h2>4. We hold your money until you arrive</h2>
      <p>
        This matters, so it is stated plainly. The money you pay at booking is{' '}
        <strong>not passed to the owner straight away</strong>. It is held by our payment
        provider until you check in at the building.
      </p>
      <p>
        The reason is simple: an owner may forget to update their availability, and you should
        not lose money for their bookkeeping. If you turn up and the bed is not there, the money
        has not moved and can come back to you.
      </p>
      <p>
        The money is released to the owner when you check in. If neither you nor the owner
        records a check-in, it releases automatically a set period after your move-in date.
      </p>

      <h2>5. Cancellation and refunds</h2>
      <p>
        Set out in full on the{' '}
        <a href="/refunds">cancellation and refunds page</a>, which forms part of these terms.
      </p>

      <h2>6. The security deposit</h2>
      <p>
        The deposit is the owner&apos;s to hold and the owner&apos;s to return when you leave,
        less any deductions they are entitled to make for damage or unpaid dues. We are not
        holding your deposit for the length of your stay and we cannot compel an owner to return
        it, though we will take up a complaint on your behalf and we can remove an owner who
        makes a habit of it.
      </p>

      <h2>7. If you are a PG owner</h2>
      <ul>
        <li>
          List honestly. Rent, deposit, sharing type, facilities and the number of free beds
          must be accurate. Photographs must be of the property you are letting.
        </li>
        <li>
          Keep availability current. A tenant arriving to find the bed gone is the single worst
          thing that can happen on this platform.
        </li>
        <li>Honour confirmed bookings at the price shown.</li>
        <li>
          Follow the law that applies to you, including any local registration for running a
          paying-guest establishment, and the tax obligations that come with the rent you
          receive.
        </li>
        <li>You keep responsibility for the building, its safety, and your dealings with tenants.</li>
      </ul>
      <p>
        We may remove a listing or suspend an account for repeated inaccuracy, for refusing
        honoured bookings, or for conduct that puts tenants at risk.
      </p>

      <h2>8. What we charge</h2>
      <p>
        Tenants pay a booking fee, shown before payment. Owners pay a commission on rent
        collected through the platform; the deposit is never commissioned. Current rates are
        shown to owners when they list and to tenants at checkout. We will give notice before
        changing them.
      </p>

      <h2>9. Content you upload</h2>
      <p>
        Photographs and descriptions stay yours. You give us permission to show them on the
        site and in listings. Do not upload anything you do not have the right to use, anything
        misleading, or photographs of people who have not agreed to appear.
      </p>

      <h2>10. Acceptable use</h2>
      <p>
        Do not scrape the site, interfere with it, attempt to reach other people&apos;s data,
        create listings for property you do not control, or use the platform to arrange a
        booking off-platform in order to avoid fees after making contact through us.
      </p>

      <h2>11. Where our responsibility ends</h2>
      <p>
        We do not guarantee that a listing is accurate, that an owner will behave well, or that
        a property is suitable for you — visit before you commit to a long stay. To the extent
        the law allows, our liability for any claim connected with a booking is limited to the
        fees we received on that booking. Nothing here limits liability that cannot be limited
        by law.
      </p>

      <h2>12. Suspension</h2>
      <p>
        We may suspend or close an account that breaks these terms. You may stop using the site
        at any time; ask us to delete your account and we will, subject to records we are
        required to keep.
      </p>

      <h2>13. Changes</h2>
      <p>
        We may update these terms. Material changes will be notified in the app or by message
        before they take effect. Continuing to use the site after that means you accept them.
      </p>

      <h2>14. Law and disputes</h2>
      <p>
        Indian law applies. Courts at {LEGAL.jurisdiction} have jurisdiction. Before going to
        court, please raise the matter with our grievance officer — details on the{' '}
        <a href="/contact">contact page</a> — as most things are quicker to fix that way.
      </p>
    </>
  );
}
