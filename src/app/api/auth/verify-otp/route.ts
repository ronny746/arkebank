import { NextResponse } from 'next/server';
import { verifyOtp } from '@/lib/otp-store';

export async function POST(req: Request) {
  try {
    const { email, otp } = await req.json();

    if (!email || !otp) {
      return NextResponse.json({ error: 'Email and OTP are required.' }, { status: 400 });
    }

    const isValid = verifyOtp(email, otp);

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid or expired OTP. Please try again or use 123456.' }, { status: 401 });
    }

    const name = email.split('@')[0].replace(/[._-]/g, ' ');
    const formattedName = name.charAt(0).toUpperCase() + name.slice(1);

    return NextResponse.json({
      success: true,
      message: 'Authentication successful!',
      user: {
        email: email.toLowerCase().trim(),
        name: formattedName,
        role: 'Verified Educator / Reviewer',
        avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(formattedName)}&backgroundColor=233876,0E8A44`
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
