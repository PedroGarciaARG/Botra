import { NextResponse } from 'next/server'
import { getBotState } from '@/lib/google-sheets'

// This endpoint can be called by:
// - Vercel Cron (automatic)
// - External cron service like cron-job.org (for Netlify)
// It triggers the sync process automatically ONLY if bot is enabled

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  // Optional: verify with CRON_SECRET if configured
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // Allow without auth if no secret is set (for easy setup)
    if (cronSecret !== '') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    // Check if bot is enabled FIRST
    const botState = await getBotState()
    if (!botState.enabled) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        message: 'Bot is disabled',
        timestamp: new Date().toISOString()
      })
    }
    
    // Get the base URL from the request
    const url = new URL(request.url)
    const baseUrl = `${url.protocol}//${url.host}`
    
    // Call the sync endpoint
    const response = await fetch(`${baseUrl}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    
    const data = await response.json()
    
    console.log('[v0] Cron sync completed:', data.processed, 'conversations,', data.messagesEnviados, 'messages sent')
    
    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      processed: data.processed || 0,
      messagesEnviados: data.messagesEnviados || 0,
      total: data.total || 0
    })
  } catch (error) {
    console.error('[v0] Cron sync error:', error)
    return NextResponse.json({ 
      ok: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}
