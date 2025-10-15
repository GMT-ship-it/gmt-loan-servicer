import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  applicantEmail: string;
  applicantName: string;
  companyName: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { applicantEmail, applicantName, companyName }: EmailRequest = await req.json();

    console.log('Sending application emails for:', companyName);

    // Send confirmation email to applicant
    const applicantEmailResponse = await resend.emails.send({
      from: "Mountain Investments <onboarding@resend.dev>",
      to: [applicantEmail],
      subject: "Application Received - Mountain Investments",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb;">Application Received</h1>
          <p>Dear ${applicantName},</p>
          <p>Thank you for your interest in financing from Mountain Investments.</p>
          <p>We have received your application for <strong>${companyName}</strong> and our team is currently reviewing it.</p>
          <p><strong>Next Steps:</strong></p>
          <ul>
            <li>Our team will review your application within 2 business days</li>
            <li>You'll receive an email with login credentials once approved</li>
            <li>If we need additional information, we'll reach out directly</li>
          </ul>
          <p>If you have any questions, please don't hesitate to contact us.</p>
          <p>Best regards,<br>The Mountain Investments Team</p>
        </div>
      `,
    });

    console.log("Applicant email sent:", applicantEmailResponse);

    // Send notification to admin
    // Note: Replace with actual admin email
    const adminEmailResponse = await resend.emails.send({
      from: "Mountain Investments <onboarding@resend.dev>",
      to: ["admin@example.com"], // TODO: Replace with actual admin email
      subject: `New Application: ${companyName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb;">New Borrower Application</h1>
          <p>A new application has been submitted:</p>
          <ul>
            <li><strong>Company:</strong> ${companyName}</li>
            <li><strong>Contact:</strong> ${applicantName}</li>
            <li><strong>Email:</strong> ${applicantEmail}</li>
          </ul>
          <p>Please review the application in the admin portal.</p>
          <p><a href="https://yourapp.lovable.app/admin" style="display: inline-block; padding: 10px 20px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 5px;">View in Admin Portal</a></p>
        </div>
      `,
    });

    console.log("Admin email sent:", adminEmailResponse);

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error sending emails:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
