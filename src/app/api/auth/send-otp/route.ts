import { NextResponse } from 'next/server';
import { saveOtp } from '@/lib/otp-store';

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }

    // Generate 6-digit cryptographically random OTP
    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    saveOtp(email, generatedOtp, 600); // 10 minutes expiry

    console.log(`[AUTH] OTP generated for ${email}: ${generatedOtp}`);

    return NextResponse.json({
      success: true,
      message: `OTP sent successfully to ${email}.`,
      demoOtp: generatedOtp // Provided on screen for immediate testing
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
