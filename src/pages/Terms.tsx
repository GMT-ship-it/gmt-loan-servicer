import React from 'react';
import { Link } from 'react-router-dom';

const Terms = () => {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 p-8 font-sans">
      <div className="max-w-4xl mx-auto bg-slate-800 p-8 rounded-lg shadow-xl border border-teal-800">
        <Link to="/" className="text-teal-400 hover:text-teal-300 mb-8 inline-block">&larr; Back to Home</Link>
        
        <h1 className="text-3xl font-bold text-teal-400 mb-6">MOUNTAIN INVESTMENTS LLC - Terms of Use</h1>
        <p className="mb-4"><strong>Effective Date:</strong> March 9, 2026</p>
        
        <div className="space-y-6 text-slate-300">
          <section>
            <h2 className="text-xl font-semibold text-teal-300 mb-2">1. Acceptance of Terms</h2>
            <p>By accessing or using the Mountain Investments LLC platform at https://gmt-loan-servicer.lovable.app (the "Platform"), you agree to be bound by these Terms of Use. If you do not agree, do not use the Platform.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-teal-300 mb-2">2. Eligibility</h2>
            <p>You must be at least 18 years of age and legally capable of entering into binding contracts to use this Platform. By using the Platform, you represent and warrant that you meet these requirements.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-teal-300 mb-2">3. Platform Use</h2>
            <p className="mb-2">The Platform is provided solely for the purpose of accessing loan servicing information, submitting loan applications, executing loan agreements, and managing your account with Mountain Investments LLC. You agree not to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Use the Platform for any unlawful purpose.</li>
              <li>Attempt to gain unauthorized access to any part of the Platform or its related systems.</li>
              <li>Transmit any harmful, offensive, or disruptive content.</li>
              <li>Misrepresent your identity or provide false information in connection with a loan application.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-teal-300 mb-2">4. Accounts and Access</h2>
            <p>You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. Notify us immediately at the contact information below if you suspect unauthorized access to your account.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-teal-300 mb-2">5. Loan Agreements</h2>
            <p>Any loan agreement executed through the Platform, including those executed via DocuSign or other electronic signature platforms, constitutes a legally binding contract. You agree that electronic signatures have the same legal effect as handwritten signatures under applicable law, including the Electronic Signatures in Global and National Commerce Act (E-SIGN Act).</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-teal-300 mb-2">6. Intellectual Property</h2>
            <p>All content on the Platform, including text, graphics, logos, and software, is the property of Mountain Investments LLC or its licensors and is protected by applicable intellectual property laws. You may not reproduce, distribute, or create derivative works without our express written consent.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-teal-300 mb-2">7. Disclaimer of Warranties</h2>
            <p className="uppercase">The Platform is provided "AS IS" and "AS AVAILABLE" without warranties of any kind, express or implied. We do not warrant that the Platform will be uninterrupted, error-free, or free of viruses or other harmful components.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-teal-300 mb-2">8. Limitation of Liability</h2>
            <p className="uppercase">To the fullest extent permitted by law, Mountain Investments LLC and its affiliates shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Platform or services.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-teal-300 mb-2">9. Indemnification</h2>
            <p>You agree to indemnify and hold harmless Mountain Investments LLC, its officers, directors, employees, and agents from any claims, damages, or expenses arising from your use of the Platform, violation of these Terms, or infringement of any third-party rights.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-teal-300 mb-2">10. Governing Law</h2>
            <p>These Terms of Use shall be governed by and construed in accordance with the laws of the State of Texas, without regard to its conflict of law principles. Any disputes shall be resolved in the state or federal courts located in Harris County, Texas.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-teal-300 mb-2">11. Modifications</h2>
            <p>We reserve the right to modify these Terms of Use at any time. Changes will be effective upon posting to the Platform. Your continued use of the Platform after changes are posted constitutes your acceptance of the revised Terms.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-teal-300 mb-2">12. Contact Us</h2>
            <p>If you have questions about these Terms of Use, please contact us at:</p>
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

export default Terms;
