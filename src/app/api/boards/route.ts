import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { extractAndVerifyToken } from '@/lib/auth-token';

const DEFAULT_STATE_BOARDS = ['UP Board', 'MP Board', 'Karnataka Board'];

export async function GET(req: Request) {
  const admin = extractAndVerifyToken(req);
  if (!admin) return NextResponse.json({ success: false, error: 'Administrator authentication is required.' }, { status: 401 });

  const { db } = await connectToDatabase();
  const configured = await db.collection('board_options')
    .find({ tenantId: admin.tenantId, category: 'state' }, { projection: { name: 1 } })
    .sort({ name: 1 })
    .toArray();
  const boards = Array.from(new Set([...DEFAULT_STATE_BOARDS, ...configured.map((board) => String(board.name || '').trim()).filter(Boolean)]));
  return NextResponse.json({ success: true, boards });
}

export async function POST(req: Request) {
  const admin = extractAndVerifyToken(req);
  if (!admin) return NextResponse.json({ success: false, error: 'Administrator authentication is required.' }, { status: 401 });

  const body = await req.json();
  const name = String(body?.name || '').trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 60) return NextResponse.json({ success: false, error: 'Enter a board name between 2 and 60 characters.' }, { status: 400 });

  const { db } = await connectToDatabase();
  await db.collection('board_options').updateOne(
    { tenantId: admin.tenantId, category: 'state', nameKey: name.toLowerCase() },
    { $setOnInsert: { tenantId: admin.tenantId, category: 'state', name, nameKey: name.toLowerCase(), createdBy: admin.email, createdAt: new Date() } },
    { upsert: true },
  );
  return NextResponse.json({ success: true, name });
}
