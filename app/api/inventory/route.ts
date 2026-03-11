import { NextResponse } from 'next/server'
import { getInventory } from '@/lib/google-sheets'

export async function GET() {
  try {
    const inventory = await getInventory()
    return NextResponse.json(inventory)
  } catch (error) {
    console.error('Error getting inventory:', error)
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
    return NextResponse.json({ 
      counts: {}, 
      error: errorMessage,
      envConfigured: !!process.env.GOOGLE_SCRIPT_URL
    })
  }
}
