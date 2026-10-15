import { NextResponse } from 'next/server';
import { verifyOtp } from '@/lib/otp-store';
import { signToken } from '@/lib/auth-token';

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

    // Generate cryptographic token valid for 7 days
    const token = signToken(normalizedEmail);

    const userObj = {
      email: normalizedEmail,
      name: displayName,
      role: 'Verified Administrator',
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(displayName)}&backgroundColor=1F3268,0E8A44`
    };

    const response = NextResponse.json({
      success: true,
      message: 'Authentication successful!',
      token,
      user: userObj
    });

    // Set secure HTTP-only cookie
    response.cookies.set('arke_session_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 3600,
      path: '/'
    });

    return response;
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
