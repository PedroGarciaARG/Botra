const ML_API_URL = 'https://api.mercadolibre.com'

let cachedToken: { access_token: string; expires_at: number } | null = null

export async function getAccessToken(): Promise<string> {
  // Verificar si tenemos un token válido en caché
  if (cachedToken && Date.now() < cachedToken.expires_at) {
    return cachedToken.access_token
  }

  const response = await fetch('https://api.mercadolibre.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.ML_APP_ID!,
      client_secret: process.env.ML_CLIENT_SECRET!,
      refresh_token: process.env.ML_REFRESH_TOKEN!,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Error refreshing ML token: ${error}`)
  }

  const data = await response.json()
  
  // Guardar en caché con 5 minutos de margen
  cachedToken = {
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in - 300) * 1000
  }

  return data.access_token
}

export async function getMessages(packId: string) {
  const token = await getAccessToken()
  
  // Usar endpoint marketplace/messages/packs
  const response = await fetch(`${ML_API_URL}/marketplace/messages/packs/${packId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  
  if (!response.ok) {
    throw new Error(`Error fetching messages: ${response.statusText}`)
  }
  
  return response.json()
}

export async function sendMessage(packId: string, buyerId: string, text: string) {
  const token = await getAccessToken()
  const sellerId = await getSellerId()
  
  // Endpoint: POST /messages/packs/{pack_id}/sellers/{seller_id}
  // Con query param tag=post_sale y body con from, to, text
  const response = await fetch(`${ML_API_URL}/messages/packs/${packId}/sellers/${sellerId}?tag=post_sale`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'x-caller-id': sellerId,
    },
    body: JSON.stringify({
      from: { user_id: parseInt(sellerId) },
      to: { user_id: parseInt(buyerId) },
      text,
    }),
  })
  
  if (!response.ok) {
    const error = await response.text()
    console.error('[v0] ML sendMessage error:', error, 'packId:', packId, 'sellerId:', sellerId, 'buyerId:', buyerId)
    throw new Error(`Error sending message: ${error}`)
  }
  
  return response.json()
}

export async function getOrders(afterDate?: string) {
  const token = await getAccessToken()
  const sellerId = await getSellerId()
  
  let url = `${ML_API_URL}/orders/search?seller=${sellerId}&sort=date_desc`
  if (afterDate) {
    url += `&order.date_created.from=${afterDate}`
  }
  
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  
  if (!response.ok) {
    throw new Error(`Error fetching orders: ${response.statusText}`)
  }
  
  return response.json()
}

export async function getOrderMessages(orderId: string) {
  const token = await getAccessToken()
  
  const response = await fetch(`${ML_API_URL}/messages/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  
  if (!response.ok) {
    throw new Error(`Error fetching order messages: ${response.statusText}`)
  }
  
  return response.json()
}

export async function getSellerId(): Promise<string> {
  const token = await getAccessToken()
  
  const response = await fetch(`${ML_API_URL}/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  
  if (!response.ok) {
    throw new Error(`Error fetching user info: ${response.statusText}`)
  }
  
  const data = await response.json()
  return data.id.toString()
}

export async function getRecentConversations() {
  const token = await getAccessToken()
  
  const response = await fetch(`${ML_API_URL}/messages/unread?tag=post_sale`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  
  if (!response.ok) {
    throw new Error(`Error fetching conversations: ${response.statusText}`)
  }
  
  return response.json()
}

export async function getPacksByOrder(orderId: string) {
  const token = await getAccessToken()
  
  const response = await fetch(`${ML_API_URL}/messages/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  
  if (!response.ok) {
    return null
  }
  
  return response.json()
}

export async function sendTelegramNotification(message: string) {
  const telegramToken = process.env.TELEGRAM_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  
  if (!telegramToken || !chatId) return
  
  try {
    await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    })
  } catch (error) {
    console.error('Error sending Telegram notification:', error)
  }
}
