import { NextResponse } from 'next/server'
import { getAllConversations, setConversation, deleteConversation as removeConversation } from '@/lib/conversation-store'

export async function GET() {
  const conversations = getAllConversations()
    .sort((a, b) => new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime())
  
  return NextResponse.json({ conversations })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { action, conversation } = body
    
    if (action === 'update' && conversation) {
      setConversation(conversation)
      return NextResponse.json({ ok: true })
    }
    
    if (action === 'delete' && body.id) {
      removeConversation(body.id)
      return NextResponse.json({ ok: true })
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Error managing conversations:', error)
    return NextResponse.json({ error: 'Failed to manage conversation' }, { status: 500 })
  }
}
