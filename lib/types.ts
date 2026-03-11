export interface Conversation {
  id: string
  packId: string
  orderId: string
  buyerId: string
  buyerNickname: string
  productTitle: string
  state: ConversationState
  codeDelivered: boolean
  flowFinished: boolean
  finalResponseSent: boolean
  code?: string
  codeRow?: number
  sheetName?: string
  sellerResponded: boolean
  lastMessageDate: string
  messages: Message[]
  hasClaim: boolean
  orderStatus?: string
}

export interface Message {
  id: string
  from: 'buyer' | 'seller' | 'bot'
  text: string
  date: string
}

export type ConversationState =
  | 'inicio'
  | 'esperando_login'
  | 'esperando_confirmacion'
  | 'esperando_opcion'
  | 'flujo_finalizado'

export interface BotState {
  enabled: boolean
  activatedAt: string | null
}

export interface InventoryItem {
  available: number
  delivered: number
}

export interface Inventory {
  [key: string]: InventoryItem
}

export interface ProductConfig {
  sheetName: string
  displayName: string
  type: 'roblox-usd' | 'roblox-robux' | 'steam'
  amount: string
  keywords: string[]
}

export const PRODUCT_CONFIGS: ProductConfig[] = [
  {
    sheetName: 'Roblox 5 USD',
    displayName: 'Roblox 5 USD',
    type: 'roblox-usd',
    amount: '5 USD',
    keywords: ['roblox', '5', 'usd']
  },
  {
    sheetName: 'Roblox 10 USD',
    displayName: 'Roblox 10 USD',
    type: 'roblox-usd',
    amount: '10 USD',
    keywords: ['roblox', '10', 'usd']
  },
  {
    sheetName: '400 Robux',
    displayName: 'Roblox 400 Robux',
    type: 'roblox-robux',
    amount: '400 Robux',
    keywords: ['400', 'robux']
  },
  {
    sheetName: '800 Robux',
    displayName: 'Roblox 800 Robux',
    type: 'roblox-robux',
    amount: '800 Robux',
    keywords: ['800', 'robux']
  },
  {
    sheetName: 'Steam 5 USD',
    displayName: 'Steam 5 USD',
    type: 'steam',
    amount: '5 USD',
    keywords: ['steam', '5']
  },
  {
    sheetName: 'Steam 10 USD',
    displayName: 'Steam 10 USD',
    type: 'steam',
    amount: '10 USD',
    keywords: ['steam', '10']
  },
  {
    sheetName: 'Steam 20 USD',
    displayName: 'Steam 20 USD',
    type: 'steam',
    amount: '20 USD',
    keywords: ['steam', '20']
  }
]

export const LOGIN_KEYWORDS = [
  'ok', 'listo', 'ya', 'ya estoy', 'ya estoy logueado', 'logueado',
  'ya entré', 'entre', 'ingrese', 'ingresé', 'confirmo', 'confirmado',
  'ya pude', 'dale', 'si', 'sí', 'bueno', 'perfecto', 'hecho'
]

export const OPTION_1_KEYWORDS = ['1', 'robux', '500', 'uno']
export const OPTION_2_KEYWORDS = ['2', 'premium', 'suscribirme', 'suscripción', 'dos']
