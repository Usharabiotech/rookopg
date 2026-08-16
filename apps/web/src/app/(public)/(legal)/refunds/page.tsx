import type { Metadata } from 'next';
import { LEGAL } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Cancellation and refunds',
  description:
    'When you get your money back, how much, and how long it takes. Your money is held until you check in.',
};

export default function RefundsPage() {
  return (
    <>
      <h1>Cancellation and refunds</h1>

      <p>
        The short version: <strong>we hold your money until you check in</strong>, so until you
        actually walk into the building, almost everything is still refundable.
      </p>

      <h2>Nothing is charged until you pay</h2>
      <p>
        Searching, viewing a listing and starting a booking cost nothing. A bed is held briefly
        while you pay; if you abandon the payment, the hold lapses and you are charged nothing.
      </p>

      <h2>Where your money sits</h2>
      <p>
        When you pay, the amount is held by our payment provider. It is{' '}
        <strong>not released to the PG owner until you check in</strong> at the building. This is
        deliberate: if an owner has forgotten to update their availability and the bed is gone
        when you arrive, the money has not moved and can be returned to you.
      </p>

      <h2>If you cancel</h2>
      <table>
        <thead>
          <tr>
            <th>When you cancel</th>
            <th>First month&apos;s rent</th>
            <th>Security deposit</th>
            <th>Booking fee</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>More than 7 days before move-in</td>
            <td>Refunded in full</td>
            <td>Refunded in full</td>
            <td>Not refunded</td>
          </tr>
          <tr>
            <td>2 to 7 days before move-in</td>
            <td>Half refunded</td>
            <td>Refunded in full</td>
            <td>Not refunded</td>
          </tr>
          <tr>
            <td>Less than 48 hours before, or you never arrive</td>
            <td>Kept by the owner</td>
            <td>Refunded in full</td>
            <td>Not refunded</td>
          </tr>
          <tr>
            <td>After you have checked in</td>
            <td>Not refunded</td>
            <td>Returned by the owner when you leave</td>
            <td>Not refunded</td>
          </tr>
        </tbody>
      </table>
      <p>
        The reasoning: the owner took the bed off the market for you, so the closer to the date
        you cancel, the more of that loss is real. The deposit is different — it secures damage
        during a stay that never happened, so it comes back. The booking fee is what we charged
        to run the booking, and that work was done.
      </p>

      <h2>If the owner cancels, or the bed is not there</h2>
      <p>
        <strong>You get everything back, including the booking fee.</strong> That covers an owner
        declining your booking, an owner cancelling after accepting, and you arriving to find the
        bed taken or the property materially different from its listing.
      </p>
      <p>
        Tell us within 48 hours of arriving if the property is not as listed. We will ask the
        owner for their account, and if we are not satisfied we refund you.
      </p>

      <h2>The security deposit after you move in</h2>
      <p>
        Once you have checked in, the deposit is held by the owner, not by us. They return it
        when you leave, less anything they are entitled to deduct for damage or unpaid dues. We
        cannot force an owner to return it, but tell us if one does not: we will take it up, and
        an owner who does this repeatedly is removed from the platform.
      </p>

      <h2>How long a refund takes</h2>
      <p>
        We start a refund as soon as the cancellation is confirmed. It reaches the method you
        paid with in {LEGAL.refundWorkingDays}, depending on your bank. Refunds always go back to
        the original payment method — we cannot send them somewhere else.
      </p>

      <h2>Rent after the first month</h2>
      <p>
        Paid to the owner directly, not through us, so it is between you and them. This page
        covers only money that passed through the platform.
      </p>

      <h2>Something gone wrong?</h2>
      <p>
        Write to {LEGAL.supportEmail} or use the{' '}
        <a href="/contact">contact page</a>. We acknowledge within {LEGAL.grievanceAckHours}{' '}
        hours and resolve within {LEGAL.grievanceResolveDays} days.
      </p>
    </>
  );
}
