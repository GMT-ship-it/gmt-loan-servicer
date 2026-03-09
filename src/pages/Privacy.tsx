import React from 'react';
import { Link } from 'react-router-dom';

const Privacy = () => {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 p-8 font-sans">
      <div className="max-w-4xl mx-auto bg-slate-800 p-8 rounded-lg shadow-xl border border-teal-800">
        <Link to="/" className="text-teal-400 hover:text-teal-300 mb-8 inline-block">&larr; Back to Home</Link>
        
        <h1 className="text-3xl font-bold text-teal-400 mb-6">MOUNTAIN INVESTMENTS LLC - Privacy Policy</h1>
        <p className="mb-4"><strong>Effective Date:</strong> March 9, 2026</p>
        
        <div className="space-y-6 text-slate-300">
          <section>
            <h2 className="text-xl font-semibold text-teal-300 mb-2">1. Introduction</h2>
            <p>Mountain Investments LLC ("we," "us," or "our") is committed to protecting your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our platform at https://gmt-loan-servicer.lovable.app or use our loan servicing services.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-teal-300 mb-2">2. Information We Collect</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Identity Information:</strong> Name, date of birth, Social Security Number or Tax ID, government-issued ID.</li>
              <li><strong>Contact Information:</strong> Email address, phone number, mailing address.</li>
              <li><strong>Financial Information:</strong> Bank account details, credit history, loan application data, payment history, income documentation.</li>
              <li><strong>Technical Information:</strong> IP address, browser type, device identifiers, cookies, and usage data collected when you use our platform.</li>
              <li><strong>Communication Records:</strong> Emails, messages, and correspondence with our team.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-teal-300 mb-2">3. How We Use Your Information</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Process loan applications, disburse funds, and manage repayment schedules.</li>
              <li>Verify your identity and perform credit and background checks.</li>
              <li>Communicate with you about your account, payments, and loan status.</li>
              <li>Comply with applicable federal and state laws, including anti-money laundering (AML) and Know Your Customer (KYC) requirements.</li>
              <li>Improve our platform and services.</li>
              <li>Send operational notices and, where permitted, marketing communications.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-teal-300 mb-2">4. Sharing of Information</h2>
            <p className="mb-2">We do not sell your personal information. We may share your information with:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Service Providers:</strong> Third-party vendors who assist us in operating our platform (e.g., DocuSign for document execution, payment processors, cloud hosting providers).</li>
              <li><strong>Affiliates:</strong> Entities within the GMT Capital Group family of companies.</li>
              <li><strong>Legal and Regulatory Authorities:</strong> When required by law, court order, or regulatory obligation.</li>
              <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-teal-300 mb-2">5. Data Retention</h2>
            <p>We retain your personal information for as long as necessary to fulfill the purposes outlined in this policy, comply with legal obligations, resolve disputes, and enforce our agreements. Loan records are typically retained for a minimum of seven (7) years following loan closure.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-teal-300 mb-2">6. Security</h2>
            <p>We implement industry-standard technical and organizational measures to protect your information, including SSL/TLS encryption, role-based access controls, and secure cloud infrastructure. However, no method of transmission over the internet is completely secure.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-teal-300 mb-2">7. Your Rights</h2>
            <p>Depending on your state of residence, you may have the right to access, correct, or delete your personal information. To exercise these rights, contact us at the information below.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-teal-300 mb-2">8. Cookies</h2>
            <p>Our platform uses cookies and similar tracking technologies to enhance your experience. You may adjust your browser settings to refuse cookies, though some features may not function properly as a result.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-teal-300 mb-2">9. Third-Party Links</h2>
            <p>Our platform may contain links to third-party websites. We are not responsible for the privacy practices of those sites and encourage you to review their policies.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-teal-300 mb-2">10. Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time. We will notify you of material changes by posting the updated policy on our platform with a revised effective date.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-teal-300 mb-2">11. Contact Us</h2>
            <p>If you have questions about this Privacy Policy, please contact us at:</p>
            <p className="mt-2">
              <strong>Mountain Investments LLC</strong><br/>
              Houston, Texas<br/>
              Email: <a href="mailto:rafael.iglesias@gmtcapitalgroup.com" className="text-teal-400">rafael.iglesias@gmtcapitalgroup.com</a><br/>
              Website: <a href="https://gmt-loan-servicer.lovable.app" className="text-teal-400">https://gmt-loan-servicer.lovable.app</a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Privacy;
