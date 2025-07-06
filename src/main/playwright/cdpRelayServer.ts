/**
 * @fileoverview
 * This file implements the CDP (Chrome DevTools Protocol) Relay Server.
 * It acts as a bridge between the PromptHub backend (acting as a Playwright client)
 * and a dedicated Chrome Extension. This architecture allows PromptHub to control
 * a user's regular browser instance, thus bypassing many common bot detection mechanisms.
 *
 * Inspired by and adapted from the playwright-mcp project.
 *
 * Core Logic:
 * 1. A WebSocket server is started with two distinct paths:
 *    - `/cdp`: For the PromptHub backend to connect to.
 *    - `/extension`: For the PromptHub Chrome Extension to connect to.
 * 2. When the backend sends a CDP command, the relay forwards it to the extension.
 * 3. The extension uses the `chrome.debugger` API to execute the command in the browser.
 * 4. When the browser emits a CDP event, the extension captures it and sends it back to the relay.
 * 5. The relay then forwards the event to the PromptHub backend.
 */

import { WebSocket, WebSocketServer } from 'ws'
import http from 'node:http'

// Temporary logger to avoid import issues.
// TODO: Replace with the standard project logger once the architecture is integrated.
const logger = {
  info: (...args: any[]) => console.log('[INFO]', ...args),
  warn: (...args: any[]) => console.warn('[WARN]', ...args),
  error: (...args: any[]) => console.error('[ERROR]', ...args)
}

const CDP_PATH = '/cdp'
const EXTENSION_PATH = '/extension'

type CDPCommand = {
  id: number
  sessionId?: string
  method: string
  params?: any
}

type CDPResponse = {
  id?: number
  sessionId?: string
  method?: string
  params?: any
  result?: any
  error?: { code?: number; message: string }
}

export class CDPRelayServer {
  private _wss: WebSocketServer
  private _playwrightSocket: WebSocket | null = null
  private _extensionConnection: ExtensionConnection | null = null
  private _connectionInfo:
    | {
        targetInfo: any
        // Page sessionId that should be used by this connection.
        sessionId: string
      }
    | undefined

  // --- Start of new properties for waiting mechanism ---
  private _extensionConnectedPromise: Promise<void>
  private _resolveExtensionConnected!: () => void
  // --- End of new properties ---

  constructor(server: http.Server) {
    this._wss = new WebSocketServer({ server })
    this._wss.on('connection', this._onConnection.bind(this))
    this._resetConnectionPromise() // Initialize the promise
  }

  // --- Start of new method ---
  private _resetConnectionPromise(): void {
    this._extensionConnectedPromise = new Promise((resolve) => {
      this._resolveExtensionConnected = resolve
    })
    logger.info('[CDPRelay] Now waiting for a new extension connection.')
  }
  // --- End of new method ---

  public stop(): void {
    this._playwrightSocket?.close()
    this._extensionConnection?.close()
  }

  private _onConnection(ws: WebSocket, request: http.IncomingMessage): void {
    const url = new URL(`http://localhost${request.url}`)
    logger.info(`[CDPRelay] New connection to ${url.pathname}`)
    if (url.pathname === CDP_PATH) {
      this._handlePlaywrightConnection(ws)
    } else if (url.pathname === EXTENSION_PATH) {
      this._handleExtensionConnection(ws)
    } else {
      logger.warn(`[CDPRelay] Invalid path: ${url.pathname}`)
      ws.close(4004, 'Invalid path')
    }
  }

  private _handlePlaywrightConnection(ws: WebSocket): void {
    if (this._playwrightSocket?.readyState === WebSocket.OPEN) {
      logger.info('[CDPRelay] Closing previous Playwright connection')
      this._playwrightSocket.close(1000, 'New connection established')
    }
    this._playwrightSocket = ws
    logger.info('[CDPRelay] Playwright backend connected')
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString())
        await this._handlePlaywrightMessage(message)
      } catch (error) {
        logger.error('[CDPRelay] Error parsing Playwright message:', error)
      }
    })
    ws.on('close', () => {
      if (this._playwrightSocket === ws) {
        this._detachDebugger().catch(err => logger.error('[CDPRelay] Error detaching debugger on close', err))
        this._playwrightSocket = null
      }
      logger.info('[CDPRelay] Playwright backend disconnected')
    })
    ws.on('error', (error) => {
      logger.error('[CDPRelay] Playwright WebSocket error:', error)
    })
  }

  private async _detachDebugger() {
    this._connectionInfo = undefined
    await this._extensionConnection?.send('detachFromTab', {})
  }

  private _handleExtensionConnection(ws: WebSocket): void {
    if (this._extensionConnection) {
      this._extensionConnection.close('New connection established')
    }
    this._extensionConnection = new ExtensionConnection(ws)
    logger.info('[CDPRelay] Chrome Extension connected.')

    // Unblock any waiting Playwright commands.
    this._resolveExtensionConnected()

    this._extensionConnection.onclose = (c) => {
      if (this._extensionConnection === c) {
        this._extensionConnection = null
        logger.info('[CDPRelay] Chrome Extension disconnected.')
        // Reset the promise to wait for the next connection.
        this._resetConnectionPromise()
      }
    }
    this._extensionConnection.onmessage = this._handleExtensionMessage.bind(this)
  }

  private _handleExtensionMessage(method: string, params: any) {
    switch (method) {
      case 'forwardCDPEvent':
        this._sendToPlaywright({
          sessionId: params.sessionId,
          method: params.method,
          params: params.params,
        })
        break
      case 'detachedFromTab':
        logger.info(`[CDPRelay] Debugger detached from tab:`, params)
        this._connectionInfo = undefined
        this._extensionConnection?.close()
        this._extensionConnection = null
        break
    }
  }

  private async _handlePlaywrightMessage(message: CDPCommand): Promise<void> {
    logger.info(`[CDPRelay] From Playwright: ${message.method} (id=${message.id})`)
    
    // Wait for an extension to connect if we are in the initial waiting state.
    await this._extensionConnectedPromise

    if (!this._extensionConnection) {
      logger.warn('[CDPRelay] Extension not connected after waiting, sending error to Playwright')
      this._sendToPlaywright({
        id: message.id,
        error: { message: 'Extension disconnected before command could be processed' },
      })
      return
    }
    if (await this._interceptCDPCommand(message)) {
      return
    }
    await this._forwardToExtension(message)
  }

  private async _interceptCDPCommand(message: CDPCommand): Promise<boolean> {
    switch (message.method) {
      case 'Browser.getVersion': {
        this._sendToPlaywright({
          id: message.id,
          result: {
            protocolVersion: '1.3',
            product: 'Chrome/PromptHub-Bridge',
            userAgent: 'CDP-Bridge-Server/1.0.0',
          },
        })
        return true
      }
      case 'Browser.setDownloadBehavior': {
        this._sendToPlaywright({
          id: message.id,
        })
        return true
      }
      case 'Target.setAutoAttach': {
        // Simulate auto-attach behavior with real target info
        if (!message.sessionId) {
          this._connectionInfo = await this._extensionConnection!.send('attachToTab')
          logger.info('[CDPRelay] Simulating auto-attach for target:', message)
          this._sendToPlaywright({
            method: 'Target.attachedToTarget',
            params: {
              sessionId: this._connectionInfo!.sessionId,
              targetInfo: {
                ...this._connectionInfo!.targetInfo,
                attached: true,
              },
              waitingForDebugger: false,
            },
          })
          this._sendToPlaywright({
            id: message.id,
          })
        } else {
          await this._forwardToExtension(message)
        }
        return true
      }
      case 'Target.getTargetInfo': {
        logger.info('[CDPRelay] Target.getTargetInfo', message)
        this._sendToPlaywright({
          id: message.id,
          result: this._connectionInfo?.targetInfo,
        })
        return true
      }
    }
    return false
  }

  private async _forwardToExtension(message: CDPCommand): Promise<void> {
    try {
      if (!this._extensionConnection) {
        throw new Error('Extension not connected')
      }
      const { id, sessionId, method, params } = message
      const result = await this._extensionConnection.send('forwardCDPCommand', {
        sessionId,
        method,
        params,
      })
      this._sendToPlaywright({ id, sessionId, result })
    } catch (e) {
      logger.error('[CDPRelay] Error in the extension:', e)
      this._sendToPlaywright({
        id: message.id,
        sessionId: message.sessionId,
        error: { message: (e as Error).message },
      })
    }
  }

  private _sendToPlaywright(message: CDPResponse): void {
    logger.info(`[CDPRelay] To Playwright: ${message.method ?? `response(id=${message.id})`}`)
    this._playwrightSocket?.send(JSON.stringify(message))
  }
}

class ExtensionConnection {
  private readonly _ws: WebSocket
  private readonly _callbacks = new Map<number, { resolve: (o: any) => void; reject: (e: Error) => void }>()
  private _lastId = 0

  onmessage?: (method: string, params: any) => void
  onclose?: (self: ExtensionConnection) => void

  constructor(ws: WebSocket) {
    this._ws = ws
    this._ws.on('message', this._onMessage.bind(this))
    this._ws.on('close', this._onClose.bind(this))
    this._ws.on('error', this._onError.bind(this))
  }

  async send(method: string, params?: any, sessionId?: string): Promise<any> {
    if (this._ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket closed')
    }
    const id = ++this._lastId
    this._ws.send(JSON.stringify({ id, method, params, sessionId }))
    return new Promise((resolve, reject) => {
      this._callbacks.set(id, { resolve, reject })
    })
  }

  close(message?: string) {
    logger.info('[CDPRelay] closing extension connection:', message)
    this._ws.close(1000, message ?? 'Connection closed')
    this.onclose?.(this)
  }

  private _onMessage(event: WebSocket.RawData) {
    const eventData = event.toString()
    let parsedJson
    try {
      parsedJson = JSON.parse(eventData)
    } catch (e: any) {
      logger.error(`[CDPRelay] Closing websocket due to malformed JSON. eventData=${eventData} e=${e?.message}`)
      this._ws.close()
      return
    }
    try {
      this._handleParsedMessage(parsedJson)
    } catch (e: any) {
      logger.error(`[CDPRelay] Closing websocket due to failed onmessage callback. eventData=${eventData} e=${e?.message}`)
      this._ws.close()
    }
  }

  private _handleParsedMessage(object: any) {
    if (object.id && this._callbacks.has(object.id)) {
      const callback = this._callbacks.get(object.id)!
      this._callbacks.delete(object.id)
      if (object.error) {
        callback.reject(new Error(object.error.message))
      } else {
        callback.resolve(object.result)
      }
    } else if (object.id) {
      logger.warn('[CDPRelay] From Extension: unexpected response', object)
    } else {
      this.onmessage?.(object.method, object.params)
    }
  }

  private _onClose(event: WebSocket.CloseEvent) {
    logger.info(`[CDPRelay] <ws closed> code=${event.code} reason=${event.reason}`)
    this._dispose()
  }

  private _onError(event: WebSocket.ErrorEvent) {
    logger.error(`[CDPRelay] <ws error> message=${event.message} type=${event.type}`)
    this._dispose()
  }

  private _dispose() {
    for (const callback of this._callbacks.values()) {
      callback.reject(new Error('WebSocket closed'))
    }
    this._callbacks.clear()
    this.onclose?.(this)
  }
} 