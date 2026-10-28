import { NextRequest, NextResponse } from 'next/server';
import { getCloneHistory, recordCloneAction, type CloneActionRecord } from '@/lib/storage/clone-history';

export async function GET() {
  try {
    return NextResponse.json({ success: true, actions: await getCloneHistory() });
  } catch (error) {
    console.error('[clone-history] Failed to read history:', error);
    return NextResponse.json({ success: false, error: 'Unable to read clone history' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const input = await request.json() as Omit<CloneActionRecord, 'id' | 'createdAt'>;
    if (!input.url || !input.model || !['started', 'success', 'failed'].includes(input.result)) {
      return NextResponse.json({ success: false, error: 'url, model, and a valid result are required' }, { status: 400 });
    }
    const record: CloneActionRecord = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    await recordCloneAction(record);
    return NextResponse.json({ success: true, action: record });
  } catch (error) {
    console.error('[clone-history] Failed to write history:', error);
    return NextResponse.json({ success: false, error: 'Unable to write clone history' }, { status: 500 });
  }
}
