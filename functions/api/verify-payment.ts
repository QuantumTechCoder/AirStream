// Server-Side Zero-Trust Payment Verification on Cloudflare Pages Functions
// Queries Base / Polygon RPC to verify authentic on-chain transactions to 0x2cef0473f985156eDe84312Ce0BeB94B602d26E4

const RECIPIENT_WALLET = '0x2cef0473f985156eDe84312Ce0BeB94B602d26E4'

const NETWORKS: Record<string, { rpc: string; usdc: string[] }> = {
  base: {
    rpc: 'https://mainnet.base.org',
    usdc: ['0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'.toLowerCase()],
  },
  polygon: {
    rpc: 'https://polygon-rpc.com',
    usdc: [
      '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359'.toLowerCase(),
      '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'.toLowerCase(),
    ],
  },
}

const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function onRequest(context: any): Promise<Response> {
  const { request } = context

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  try {
    const { txHash, chain = 'base', minAmount = 3 } = await request.json()

    if (!txHash || !/^0x([A-Fa-f0-9]{64})$/.test(txHash.trim())) {
      return new Response(JSON.stringify({ error: 'Invalid transaction hash format' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const net = NETWORKS[chain]
    if (!net) {
      return new Response(JSON.stringify({ error: 'Unsupported network' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    // Call RPC for transaction receipt
    const rpcRes = await fetch(net.rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getTransactionReceipt',
        params: [txHash.trim()],
      }),
    })

    const rpcData: any = await rpcRes.json()
    const receipt = rpcData.result

    if (!receipt) {
      return new Response(JSON.stringify({ verified: false, error: 'Transaction not found or pending' }), {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    if (receipt.status !== '0x1') {
      return new Response(JSON.stringify({ verified: false, error: 'Transaction failed or reverted' }), {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const recipientNormalized = RECIPIENT_WALLET.toLowerCase()
    let verified = false
    let actualAmount = 0

    if (Array.isArray(receipt.logs)) {
      for (const log of receipt.logs) {
        const contract = (log.address || '').toLowerCase()
        if (net.usdc.includes(contract) && log.topics && log.topics[0] === TRANSFER_TOPIC) {
          const toAddress = '0x' + log.topics[2].slice(26).toLowerCase()
          if (toAddress === recipientNormalized) {
            const rawVal = BigInt(log.data)
            actualAmount = Number(rawVal) / 1e6
            if (actualAmount >= minAmount * 0.99) {
              verified = true
              break
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        verified,
        txHash: txHash.trim(),
        recipient: RECIPIENT_WALLET,
        amount: actualAmount,
        blockNumber: receipt.blockNumber,
      }),
      {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      }
    )
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Server error' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
}
