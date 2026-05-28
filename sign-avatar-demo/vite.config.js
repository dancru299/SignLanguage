import { defineConfig } from 'vite'
import { WebSocketServer } from 'ws'

export default defineConfig({
  worker: {
    format: 'iife',
  },
  server: {
    host: true, // Exposes the server on local network IP so the phone can access it
    port: 5173,
  },
  plugins: [
    {
      name: 'webrtc-signaling-ws',
      configureServer(server) {
        const wss = new WebSocketServer({ noServer: true })

        server.httpServer.on('upgrade', (request, socket, head) => {
          if (request.url === '/ws-signaling') {
            wss.handleUpgrade(request, socket, head, (ws) => {
              wss.emit('connection', ws, request)
            });
          }
        });

        // Map containing clientId -> ws connection
        const clients = new Map()

        wss.on('connection', (ws) => {
          const clientId = Math.random().toString(36).substring(2, 9)
          clients.set(clientId, ws)

          // Send welcome message with clientId
          ws.send(JSON.stringify({ type: 'welcome', clientId }))

          ws.on('message', (message) => {
            try {
              const data = JSON.parse(message)

              // If a specific target client is designated
              if (data.target && clients.has(data.target)) {
                clients.get(data.target).send(JSON.stringify({
                  ...data,
                  sender: clientId
                }))
              } else {
                // Otherwise broadcast to all other active clients
                clients.forEach((client, id) => {
                  if (id !== clientId && client.readyState === 1) {
                    client.send(JSON.stringify({
                      ...data,
                      sender: clientId
                    }))
                  }
                })
              }
            } catch (err) {
              console.error('[Signaling Server] Error processing message:', err)
            }
          })

          ws.on('close', () => {
            clients.delete(clientId)
            // Broadcast disconnection
            clients.forEach((client) => {
              if (client.readyState === 1) {
                client.send(JSON.stringify({ type: 'client-disconnected', clientId }))
              }
            })
          })
        })

        console.log('\n⚡ [Vite SignLab Plugin] Local WebRTC WebSocket signaling server running on /ws-signaling\n')
      }
    }
  ]
})
