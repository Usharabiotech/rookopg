import type { Metadata } from 'next';
import { LEGAL } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Privacy policy',
  description: `What ${LEGAL.brand} collects about you, why, who sees it, and how to get it removed.`,
};

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy policy</h1>

      <p>
        This explains what {LEGAL.entity} collects when you use {LEGAL.brand}, why, and what you
        can ask us to do about it. It is written to meet the Digital Personal Data Protection
        Act 2023.
      </p>

      <h2>What we collect</h2>

      <h3>If you are looking for a bed</h3>
      <ul>
        <li>
          <strong>Your mobile number</strong>, to sign you in and to verify you are a real
          person before you book.
        </li>
        <li>
          <strong>Your name</strong>, because the owner needs to know who is arriving.
        </li>
        <li>
          <strong>What you searched for</strong> — locality, budget, sharing type — to show
          results and to work out which areas we should cover next.
        </li>
        <li>
          <strong>Your bookings</strong>: which property, which bed, move-in date, what you
          paid.
        </li>
      </ul>

      <h3>If you own or manage a PG</h3>
      <ul>
        <li>Your name, mobile number and the business you represent.</li>
        <li>Property details and photographs you upload.</li>
        <li>
          <strong>Bank and settlement details</strong>, collected and held by our payment
          provider so your share of a booking can reach you.
        </li>
      </ul>

      <h3>What we do not hold</h3>
      <p>
        <strong>Card numbers, UPI PINs and bank credentials never reach our servers.</strong>{' '}
        Payments are handled by Razorpay, who are regulated for exactly this. We store their
        reference for a payment, the amount, and whether it succeeded.
      </p>

      <h2>Why we use it</h2>
      <ul>
        <li>To run a booking: hold a bed, take payment, tell the owner you are coming.</li>
        <li>To hold your money until you check in, and to refund it if you do not.</li>
        <li>To send you what a booking requires — confirmations, reminders, receipts.</li>
        <li>To keep the platform safe: spotting fake listings, fraud and abuse.</li>
        <li>To meet tax, accounting and other legal obligations.</li>
      </ul>
      <p>
        We do not sell your data. We do not share your number with owners you have not booked
        with or chosen to contact.
      </p>

      <h2>Who else sees it</h2>
      <ul>
        <li>
          <strong>The PG owner you book with</strong> — your name, your number and your move-in
          date. They need these to let you in.
        </li>
        <li>
          <strong>Razorpay</strong>, to take the payment, hold it and release or refund it.
        </li>
        <li>
          <strong>Messaging providers</strong>, to send the one-time password and booking
          messages to your number.
        </li>
        <li>
          <strong>Our hosting and storage providers</strong>, who keep the database and the
          photographs.
        </li>
        <li>
          <strong>Authorities</strong>, where the law requires it.
        </li>
      </ul>

      <h2>How long we keep it</h2>
      <p>
        Booking and payment records are kept as long as tax and accounting law requires, which
        in India is generally eight years. Your account details are kept while your account is
        open. Search history is kept for a short period and then aggregated so it no longer
        identifies you. Photographs are removed when the owner deletes them or closes the
        listing.
      </p>

      <h2>Your rights</h2>
      <p>You can ask us to:</p>
      <ul>
        <li>tell you what we hold about you,</li>
        <li>correct anything wrong,</li>
        <li>
          delete your account and data, except records we are legally required to retain, and
        </li>
        <li>nominate someone to act for you if you cannot.</li>
      </ul>
      <p>
        Write to {LEGAL.grievanceOfficer.email}. We will answer within{' '}
        {LEGAL.grievanceResolveDays} days.
      </p>

      <h2>Security</h2>
      <p>
        Sign-in codes are stored hashed, never in the clear. Sessions use tokens that rotate,
        so a stolen one stops working. Access to production data is limited to those who need
        it. No system is perfect; if we ever have a breach that affects you, we will tell you
        and the Data Protection Board.
      </p>

      <h2>Cookies</h2>
      <p>
        We use cookies to keep you signed in and to remember whether you chose the light or dark
        theme. We do not use advertising cookies or third-party trackers.
      </p>

      <h2>Children</h2>
      <p>
        The platform is not for under-18s and we do not knowingly collect their data. Tell us if
        you believe a child has an account and we will remove it.
      </p>

      <h2>Complaints</h2>
      <p>
        Our grievance officer, {LEGAL.grievanceOfficer.name}, can be reached at{' '}
        {LEGAL.grievanceOfficer.email}. We acknowledge within {LEGAL.grievanceAckHours} hours and
        resolve within {LEGAL.grievanceResolveDays} days. If you remain unsatisfied you may
        complain to the Data Protection Board of India.
      </p>
    </>
  );
}
