import { NextResponse } from 'next/server'
import { getAccessToken, sendMessage, sendTelegramNotification } from '@/lib/mercadolibre'
import { getCode, markCodeDelivered, getBotState } from '@/lib/google-sheets'
import { setConversation, getAllConversations, getConversation } from '@/lib/conversation-store'
import type { Conversation, Message, ConversationState } from '@/lib/types'

const ML_API = 'https://api.mercadolibre.com'

// Keywords para detectar confirmación del usuario
const CONFIRMATION_KEYWORDS = [
  'ok', 'listo', 'ya', 'dale', 'si', 'sí', 'confirmo', 'confirmado', 
  'entre', 'entré', 'logueado', 'ya estoy', 'ya pude', 'aviso', 'avisame',
  'buenas', 'hola', 'buen', 'gracias', 'perfecto', 'recibir', 'codigo', 'código',
  'quiero', 'espero', 'listo', 'bien', 'bueno'
]
const OPTION_1_KEYWORDS = ['1', 'robux', '500', 'uno']
const OPTION_2_KEYWORDS = ['2', 'premium', 'suscri']

function detectProduct(title: string): { name: string; sheet: string; type: string; amount: string } | null {
  const t = title.toLowerCase()
  
  if (t.includes('roblox') || t.includes('robux')) {
    // Detectar USD primero (más específico) - buscar "X usd" o "X dolar"
    if ((t.includes('10') && (t.includes('usd') || t.includes('dolar') || t.includes('dólar'))) || 
        (t.includes('10 usd'))) {
      return { name: 'Roblox 10 USD', sheet: 'Roblox 10 USD', type: 'roblox-usd', amount: '10 USD' }
    }
    if ((t.includes('5') && (t.includes('usd') || t.includes('dolar') || t.includes('dólar'))) ||
        (t.includes('5 usd'))) {
      return { name: 'Roblox 5 USD', sheet: 'Roblox 5 USD', type: 'roblox-usd', amount: '5 USD' }
    }
    // Luego detectar Robux específicos (sin USD en el título)
    if (t.includes('800') && !t.includes('usd')) return { name: '800 Robux', sheet: '800 Robux', type: 'roblox-robux', amount: '800 Robux' }
    if (t.includes('400') && !t.includes('usd')) return { name: '400 Robux', sheet: '400 Robux', type: 'roblox-robux', amount: '400 Robux' }
  }
  
  if (t.includes('steam')) {
    if (t.includes('20')) return { name: 'Steam 20 USD', sheet: 'steam-20', type: 'steam', amount: '20 USD' }
    if (t.includes('10')) return { name: 'Steam 10 USD', sheet: 'steam-10', type: 'steam', amount: '10 USD' }
    if (t.includes('5')) return { name: 'Steam 5 USD', sheet: 'steam-5', type: 'steam', amount: '5 USD' }
  }
  
  return null
}

function containsKeyword(text: string, keywords: string[]): boolean {
  const t = text.toLowerCase().trim()
  return keywords.some(kw => t.includes(kw.toLowerCase()))
}

// Helper para delay entre mensajes
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const loadAll = body.loadAll === true
    
    // Verificar estado del bot
    const botState = await getBotState()
    const botEnabled = botState.enabled
    const activatedAt = botState.activatedAt ? new Date(botState.activatedAt) : null
    
    const token = await getAccessToken()
    
    // Get seller ID
    const meRes = await fetch(`${ML_API}/users/me`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    const me = await meRes.json()
    const sellerId = me.id.toString()
    
    // Get recent orders
    const fromDate = loadAll 
      ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      : activatedAt?.toISOString() || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    
    const ordersRes = await fetch(
      `${ML_API}/orders/search?seller=${sellerId}&order.date_created.from=${fromDate}&sort=date_desc&limit=50`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const ordersData = await ordersRes.json()
    const orders = ordersData.results || []
    
    let processed = 0
    let messagesEnviados = 0
    
    for (const order of orders) {
      try {
        const orderId = order.id.toString()
        const packId = (order.pack_id || order.id).toString()
        const buyerId = order.buyer?.id?.toString() || ''
        const buyerNickname = order.buyer?.nickname || 'Comprador'
        const productTitle = order.order_items?.[0]?.item?.title || order.payments?.[0]?.reason || 'Producto'
        const orderDate = new Date(order.date_created)
        const orderStatus = order.status || ''
        
        // Check claims
        const hasClaim = orderStatus.toLowerCase().includes('claim') || 
                         orderStatus.toLowerCase().includes('cancel') ||
                         order.tags?.some((t: string) => t.toLowerCase().includes('claim'))
        
        // Detect product
        const product = detectProduct(productTitle)
        if (!product) continue
        
        // Get existing conversation state
        let conversation = getConversation(packId)
        
        // Get messages
        let mlMessages: Array<{ from: { user_id: number }; text: string; date_created: string; id?: string }> = []
        try {
          const messagesRes = await fetch(
            `${ML_API}/messages/packs/${packId}/sellers/${sellerId}?tag=post_sale`,
            { headers: { Authorization: `Bearer ${token}` } }
          )
          const messagesData = await messagesRes.json()
          mlMessages = messagesData.messages || []
        } catch {
          // Continue with empty messages
        }
        
        // Count seller messages from ML API
        const sellerMessagesFromML = mlMessages.filter(m => m.from.user_id.toString() === sellerId)
        const buyerMessagesFromML = mlMessages.filter(m => m.from.user_id.toString() !== sellerId)
        
        console.log('[v0] Pack:', packId, 'Seller msgs:', sellerMessagesFromML.length, 'Buyer msgs:', buyerMessagesFromML.length, 'State:', conversation?.state || 'nuevo')
        
        // Never mark as sellerRespondedManually - we trust the bot
        const sellerRespondedManually = false
        
        // Convert all messages - mark all seller messages as 'bot' for display
        // (we track manual intervention separately via sellerRespondedManually flag)
        const messages: Message[] = mlMessages.map((m, idx) => {
          const isSeller = m.from.user_id.toString() === sellerId
          return {
            id: m.id || `${m.date_created}-${idx}`,
            from: isSeller ? 'bot' as const : 'buyer' as const,
            text: m.text || '',
            date: m.date_created
          }
        }).reverse()
        
        // Get last buyer message
        const lastBuyerMessage = [...messages].reverse().find(m => m.from === 'buyer')
        
        // Initialize or update conversation
        if (!conversation) {
          // Derive state from ML messages instead of starting from scratch
          // If there are already bot messages, we're past 'inicio'
          let derivedState: ConversationState = 'inicio'
          if (sellerMessagesFromML.length > 0) {
            // Bot already sent messages, so we're waiting for confirmation
            derivedState = 'esperando_confirmacion'
          }
          
          conversation = {
            id: packId,
            orderId,
            packId,
            buyerId,
            buyerNickname,
            productTitle,
            state: derivedState,
            codeDelivered: false,
            flowFinished: false,
            finalResponseSent: false,
            sellerResponded: sellerRespondedManually,
            lastMessageDate: messages[messages.length - 1]?.date || order.date_created,
            messages: [],
            sheetName: product.sheet,
            hasClaim,
            orderStatus
          }
          
          console.log('[v0] New conversation created with derived state:', derivedState)
        }
        
        // Merge ML messages with our stored bot messages count for tracking
        // Keep the bot message count in sync
        conversation.messages = messages
        conversation.sellerResponded = sellerRespondedManually
        
        // If seller responded manually, don't process further
        if (sellerRespondedManually) {
          setConversation(conversation)
          processed++
          continue
        }
        conversation.hasClaim = hasClaim
        conversation.lastMessageDate = messages[messages.length - 1]?.date || order.date_created
        
        // Skip if has claim
        if (hasClaim) {
          setConversation(conversation)
          processed++
          continue
        }
        
        // Skip if bot disabled or order before activation
        if (!botEnabled || (activatedAt && orderDate < activatedAt)) {
          setConversation(conversation)
          processed++
          continue
        }
        
        // BOT LOGIC - Process flow based on state
        const state = conversation.state
        
        // Count bot messages from ML
        const currentBotMessagesCount = sellerMessagesFromML.length
        
        // For date comparison, use the last message from ANYONE to determine if there's new activity
        // This fixes the issue where bot messages sent locally aren't yet in ML
        const allMessagesOrdered = [...mlMessages].sort((a, b) => 
          new Date(a.date_created).getTime() - new Date(b.date_created).getTime()
        )
        const lastMessageInML = allMessagesOrdered[allMessagesOrdered.length - 1]
        const lastMessageIsBuyer = lastMessageInML && lastMessageInML.from.user_id.toString() !== sellerId
        
        // Debug: log last message details
        if (lastMessageInML) {
          console.log('[v0] LastMsg from:', lastMessageInML.from.user_id, 'sellerId:', sellerId, 'text:', (lastMessageInML.text || '').substring(0, 30))
        }
        
        console.log('[v0] State:', state, 'LastMsgIsBuyer:', lastMessageIsBuyer, 'BotMsgs:', currentBotMessagesCount)
        
        // ESTADO: inicio - Enviar mensaje inicial de bienvenida
        if (state === 'inicio' && currentBotMessagesCount === 0) {
          const initialMessages = getInitialMessages(product)
          
          for (const msg of initialMessages) {
            try {
              await sendMessage(packId, buyerId, msg)
              conversation.messages.push({
                id: `bot-${Date.now()}`,
                from: 'bot',
                text: msg,
                date: new Date().toISOString()
              })
              messagesEnviados++
              await delay(3000) // 3 segundos entre mensajes
            } catch (err) {
              console.error('Error sending message:', err)
            }
          }
          
          conversation.state = 'esperando_confirmacion'
          
          await sendTelegramNotification(
            `🆕 Nueva venta!\n` +
            `👤 ${buyerNickname}\n` +
            `📦 ${productTitle}\n` +
            `🔗 Pack: ${packId}`
          )
        }
        
        // ESTADO: esperando_confirmacion - Usuario debe confirmar que está logueado
        else if (state === 'esperando_confirmacion' && lastBuyerMessage) {
          // Check if buyer has sent a NEW message after bot messages
          // If there are buyer messages and the last overall message isn't from buyer,
          // it means we already processed this and responded - skip
          const hasBuyerMessages = buyerMessagesFromML.length > 0
          
          console.log('[v0] esperando_confirmacion - hasBuyerMessages:', hasBuyerMessages, 'lastBuyerMsg:', lastBuyerMessage?.text)
          console.log('[v0] containsKeyword:', containsKeyword(lastBuyerMessage.text, CONFIRMATION_KEYWORDS))
          
          // Process if there's a buyer message with confirmation keyword
          if (hasBuyerMessages && containsKeyword(lastBuyerMessage.text, CONFIRMATION_KEYWORDS)) {
            // Obtener código
            const codeResult = await getCode(product.sheet)
            
            if (codeResult.empty || !codeResult.code) {
              // Sin stock
              const noStockMsg = `Hola, ¡muchas gracias por tu compra! 😊\n\nEn unos momentos un asesor se comunicará para entregarte la gift card.\n\nDisculpá las molestias y gracias por tu paciencia.`
              await sendMessage(packId, buyerId, noStockMsg)
              conversation.messages.push({
                id: `bot-${Date.now()}`,
                from: 'bot',
                text: noStockMsg,
                date: new Date().toISOString()
              })
              conversation.state = 'sin_stock'
              
              await sendTelegramNotification(
                `⚠️ SIN STOCK!\n` +
                `👤 ${buyerNickname}\n` +
                `📦 ${productTitle}\n` +
                `🔗 Pack: ${packId}`
              )
            } else {
              // Entregar código
              const deliveryMessages = getCodeDeliveryMessages(product, codeResult.code)
              
              for (const msg of deliveryMessages) {
                try {
                  await sendMessage(packId, buyerId, msg)
                  conversation.messages.push({
                    id: `bot-${Date.now()}`,
                    from: 'bot',
                    text: msg,
                    date: new Date().toISOString()
                  })
                  messagesEnviados++
                  await delay(3000)
                } catch (err) {
                  console.error('Error sending message:', err)
                }
              }
              
              // Marcar código como entregado
              if (codeResult.row) {
                await markCodeDelivered(product.sheet, codeResult.row, orderId)
              }
              
              conversation.code = codeResult.code
              conversation.codeRow = codeResult.row
              conversation.codeDelivered = true
              conversation.state = product.type === 'roblox-usd' ? 'esperando_opcion' : 'codigo_entregado'
              
              await sendTelegramNotification(
                `✅ Código entregado!\n` +
                `👤 ${buyerNickname}\n` +
                `📦 ${productTitle}\n` +
                `🎁 ${codeResult.code}`
              )
            }
          }
        }
        
        // ESTADO: esperando_opcion - Solo para Roblox USD (elegir Robux o Premium)
        else if (state === 'esperando_opcion' && lastBuyerMessage && lastMessageIsBuyer) {
            let optionMsg = ''
            
            if (containsKeyword(lastBuyerMessage.text, OPTION_1_KEYWORDS)) {
              optionMsg = `Perfecto 👍\nPara comprar 500 Robux:\n1️⃣ Ingresá a\nhttps://www.roblox.com/es/upgrades/robux\n2️⃣ Elegí el paquete de 500 Robux por USD 4.99\n3️⃣ En método de pago seleccioná\n✔ Pagar con crédito de Roblox\n\n❗ No hace falta ingresar nuevamente el código, porque el saldo ya quedó cargado en tu cuenta cuando lo canjeaste.`
            } else if (containsKeyword(lastBuyerMessage.text, OPTION_2_KEYWORDS)) {
              optionMsg = `Perfecto 👍\nPara contratar Roblox Premium:\n1️⃣ Ingresá a\nhttps://www.roblox.com/premium/membership\n2️⃣ Elegí el plan de USD 4.99\n3️⃣ En método de pago seleccioná\n✔ Pagar con crédito de Roblox\n\n❗ No hace falta ingresar nuevamente el código, porque el saldo ya quedó cargado en tu cuenta cuando lo canjeaste.\nRecibirás 450 Robux.`
            }
            
            if (optionMsg) {
              await sendMessage(packId, buyerId, optionMsg)
              conversation.messages.push({
                id: `bot-${Date.now()}`,
                from: 'bot',
                text: optionMsg,
                date: new Date().toISOString()
              })
              messagesEnviados++
              
              await delay(3000)
              
              // Mensaje final
              const finalMsg = `❗Ya tenés tu Gift Card Digital! Que la disfrutes!\n\nTe pedimos que en cuanto recibas la tarjeta, confirmes en ML para que podamos seguir trabajando.\n\nQuedamos a tu disposición! 🤝\nSomos Roblox_Argentina_ok\n\n❕Te dejamos nuestro contacto para que puedas agendarnos y aprovechar nuestras promos:\n1138201597 📱`
              await sendMessage(packId, buyerId, finalMsg)
              conversation.messages.push({
                id: `bot-${Date.now()}`,
                from: 'bot',
                text: finalMsg,
                date: new Date().toISOString()
              })
              
              conversation.state = 'finalizado'
              conversation.flowFinished = true
            }
        }
        
        // ESTADO: codigo_entregado - Para Robux y Steam, enviar mensaje final
        else if (state === 'codigo_entregado' && !conversation.flowFinished) {
          await delay(3000)
          
          const finalMsg = `❗Ya tenés tu Gift Card Digital! Que la disfrutes!\n\nTe pedimos que en cuanto recibas la tarjeta, confirmes en ML para que podamos seguir trabajando.\n\nQuedamos a tu disposición! 🤝\nSomos Roblox_Argentina_ok\n\n❕Te dejamos nuestro contacto para que puedas agendarnos y aprovechar nuestras promos:\n1138201597 📱`
          await sendMessage(packId, buyerId, finalMsg)
          conversation.messages.push({
            id: `bot-${Date.now()}`,
            from: 'bot',
            text: finalMsg,
            date: new Date().toISOString()
          })
          
          conversation.state = 'finalizado'
          conversation.flowFinished = true
        }
        
        // ESTADO: finalizado - Si escriben de nuevo, responder una vez
        else if (state === 'finalizado' && !conversation.finalResponseSent && lastBuyerMessage && lastMessageIsBuyer) {
            const followUpMsg = `¡Muchas gracias por tu compra! Si tienes alguna duda, un asesor te atenderá en breve. 😊`
            await sendMessage(packId, buyerId, followUpMsg)
            conversation.messages.push({
              id: `bot-${Date.now()}`,
              from: 'bot',
              text: followUpMsg,
              date: new Date().toISOString()
            })
            conversation.finalResponseSent = true
        }
        
        setConversation(conversation)
        processed++
        
      } catch (err) {
        console.error('Error processing order:', err)
      }
    }
    
    // Return all conversations
    const conversations = getAllConversations()
      .sort((a, b) => new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime())
    
    return NextResponse.json({ 
      processed, 
      total: orders.length,
      messagesEnviados,
      conversations 
    })
    
  } catch (error) {
    console.error('Sync error:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Error de sincronización',
      processed: 0 
    }, { status: 500 })
  }
}

// Helper functions for messages
function getInitialMessages(product: { type: string; amount: string; name: string }): string[] {
  if (product.type === 'roblox-usd') {
    return [
      `Hola, ¡muchas gracias por tu compra! 😊\nTe voy a compartir las indicaciones para canjear tu Gift Card.`,
      `La Gift Card que adquiriste se activa en 2 pasos:\n1️⃣ Primero vas a canjear el código por ${product.amount} en tu cuenta de Roblox.\n(no aparecen automáticamente los Robux, sino los ${product.amount})\n2️⃣ Luego, con esos ${product.amount} podés comprar Robux o suscribirte a Premium.`,
      `🔑 ¿CÓMO CANJEAR?\n1️⃣ Ingresá a\nwww.roblox.com/redeem\n(desde un navegador web, NO desde la app)\n2️⃣ Iniciá sesión con el usuario donde querés cargar los Robux.`,
      `Cuando estés logueado en la cuenta correcta, avisame por acá y te envío el código de tu Gift Card. 😊`
    ]
  }

  if (product.type === 'roblox-robux') {
    return [
      `Hola, ¡muchas gracias por tu compra! 😊\nTe voy a compartir las indicaciones para canjear tu Gift Card de ${product.amount}.`,
      `🔑 ¿CÓMO CANJEAR TU TARJETA?\n\n1️⃣ Ingresá a:\nwww.roblox.com/redeem\n\n2️⃣ Iniciá sesión con el usuario donde querés cargar los Robux.\n\n⚠️ Recomendamos hacerlo desde un navegador web (Chrome, Edge, etc.), no desde la app.\n\nCuando estés listo para recibir el código avisame por acá. 👍`
    ]
  }

  // Steam
  return [
    `Hola, ¡muchas gracias por tu compra! 😊\nTe voy a compartir las indicaciones para canjear tu Gift Card de Steam.`,
    `🔑 ¿CÓMO CANJEAR TU TARJETA DE STEAM?\n\n1️⃣ Ingresá a:\nhttps://store.steampowered.com/account/redeemwalletcode\n\n2️⃣ Iniciá sesión en tu cuenta de Steam.\n\n⚠️ Recomendamos hacerlo desde un navegador web (Chrome, Edge, etc.), no desde la app, para evitar errores.\n\nCuando estés listo para recibir el código avisame por acá. 👍`
  ]
}

function getCodeDeliveryMessages(product: { type: string; amount: string }, code: string): string[] {
  if (product.type === 'roblox-usd') {
    return [
      `Perfecto 👍\nTe comparto tu Gift Card.\n\n🎁 CÓDIGO:\n${code}\n\nIngresalo en:\nwww.roblox.com/redeem\n\nCuando lo ingreses se acreditarán ${product.amount} en tu cuenta.`,
      `Con esos ${product.amount} ahora podés elegir:\n1️⃣ Comprar 500 Robux directamente\no\n2️⃣ Suscribirte a Roblox Premium (450 Robux)\n\nRespondé 1 o 2 y te paso las indicaciones.`
    ]
  }

  if (product.type === 'roblox-robux') {
    return [
      `Perfecto 👍\nTe comparto tu Gift Card.\n\n🎁 CÓDIGO:\n${code}\n\nIngresalo en:\nwww.roblox.com/redeem\n\nUna vez ingresado se acreditarán ${product.amount} automáticamente en tu cuenta. 🎮`
    ]
  }

  // Steam
  return [
    `Perfecto 👍\nTe comparto tu Gift Card.\n\n🎁 CÓDIGO:\n${code}\n\nIngresalo en:\nhttps://store.steampowered.com/account/redeemwalletcode\n\nUna vez ingresado, el saldo se acreditará automáticamente en tu billetera de Steam.`
  ]
}

export async function GET() {
  const conversations = getAllConversations()
    .sort((a, b) => new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime())
  return NextResponse.json({ conversations })
}
