import { NextResponse } from 'next/server';
import { extractAndVerifyToken } from '@/lib/auth-token';
import { getTenantForRequest } from '@/lib/tenant';

export async function POST(req: Request) {
  const user = extractAndVerifyToken(req);
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const tenant = getTenantForRequest(req);
  if (tenant.id !== 'prepzo' || tenant.id !== user.tenantId) {
    return NextResponse.json({ success: false, error: 'The active portal does not match the PREPZO tenant.' }, { status: 403 });
  }

  const targetUrl = process.env.PREPZO_IMPORT_URL;
  const sharedSecret = process.env.PREPZO_IMPORT_SHARED_SECRET;
  if (!targetUrl || !sharedSecret) {
    return NextResponse.json({ success: false, error: 'PREPZO upload is not configured on this server.' }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.paper?.id || !body?.paper?.title || !Array.isArray(body.paper.questions) || body.paper.questions.length === 0) {
    return NextResponse.json({ success: false, error: 'A saved paper with questions is required.' }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-prepzo-import-secret': sharedSecret },
      body: JSON.stringify({ sourceTenant: 'prepzo', sourcePaperId: String(body.paper.id), paper: body.paper }),
      signal: controller.signal,
      cache: 'no-store',
    });
    const result = await response.json().catch(() => ({ success: false, message: 'PREPZO returned an invalid response.' }));
    if (!response.ok) return NextResponse.json({ success: false, error: result.message || result.error || 'PREPZO upload failed.' }, { status: response.status });
    return NextResponse.json(result, { status: response.status });
  } catch (error: any) {
    const message = error?.name === 'AbortError' ? 'PREPZO upload timed out. Please retry.' : error?.message || 'Could not reach PREPZO.';
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
