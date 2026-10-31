import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { extractAndVerifyToken } from '@/lib/auth-token';

const cleanText = (value: unknown, max: number) => String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);

function cleanLogoUrl(value: unknown) {
  const url = cleanText(value, 500);
  if (!url) return '';
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol) ? url : '';
  } catch {
    return url.startsWith('/') ? url : '';
  }
}

export async function GET(req: Request) {
  const user = extractAndVerifyToken(req);
  if (!user) return NextResponse.json({ success: false, error: 'Administrator authentication is required.' }, { status: 401 });
  const { db } = await connectToDatabase();
  const profile = await db.collection('teacher_paper_profiles').findOne(
    { tenantId: user.tenantId, email: user.email },
    { projection: { _id: 0, instituteName: 1, logoUrl: 1, watermarkText: 1, showWatermark: 1, updatedAt: 1 } },
  );
  return NextResponse.json({ success: true, profile: profile || null });
}

export async function PUT(req: Request) {
  const user = extractAndVerifyToken(req);
  if (!user) return NextResponse.json({ success: false, error: 'Administrator authentication is required.' }, { status: 401 });
  const body = await req.json();
  const instituteName = cleanText(body?.instituteName, 120);
  const watermarkText = cleanText(body?.watermarkText, 80);
  const logoUrl = cleanLogoUrl(body?.logoUrl);
  if (!instituteName) return NextResponse.json({ success: false, error: 'Institute name is required.' }, { status: 400 });
  if (body?.logoUrl && !logoUrl) return NextResponse.json({ success: false, error: 'Logo must be an https URL or a site image path.' }, { status: 400 });
  const profile = { tenantId: user.tenantId, email: user.email, instituteName, logoUrl, watermarkText, showWatermark: body?.showWatermark !== false, updatedAt: new Date() };
  const { db } = await connectToDatabase();
  await db.collection('teacher_paper_profiles').updateOne({ tenantId: user.tenantId, email: user.email }, { $set: profile }, { upsert: true });
  return NextResponse.json({ success: true, profile });
}
