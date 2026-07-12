import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";

export const metadata = {
  title: "Privacy Policy | Kodara",
  description: "How Kodara collects, uses, and protects personal data under Kenya's Data Protection Act, 2019.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[17px] font-semibold tracking-tight text-foreground">{title}</h2>
      <div className="flex flex-col gap-3 text-[14px] leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border/40 px-4 py-5 sm:px-6">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2.5 text-foreground">
            <LogoMark className="h-6 w-6" />
            <span className="text-[16px] font-bold tracking-tight">Kodara</span>
          </Link>
          <Link href="/login" className="text-[13px] font-medium text-primary hover:text-primary/80">
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto flex max-w-2xl flex-col gap-10 px-4 py-12 sm:px-6">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Legal
          </p>
          <h1 className="text-[30px] font-bold tracking-tight text-foreground">Privacy policy</h1>
          <p className="text-[13px] text-muted-foreground">Last updated 12 July 2026.</p>
        </div>

        <Section title="Who we are">
          <p>
            Kodara (&quot;we&quot;, &quot;us&quot;) provides software that lets Kenyan landlords collect rent via
            M-Pesa and manage properties, tenants, and maintenance. Kodara is a data controller
            for the account and business data described below, and a data processor for tenant
            personal data that landlords collect through the platform, under the Data Protection
            Act, 2019.
          </p>
        </Section>

        <Section title="What we collect">
          <p>Depending on whether you use Kodara as a landlord or a tenant, we process:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Account details: full name, email or phone number, and password.</li>
            <li>Property and tenancy records: properties, units, rent amounts, and billing dates.</li>
            <li>
              Payment records: M-Pesa transaction identifiers, phone numbers, amounts, and
              timestamps needed to reconcile rent payments.
            </li>
            <li>
              Tax records, where a landlord connects eTIMS: KRA PIN and registered device
              identifiers, used solely to issue that landlord&apos;s own rent invoices to KRA.
            </li>
            <li>Maintenance requests and photos submitted by tenants.</li>
          </ul>
        </Section>

        <Section title="Why we process it">
          <p>
            We process this data to operate the core service: matching M-Pesa payments to the
            correct tenancy, showing landlords their portfolio in real time, routing maintenance
            requests, and, where a landlord has connected their KRA credentials, issuing that
            landlord&apos;s legally required rent invoices. We do not sell personal data, and we do
            not use tenant data for advertising.
          </p>
        </Section>

        <Section title="Who we share it with">
          <p>
            Payment data is shared with Safaricom to process M-Pesa transactions. Where a
            landlord connects eTIMS, invoice data is shared with the Kenya Revenue Authority
            under that landlord&apos;s own KRA registration. We do not share personal data with any
            other third party except where required by law.
          </p>
        </Section>

        <Section title="How we protect it">
          <p>
            Every landlord and tenant can only reach their own data — this is enforced at the
            database layer, not just in the app, so a request crafted to bypass the interface
            still can&apos;t reach another account&apos;s records. Payment and tax credentials are stored
            encrypted and are never visible to us in plain text after you enter them.
          </p>
        </Section>

        <Section title="Your rights">
          <p>Under the Data Protection Act, 2019, you can ask us to:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Confirm what personal data we hold about you and provide a copy of it.</li>
            <li>Correct inaccurate or outdated data.</li>
            <li>Delete data we no longer have a lawful reason to keep.</li>
            <li>Object to or restrict specific processing.</li>
          </ul>
          <p>
            To exercise any of these rights, contact us at{" "}
            <a href="mailto:privacy@kodara.app" className="font-medium text-primary hover:text-primary/80">
              privacy@kodara.app
            </a>
            .
          </p>
        </Section>

        <Section title="Data retention">
          <p>
            We retain tenancy and payment records for as long as an account is active and for a
            reasonable period after, to satisfy landlords&apos; own tax and record-keeping
            obligations. You can request deletion of your account data at any time, subject to
            records we are required to keep by law.
          </p>
        </Section>

        <Section title="Contact and breach notification">
          <p>
            If you have a concern about how your data is handled, or believe your data may have
            been affected by a security incident, contact{" "}
            <a href="mailto:privacy@kodara.app" className="font-medium text-primary hover:text-primary/80">
              privacy@kodara.app
            </a>
            . You may also lodge a complaint with the Office of the Data Protection Commissioner
            of Kenya.
          </p>
        </Section>
      </main>
    </div>
  );
}
