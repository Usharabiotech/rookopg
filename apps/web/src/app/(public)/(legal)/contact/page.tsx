import type { Metadata } from 'next';
import { LEGAL } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Contact us',
  description: `How to reach ${LEGAL.brand}, and how to escalate a complaint that is not being resolved.`,
};

export default function ContactPage() {
  return (
    <>
      <h1>Contact us</h1>

      <h2>Support</h2>
      <p>
        For anything to do with a booking, a payment or a refund:
        <br />
        Email: {LEGAL.supportEmail}
        <br />
        Phone: {LEGAL.supportPhone}
      </p>
      <p>
        Have your booking reference to hand — it is on the booking page and in the message we
        sent you.
      </p>

      <h2>Grievance officer</h2>
      <p>
        Appointed under the Information Technology (Intermediary Guidelines and Digital Media
        Ethics Code) Rules 2021, the Consumer Protection (E-Commerce) Rules 2020, and the Digital
        Personal Data Protection Act 2023.
      </p>
      <p>
        {LEGAL.grievanceOfficer.name}
        <br />
        Email: {LEGAL.grievanceOfficer.email}
        <br />
        Phone: {LEGAL.grievanceOfficer.phone}
      </p>
      <p>
        We acknowledge a complaint within {LEGAL.grievanceAckHours} hours and resolve it within{' '}
        {LEGAL.grievanceResolveDays} days. Please try support first — the officer is for
        complaints that support has not resolved.
      </p>

      <h2>Registered office</h2>
      <p>
        {LEGAL.entity}
        <br />
        {LEGAL.address}
        {LEGAL.cin ? (
          <>
            <br />
            CIN: {LEGAL.cin}
          </>
        ) : null}
        {LEGAL.gstin ? (
          <>
            <br />
            GSTIN: {LEGAL.gstin}
          </>
        ) : null}
      </p>

      <h2>Reporting a listing</h2>
      <p>
        If a listing is inaccurate, is not a real property, or shows photographs that are not of
        the building, tell us at {LEGAL.supportEmail} with the listing link. We investigate and
        take listings down where the complaint holds.
      </p>

      <h2>If you are still not satisfied</h2>
      <p>
        You may approach the National Consumer Helpline on 1915 or at consumerhelpline.gov.in, or
        the consumer commission with jurisdiction over you. For a complaint about how we handle
        your personal data, you may approach the Data Protection Board of India.
      </p>
    </>
  );
}
