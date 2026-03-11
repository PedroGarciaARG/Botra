import type { Conversation } from './types'

// Shared in-memory store for conversations
const conversationsStore: Map<string, Conversation> = new Map()

export function getConversation(id: string): Conversation | undefined {
  return conversationsStore.get(id)
}

export function setConversation(conversation: Conversation): void {
  conversationsStore.set(conversation.id, conversation)
}

export function getAllConversations(): Conversation[] {
  return Array.from(conversationsStore.values())
}

export function deleteConversation(id: string): void {
  conversationsStore.delete(id)
}
