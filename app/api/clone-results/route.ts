import { NextRequest, NextResponse } from 'next/server';
import { saveCloneResult } from '@/lib/storage/clone-history';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, model, files, explanation } = body;

    if (!url || !model || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ success: false, error: 'url, model, and files are required' }, { status: 400 });
    }

    const result = await saveCloneResult({ url, model, files, explanation });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('[clone-results] Failed to save clone result:', error);
    return NextResponse.json({ success: false, error: 'Failed to save clone result' }, { status: 500 });
  }
}
