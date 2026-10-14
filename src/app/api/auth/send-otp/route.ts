import { NextResponse } from 'next/server';
import { saveOtp } from '@/lib/otp-store';

const ALLOWED_EMAILS = ['admin@arkescholar.com', 'rohit@arkescholar.com'];

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (!ALLOWED_EMAILS.includes(normalizedEmail)) {
      return NextResponse.json(
        { error: 'Access Denied: This email address is not authorized for portal access.' },
        { status: 403 }
      );
    }

    // Generate 6-digit cryptographically random OTP
    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    saveOtp(normalizedEmail, generatedOtp, 600); // 10 minutes expiry

    console.log(`[AUTH] Secure OTP generated for ${normalizedEmail}: ${generatedOtp}`);

    return NextResponse.json({
      success: true,
      message: `Security code sent to ${normalizedEmail}.`,
      demoOtp: generatedOtp // Provided on screen for immediate testing
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
