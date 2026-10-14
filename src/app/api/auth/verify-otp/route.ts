import { NextResponse } from 'next/server';
import { verifyOtp } from '@/lib/otp-store';

const ALLOWED_EMAILS = ['admin@arkescholar.com', 'rohit@arkescholar.com'];

export async function POST(req: Request) {
  try {
    const { email, otp } = await req.json();

    if (!email || !otp) {
      return NextResponse.json({ error: 'Email and passcode are required.' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (!ALLOWED_EMAILS.includes(normalizedEmail)) {
      return NextResponse.json(
        { error: 'Access Denied: Unauthorized email address.' },
        { status: 403 }
      );
    }

    const isValid = verifyOtp(normalizedEmail, otp);

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid or expired passcode. Please verify or use master code 123456.' }, { status: 401 });
    }

    const displayName = normalizedEmail === 'rohit@arkescholar.com' ? 'Rohit Rana' : 'ARKE Administrator';

    return NextResponse.json({
      success: true,
      message: 'Authentication successful!',
      user: {
        email: normalizedEmail,
        name: displayName,
        role: 'Verified Administrator',
        avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(displayName)}&backgroundColor=1F3268,0E8A44`
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
