import { WebSocketServer } from "ws"

let wss = null

export function initWebSocket(server) {
  wss = new WebSocketServer({ server })

  wss.on("connection", (ws) => {
    console.log("New WebSocket client connected")

    ws.on("close", () => {
      console.log("WebSocket client disconnected")
    })

    ws.on("error", (error) => {
      console.error("WebSocket error:", error)
    })
  })

  return wss
}

export function broadcastMessage(type, data) {
  if (!wss) return

  const message = JSON.stringify({
    type,
    data,
  })

  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(message)
    }
  })
}

export function broadcastNewImage(imageData) {
  broadcastMessage("NEW_IMAGE", imageData)
}

export function getWebSocketServer() {
  return wss
}
