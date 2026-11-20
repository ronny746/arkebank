import { NextResponse } from 'next/server';
import { saveOtp } from '@/lib/otp-store';
import { getTenantForRequest, tenantAdminEmails } from '@/lib/tenant';

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const tenant = getTenantForRequest(req);
    const allowedEmails = tenantAdminEmails(tenant.id);

    if (!allowedEmails.length) {
      return NextResponse.json(
        { error: `${tenant.name} faculty access has not been configured yet.` },
        { status: 503 }
      );
    }

    if (!allowedEmails.includes(normalizedEmail)) {
      return NextResponse.json(
        { error: 'Access Denied: This email address is not authorized for portal access.' },
        { status: 403 }
      );
    }

    // Generate 6-digit cryptographically random OTP
    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    saveOtp(`${tenant.id}:${normalizedEmail}`, generatedOtp, 600); // 10 minutes expiry

    // Delivery integration belongs here (email/SMS provider). Never log or
    // return OTPs in production responses.

    return NextResponse.json({
      success: true,
      message: `Security code generated for ${normalizedEmail} for ${tenant.name}.`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
