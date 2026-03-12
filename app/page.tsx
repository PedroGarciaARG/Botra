"use client"

import { useState, useEffect, useCallback } from "react"
import Image from "next/image"
import { Power, MessageSquare, Package, RefreshCw, AlertTriangle, Check, Clock, User, Bot, Plus, X, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Conversation, BotState, Inventory } from "@/lib/types"

export default function Dashboard() {
  const [botState, setBotState] = useState<BotState>({ enabled: false, activatedAt: null })
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [inventory, setInventory] = useState<Inventory>({})
  const [openChats, setOpenChats] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [loadingAll, setLoadingAll] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const [showAddCodesModal, setShowAddCodesModal] = useState(false)
  const [newCodesSheet, setNewCodesSheet] = useState("")
  const [newCodes, setNewCodes] = useState("")
  const [addingCodes, setAddingCodes] = useState(false)
  const [autoSync, setAutoSync] = useState(false)

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString('es-AR')
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 99)])
  }, [])

  const fetchBotState = useCallback(async () => {
    try {
      const res = await fetch('/api/bot-state')
      const data = await res.json()
      setBotState(data)
    } catch {
      addLog('Error al obtener estado del bot')
    }
  }, [addLog])

  const fetchInventory = useCallback(async () => {
    try {
      const res = await fetch('/api/inventory')
      const data = await res.json()
      setInventory(data.counts || {})
    } catch {
      addLog('Error al obtener inventario')
    }
  }, [addLog])

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/conversations')
      const data = await res.json()
      setConversations(data.conversations || [])
    } catch {
      addLog('Error al obtener conversaciones')
    }
  }, [addLog])

  const toggleBot = async () => {
    const newState = !botState.enabled
    const activatedAt = newState ? new Date().toISOString() : null
    
    try {
      await fetch('/api/bot-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newState, activatedAt })
      })
      setBotState({ enabled: newState, activatedAt })
      addLog(newState ? 'Bot ACTIVADO' : 'Bot DESACTIVADO')
    } catch {
      addLog('Error al cambiar estado del bot')
    }
  }

  const syncMessages = async () => {
    setSyncing(true)
    addLog('Sincronizando mensajes...')
    try {
      const res = await fetch('/api/sync', { method: 'POST' })
      const data = await res.json()
      if (data.error) {
        addLog(`Error: ${data.error}`)
      } else {
        addLog(`Sync completado: ${data.processed || 0} de ${data.total || 0} ordenes`)
        if (data.conversations && data.conversations.length > 0) {
          setConversations(data.conversations)
        }
      }
    } catch {
      addLog('Error en sincronización')
    }
    setSyncing(false)
  }

  const loadAllConversations = async () => {
    setLoadingAll(true)
    addLog('Cargando todas las conversaciones recientes...')
    try {
      const res = await fetch('/api/sync', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loadAll: true })
      })
      const data = await res.json()
      if (data.error) {
        addLog(`Error: ${data.error}`)
      } else {
        addLog(`Cargadas ${data.processed || 0} conversaciones de ${data.total || 0} ordenes`)
        if (data.conversations && data.conversations.length > 0) {
          setConversations(data.conversations)
        }
      }
    } catch {
      addLog('Error al cargar conversaciones')
    }
    setLoadingAll(false)
  }

  const openChat = (conversation: Conversation) => {
    if (!openChats.find(c => c.id === conversation.id)) {
      setOpenChats(prev => [...prev, conversation])
    }
  }

  const closeChat = (conversationId: string) => {
    setOpenChats(prev => prev.filter(c => c.id !== conversationId))
  }

  const handleAddCodes = async () => {
    if (!newCodesSheet || !newCodes.trim()) {
      addLog('Selecciona un producto e ingresa al menos un código')
      return
    }

    setAddingCodes(true)
    const codesArray = newCodes.split('\n').map(c => c.trim()).filter(c => c.length > 0)
    
    try {
      const res = await fetch('/api/add-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetName: newCodesSheet, codes: codesArray })
      })
      const data = await res.json()
      
      if (data.error) {
        addLog(`Error al agregar códigos: ${data.error}`)
      } else {
        addLog(`Se agregaron ${data.added || codesArray.length} códigos a ${newCodesSheet}`)
        setNewCodes('')
        setNewCodesSheet('')
        setShowAddCodesModal(false)
        await fetchInventory()
      }
    } catch {
      addLog('Error al agregar códigos')
    }
    setAddingCodes(false)
  }

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await Promise.all([fetchBotState(), fetchInventory(), fetchConversations()])
      setLoading(false)
      addLog('Dashboard inicializado')
    }
    init()
  }, [fetchBotState, fetchInventory, fetchConversations, addLog])

  // Auto-sync cada 5 segundos cuando está activado
  useEffect(() => {
    if (!autoSync || !botState.enabled) return
    
    let isMounted = true
    let timeoutId: NodeJS.Timeout
    
    const doSync = async () => {
      if (!isMounted) return
      
      try {
        const controller = new AbortController()
        const timeoutAbort = setTimeout(() => controller.abort(), 30000) // 30s timeout
        
        const res = await fetch('/api/sync', { 
          method: 'POST',
          signal: controller.signal
        })
        clearTimeout(timeoutAbort)
        
        if (!isMounted) return
        
        const data = await res.json()
        if (data.conversations && data.conversations.length > 0) {
          setConversations(data.conversations)
          setOpenChats(prev => prev.map(chat => {
            const updated = data.conversations.find((c: Conversation) => c.id === chat.id)
            return updated || chat
          }))
        }
        if (data.messagesEnviados > 0) {
          addLog(`Bot envió ${data.messagesEnviados} mensaje(s)`)
        }
      } catch (err) {
        if (isMounted && err instanceof Error && err.name !== 'AbortError') {
          console.error('[v0] Auto-sync error:', err)
        }
      }
      
      // Schedule next sync
      if (isMounted) {
        timeoutId = setTimeout(doSync, 5000)
      }
    }
    
    // Start first sync immediately
    doSync()
    
    return () => {
      isMounted = false
      clearTimeout(timeoutId)
    }
  }, [autoSync, botState.enabled, addLog])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Image src="/images/logo.jpg" alt="Roblox Argentina" width={120} height={120} className="rounded-xl" priority />
          <div className="animate-pulse text-muted-foreground">Cargando...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Image src="/images/logo.jpg" alt="Roblox Argentina" width={48} height={48} className="rounded-lg" priority />
            <div>
              <h1 className="text-xl font-bold text-foreground">Gift Card Bot</h1>
              <p className="text-sm text-muted-foreground">Roblox Argentina OK</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Bot</span>
              <Switch checked={botState.enabled} onCheckedChange={toggleBot} />
              <Badge variant={botState.enabled ? "default" : "secondary"} className={botState.enabled ? "bg-green-600" : ""}>
                {botState.enabled ? "ACTIVO" : "INACTIVO"}
              </Badge>
            </div>
            <div className="flex items-center gap-2 border-l border-border pl-4">
              <span className="text-sm text-muted-foreground">Auto</span>
              <Switch 
                checked={autoSync} 
                onCheckedChange={setAutoSync}
                disabled={!botState.enabled}
              />
              <Badge variant={autoSync && botState.enabled ? "default" : "secondary"} className={autoSync && botState.enabled ? "bg-blue-600" : ""}>
                {autoSync && botState.enabled ? "5s" : "OFF"}
              </Badge>
            </div>
            <Button variant="outline" size="sm" onClick={loadAllConversations} disabled={loadingAll || syncing}>
              <MessageSquare className={`h-4 w-4 mr-2`} />
              {loadingAll ? 'Cargando...' : 'Cargar Todas'}
            </Button>
            <Button variant="outline" size="sm" onClick={syncMessages} disabled={syncing || loadingAll}>
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              Sincronizar
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Panel Izquierdo - Stats e Inventario */}
          <div className="space-y-6">
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Power className="h-4 w-4" />
                  Estado del Sistema
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground text-sm">Bot</span>
                    <Badge variant={botState.enabled ? "default" : "secondary"} className={botState.enabled ? "bg-green-600" : ""}>
                      {botState.enabled ? "Activo" : "Inactivo"}
                    </Badge>
                  </div>
                  {botState.activatedAt && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground text-sm">Activado</span>
                      <span className="text-xs">{new Date(botState.activatedAt).toLocaleString('es-AR')}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground text-sm">Conversaciones</span>
                    <span className="font-medium">{conversations.length}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Inventario de Códigos
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={() => setShowAddCodesModal(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Agregar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(inventory).map(([name, data]) => (
                    <div key={name} className="flex justify-between items-center">
                      <span className="text-sm">{name}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant={data.available > 0 ? "default" : "destructive"} className={data.available > 0 ? "bg-green-600" : ""}>
                          {data.available} disp.
                        </Badge>
                        <Badge variant="secondary">{data.delivered} entreg.</Badge>
                      </div>
                    </div>
                  ))}
                  {Object.keys(inventory).length === 0 && (
                    <p className="text-muted-foreground text-sm text-center py-4">
                      Sin datos de inventario
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Logs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-48">
                  <div className="space-y-1">
                    {logs.map((log, i) => (
                      <p key={i} className="text-xs text-muted-foreground font-mono">{log}</p>
                    ))}
                    {logs.length === 0 && (
                      <p className="text-muted-foreground text-sm text-center py-4">Sin logs</p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Panel Central - Conversaciones */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="active" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="active">Activas</TabsTrigger>
                <TabsTrigger value="completed">Completadas</TabsTrigger>
                <TabsTrigger value="paused">Pausadas</TabsTrigger>
                <TabsTrigger value="claims" className="text-red-500">Mediación</TabsTrigger>
              </TabsList>

              <TabsContent value="active" className="mt-4">
                <ConversationList
                  conversations={conversations.filter(c => !c.flowFinished && !c.sellerResponded && !c.hasClaim)}
                  onSelect={openChat}
                />
              </TabsContent>

              <TabsContent value="completed" className="mt-4">
                <ConversationList
                  conversations={conversations.filter(c => c.flowFinished && !c.hasClaim)}
                  onSelect={openChat}
                />
              </TabsContent>

              <TabsContent value="paused" className="mt-4">
                <ConversationList
                  conversations={conversations.filter(c => c.sellerResponded && !c.flowFinished && !c.hasClaim)}
                  onSelect={openChat}
                  showPausedWarning
                />
              </TabsContent>

              <TabsContent value="claims" className="mt-4">
                <ConversationList
                  conversations={conversations.filter(c => c.hasClaim)}
                  onSelect={openChat}
                  showClaimWarning
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>

      {/* Ventanas de chat abiertas */}
      <div className="fixed bottom-4 right-4 flex flex-row-reverse items-end gap-3 z-50">
        {openChats.map((chat, index) => (
          <div
            key={chat.id}
            className="w-80 bg-card border border-border rounded-lg shadow-2xl flex flex-col"
            style={{ maxHeight: 'calc(100vh - 100px)' }}
          >
            <div className="flex items-center justify-between p-3 border-b border-border bg-muted/50 rounded-t-lg">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{chat.buyerNickname}</p>
                <p className="text-xs text-muted-foreground truncate">{chat.productTitle}</p>
              </div>
              <div className="flex items-center gap-2 ml-2">
                {chat.codeDelivered && <Check className="h-4 w-4 text-green-500" />}
                {chat.hasClaim && <AlertTriangle className="h-4 w-4 text-red-500" />}
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => closeChat(chat.id)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex gap-1 px-3 py-1 border-b border-border">
              <Badge variant="outline" className="text-xs">{chat.state}</Badge>
              {chat.codeDelivered && <Badge className="bg-green-600 text-xs">Entregado</Badge>}
              {chat.sellerResponded && <Badge variant="destructive" className="text-xs">Pausado</Badge>}
            </div>
            <div className="h-[350px] overflow-y-auto p-3 space-y-3">
              {chat.messages.map((msg, msgIndex) => (
                <div
                  key={`${msg.id}-${msgIndex}`}
                  className={`flex gap-2 ${msg.from === 'buyer' ? '' : 'justify-end'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg px-3 py-2 text-xs ${
                      msg.from === 'buyer'
                        ? 'bg-secondary text-secondary-foreground'
                        : msg.from === 'bot'
                        ? 'bg-blue-600 text-white'
                        : 'bg-green-600 text-white'
                    }`}
                  >
                    <div className="flex items-center gap-1 mb-1 opacity-70 text-[10px]">
                      {msg.from === 'buyer' ? (
                        <><User className="h-3 w-3" /> Comprador</>
                      ) : msg.from === 'bot' ? (
                        <><Bot className="h-3 w-3" /> Bot</>
                      ) : (
                        <><User className="h-3 w-3" /> Vendedor</>
                      )}
                    </div>
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                    <p className="text-[10px] opacity-50 mt-1">
                      {new Date(msg.date).toLocaleString('es-AR')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Modal para agregar códigos */}
      <Dialog open={showAddCodesModal} onOpenChange={setShowAddCodesModal}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Agregar Gift Cards
            </DialogTitle>
            <DialogDescription>
              Agrega nuevos códigos de gift cards al inventario. Un código por línea.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="product">Producto</Label>
              <Select value={newCodesSheet} onValueChange={setNewCodesSheet}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar producto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Roblox 5 USD">Roblox 5 USD</SelectItem>
                  <SelectItem value="Roblox 10 USD">Roblox 10 USD</SelectItem>
                  <SelectItem value="400 Robux">400 Robux</SelectItem>
                  <SelectItem value="800 Robux">800 Robux</SelectItem>
                  <SelectItem value="Steam 5 USD">Steam 5 USD</SelectItem>
                  <SelectItem value="Steam 10 USD">Steam 10 USD</SelectItem>
                  <SelectItem value="Steam 20 USD">Steam 20 USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="codes">Códigos (uno por línea)</Label>
              <Textarea
                id="codes"
                placeholder="XXXX-XXXX-XXXX&#10;YYYY-YYYY-YYYY&#10;ZZZZ-ZZZZ-ZZZZ"
                value={newCodes}
                onChange={(e) => setNewCodes(e.target.value)}
                rows={6}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                {newCodes.split('\n').filter(c => c.trim()).length} códigos a agregar
              </p>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setShowAddCodesModal(false)} disabled={addingCodes}>
                <X className="h-4 w-4 mr-1" />
                Cancelar
              </Button>
              <Button onClick={handleAddCodes} disabled={addingCodes || !newCodesSheet || !newCodes.trim()}>
                {addingCodes ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                    Agregando...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-1" />
                    Agregar Códigos
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ConversationList({
  conversations,
  selected,
  onSelect,
  showPausedWarning = false,
  showClaimWarning = false
}: {
  conversations: Conversation[]
  onSelect: (c: Conversation) => void
  showPausedWarning?: boolean
  showClaimWarning?: boolean
}) {
  if (conversations.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="py-8 text-center text-muted-foreground">
          <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No hay conversaciones</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-2">
      {showPausedWarning && (
        <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-500 text-sm">
          <AlertTriangle className="h-4 w-4" />
          Estas conversaciones fueron pausadas porque el vendedor respondió manualmente
        </div>
      )}
      {showClaimWarning && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm">
          <AlertTriangle className="h-4 w-4" />
          Estas conversaciones tienen reclamos o mediaciones abiertas
        </div>
      )}
      {conversations.map((conversation) => (
        <Card
          key={conversation.id}
          className={`bg-card border-border cursor-pointer transition-colors hover:bg-accent ${conversation.hasClaim ? 'border-red-500/50' : ''}`}
          onClick={() => onSelect(conversation)}
        >
          <CardContent className="py-3">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-medium text-sm">{conversation.buyerNickname}</p>
                <p className="text-xs text-muted-foreground truncate max-w-xs">
                  {conversation.productTitle}
                </p>
                {conversation.hasClaim && (
                  <Badge variant="destructive" className="mt-1 text-xs">
                    {conversation.orderStatus || 'Reclamo'}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {conversation.codeDelivered ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Clock className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-xs text-muted-foreground">
                  {new Date(conversation.lastMessageDate).toLocaleTimeString('es-AR')}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
