// Cloudflare Pages Function: Ephemeral WebRTC Signaling Service
// Supports room creation, peer discovery, SDP offer/answer exchange, and ICE candidates

interface SignalMessage {
  id: string
  from: string
  to?: string
  type: 'offer' | 'answer' | 'candidate' | 'join' | 'leave' | 'ping'
  data: any
  timestamp: number
}

interface Room {
  id: string
  createdAt: number
  peers: Set<string>
  messages: SignalMessage[]
}

// In-memory ephemeral storage across edge requests within worker isolate
const rooms = new Map<string, Room>()

// Periodic cleanup of stale rooms (older than 30 minutes)
function cleanupStaleRooms() {
  const now = Date.now()
  for (const [id, room] of rooms.entries()) {
    if (now - room.createdAt > 30 * 60 * 1000) {
      rooms.delete(id)
    }
  }
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function onRequest(context: any): Promise<Response> {
  const { request } = context
  cleanupStaleRooms()

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  const url = new URL(request.url)
  const path = url.pathname.replace('/api/signal', '')

  try {
    // 1. Create or join room: POST /api/signal/room
    if (request.method === 'POST' && (path === '/room' || path === '/room/')) {
      const body = await request.json()
      const { action, roomId, peerId } = body

      if (!roomId || !peerId) {
        return new Response(JSON.stringify({ error: 'Missing roomId or peerId' }), {
          status: 400,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        })
      }

      let room = rooms.get(roomId)

      if (action === 'create' || !room) {
        if (!room) {
          room = {
            id: roomId,
            createdAt: Date.now(),
            peers: new Set(),
            messages: [],
          }
          rooms.set(roomId, room)
        }
      }

      room.peers.add(peerId)

      return new Response(
        JSON.stringify({
          success: true,
          roomId,
          peerCount: room.peers.size,
          peers: Array.from(room.peers),
        }),
        { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Post a signal message: POST /api/signal/send
    if (request.method === 'POST' && (path === '/send' || path === '/send/')) {
      const body = await request.json()
      const { roomId, from, to, type, data } = body

      if (!roomId || !from || !type) {
        return new Response(JSON.stringify({ error: 'Invalid message payload' }), {
          status: 400,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        })
      }

      let room = rooms.get(roomId)
      if (!room) {
        room = {
          id: roomId,
          createdAt: Date.now(),
          peers: new Set([from]),
          messages: [],
        }
        rooms.set(roomId, room)
      }

      const msg: SignalMessage = {
        id: Math.random().toString(36).substring(2, 9),
        from,
        to,
        type,
        data,
        timestamp: Date.now(),
      }

      room.messages.push(msg)
      // Keep only latest 100 messages per room
      if (room.messages.length > 100) {
        room.messages.shift()
      }

      return new Response(JSON.stringify({ success: true, messageId: msg.id }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    // 3. Poll pending messages: GET /api/signal/poll?roomId=...&peerId=...&since=...
    if (request.method === 'GET' && (path === '/poll' || path === '/poll/')) {
      const roomId = url.searchParams.get('roomId')
      const peerId = url.searchParams.get('peerId')
      const since = parseInt(url.searchParams.get('since') || '0', 10)

      if (!roomId || !peerId) {
        return new Response(JSON.stringify({ error: 'Missing roomId or peerId' }), {
          status: 400,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        })
      }

      const room = rooms.get(roomId)
      if (!room) {
        return new Response(JSON.stringify({ messages: [], peerCount: 0 }), {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        })
      }

      // Filter messages intended for this peer (or broadcast to all), not from self, after timestamp
      const newMessages = room.messages.filter((msg) => {
        const isNotFromSelf = msg.from !== peerId
        const isForMe = !msg.to || msg.to === peerId
        const isAfterSince = msg.timestamp > since
        return isNotFromSelf && isForMe && isAfterSince
      })

      return new Response(
        JSON.stringify({
          messages: newMessages,
          peerCount: room.peers.size,
          peers: Array.from(room.peers),
        }),
        { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      )
    }

    // 4. Leave room: POST /api/signal/leave
    if (request.method === 'POST' && (path === '/leave' || path === '/leave/')) {
      const body = await request.json()
      const { roomId, peerId } = body
      const room = rooms.get(roomId)
      if (room) {
        room.peers.delete(peerId)
        if (room.peers.size === 0) {
          rooms.delete(roomId)
        }
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Not Found' }), {
      status: 404,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
}
