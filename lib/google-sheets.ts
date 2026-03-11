function getGoogleScriptUrl(): string {
  const url = process.env.GOOGLE_SCRIPT_URL
  if (!url) {
    throw new Error('GOOGLE_SCRIPT_URL no está configurado. Por favor, configura la variable de entorno.')
  }
  return url
}

export async function getCode(sheetName: string): Promise<{ code?: string; row?: number; empty?: boolean; error?: string }> {
  const url = getGoogleScriptUrl()
  const response = await fetch(`${url}?action=getCode&sheet=${encodeURIComponent(sheetName)}`)
  
  if (!response.ok) {
    throw new Error(`Error getting code: ${response.statusText}`)
  }
  
  return response.json()
}

export async function markCodeDelivered(sheetName: string, row: number, orderId: string): Promise<{ ok: boolean; error?: string }> {
  const url = getGoogleScriptUrl()
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'markDelivered',
      sheet: sheetName,
      row,
      orderId,
      date: new Date().toISOString()
    })
  })
  
  if (!response.ok) {
    throw new Error(`Error marking delivered: ${response.statusText}`)
  }
  
  return response.json()
}

export async function getInventory(): Promise<{ counts: Record<string, { available: number; delivered: number }> }> {
  const url = getGoogleScriptUrl()
  const response = await fetch(`${url}?action=inventory`)
  
  if (!response.ok) {
    throw new Error(`Error getting inventory: ${response.statusText}`)
  }
  
  return response.json()
}

export async function getBotState(): Promise<{ enabled: boolean; activatedAt: string | null }> {
  const url = getGoogleScriptUrl()
  const response = await fetch(`${url}?action=getBotState`)
  
  if (!response.ok) {
    throw new Error(`Error getting bot state: ${response.statusText}`)
  }
  
  return response.json()
}

export async function setBotState(enabled: boolean, activatedAt: string | null): Promise<{ ok: boolean }> {
  const url = getGoogleScriptUrl()
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'setBotState',
      enabled,
      activatedAt
    })
  })
  
  if (!response.ok) {
    throw new Error(`Error setting bot state: ${response.statusText}`)
  }
  
  return response.json()
}

export async function addCodes(sheetName: string, codes: string[]): Promise<{ ok: boolean; added: number; error?: string }> {
  const url = getGoogleScriptUrl()
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'addCodes',
      sheet: sheetName,
      codes,
      date: new Date().toISOString()
    })
  })
  
  if (!response.ok) {
    throw new Error(`Error adding codes: ${response.statusText}`)
  }
  
  return response.json()
}
