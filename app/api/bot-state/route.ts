import { NextResponse } from 'next/server'
import { getBotState, setBotState } from '@/lib/google-sheets'

export async function GET() {
  try {
    const state = await getBotState()
    return NextResponse.json(state)
  } catch (error) {
    console.error('Error getting bot state:', error)
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
    return NextResponse.json({ 
      enabled: false, 
      activatedAt: null,
      error: errorMessage,
      envConfigured: !!process.env.GOOGLE_SCRIPT_URL
    })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { enabled, activatedAt } = body
    
    await setBotState(enabled, activatedAt)
    
    return NextResponse.json({ ok: true, enabled, activatedAt })
  } catch (error) {
    console.error('Error setting bot state:', error)
    return NextResponse.json({ error: 'Failed to set bot state' }, { status: 500 })
  }
}
