---
title: "Show DEV: AirStream — Stream Gigabytes Browser-to-Browser with WebRTC (No Cloud, No Size Limits)"
published: false
description: "Why upload an 8GB file to a cloud server just to download it again? Here's how I built AirStream: a browser-to-browser P2P file streamer and collaborative workspace."
tags: showdev, webdev, webrtc, opensource
canonical_url: https://air-stream.pages.dev
cover_image: https://raw.githubusercontent.com/QuantumTechCoder/AirStream/main/public/icon.svg
---

> **TL;DR**  
> 🚀 **Live Web App (Free, No Signup)**: [air-stream.pages.dev](https://air-stream.pages.dev)  
> ⭐ **GitHub Repo (MIT)**: [github.com/QuantumTechCoder/AirStream](https://github.com/QuantumTechCoder/AirStream)  
> 🛠️ **Stack**: React 19, TypeScript, Vite, Tailwind CSS v4, WebRTC `RTCDataChannel`, Web Streams API, PeerJS WSS, Cloudflare Pages.

---

### The Universal Modern Tragedy

Picture this: It's 2 AM. You just rendered a 6GB 4K video on your PC, and you need it on your phone or your teammate's MacBook across the room.

What are your options in 2026?

1. **WeTransfer**: *"Please upgrade to WeTransfer Pro to send files larger than 2GB."* (And even if it fits, you have to wait 25 minutes for it to upload to an AWS S3 bucket in Virginia, only for the recipient to wait *another* 25 minutes to download it).
2. **Google Drive / Dropbox**: *"Your cloud storage is 99% full from vacation photos and PDF receipts from 2018."*
3. **AirDrop**: *"Sorry, did we detect a Windows laptop or an Android phone? We don't do that here."*
4. **The USB Flash Drive Dance**: *"Where is my USB-C to USB-A adapter? Why is this flash drive formatted in NTFS? Why won't Android mount it?!"*

Why are we routing multi-gigabyte files through someone else's data center across the ocean when both devices are sitting on the exact same local Wi-Fi router?

So, as any reasonable developer with too much caffeine would do, I decided to build **[AirStream](https://air-stream.pages.dev)**.

---

### What is AirStream?

**AirStream** is a zero-install, Progressive Web App (PWA) that opens an encrypted, direct peer-to-peer data pipeline between any two browsers using **WebRTC `RTCDataChannel`**.

- 🚫 **Zero File Size Limits**: Send 200MB, 5GB, or 50GB. The browser doesn't choke.
- ⚡ **The "Double Wait" is Dead**: Bytes stream directly from Device A to Device B *as they are being read*. The recipient starts downloading the exact second you start sending.
- 📶 **Gigabit LAN Speeds**: When both devices are on the same Wi-Fi or office network, transfers bypass your internet ISP completely, transferring at full router hardware speed (100MB/s+).
- 🔒 **End-to-End Encrypted**: Data flows through DTLS-SRTP encrypted tunnels. No intermediate cloud server ever touches or stores your files.
- 📱 **Universal Cross-Platform**: Windows, macOS, Linux, iOS Safari, Android Chrome—if it runs a modern browser, it works.
- 📋 **Collaborative Workspace**: Because I was already in the WebRTC rabbit hole, I also baked in a **Live Shared Clipboard** and a **Real-Time Collaborative Code Scratchpad** (CodeMirror 6).

---

### Under the Hood: The Deep Technical Challenges

Building a toy WebRTC chat app is easy. Building a system that reliably transfers 10GB+ binary files across hostile cellular firewalls without crashing the browser tab is a whole different beast.

Here are the biggest architectural hurdles I hit and how I solved them:

#### 1. The "Tab Death" Out-Of-Memory Crash (Backpressure Control)

If you naively try to read a 5GB file using `FileReader.readAsArrayBuffer()` or shove slices into an `RTCDataChannel` in a `while` loop, you will instantly crash the user's browser tab. 

Why? Because the browser's JavaScript engine will load the entire payload into RAM faster than the underlying OS socket can flush the packets over the network. The buffer explodes, memory spikes to 8GB, and the tab silently vanishes with an `OutOfMemory` error.

**The Fix:**
I implemented backpressure regulation using `RTCDataChannel.bufferedAmount` and `bufferedAmountLowThreshold`:

```typescript
// Slicing files into 64KB framed binary chunks
const CHUNK_SIZE = 64 * 1024; // 64 KB

while (currentChunk < totalChunks && !isCancelled) {
  // If the internal WebRTC buffer exceeds 1MB, PAUSE the stream
  if (dataChannel.bufferedAmount > 1024 * 1024) {
    await new Promise<void>((resolve) => {
      dataChannel.bufferedAmountLowThreshold = 256 * 1024; // Wake up at 256KB
      dataChannel.onbufferedamountlow = () => {
        dataChannel.onbufferedamountlow = null;
        resolve();
      };
    });
  }

  // Safe to read next slice and transmit
  const slice = file.slice(start, end);
  const buffer = await slice.arrayBuffer();
  dataChannel.send(framePacket(currentChunk, fileId, buffer));
  currentChunk++;
}
```

By throttling chunk creation against the network driver's drain rate, RAM consumption stays flat under **50MB**, regardless of whether you're streaming a 100MB video or a 50GB raw disk image.

---

#### 2. The Packet Framing Protocol

WebRTC DataChannels don't inherently know where one file ends and another begins if you send raw buffers. To solve this, every 64KB slice is wrapped in a lightweight binary header:

```
[4 Bytes: Chunk Index (Uint32)]
[4 Bytes: File ID Length (Uint32)]
[N Bytes: File ID (UTF-8)]
[Remaining Bytes: Raw Binary Payload]
```

On the receiving end, the receiver parses the header, verifies chunk integrity, updates a moving-average transfer speed indicator (MB/s) and ETA countdown, and streams the chunks safely into an assembling Blob.

---

#### 3. The "Cellular CGNAT" Nightmare (Wi-Fi ↔ Jio / Mobile Data)

During early testing, transfers worked flawlessly between two laptops on my home Wi-Fi. But the second I tested between my laptop (broadband) and my phone connected to 5G mobile data (Reliance Jio), **it refused to connect**.

Why? Mobile cellular carriers use aggressive **Carrier-Grade NAT (CGNAT) with Symmetric NAT**.

Standard public STUN servers (`stun.l.google.com`) only tell you your public IP and port. With Symmetric NAT, the firewall changes the external port mapping for every distinct destination. Direct UDP hole-punching is mathematically impossible between two symmetric NATs without a relay.

**The Fix:**
1. **Persistent WebSocket Signaling**: We use a global persistent WebSocket signaling layer (`0.peerjs.com`) over port 443 WSS so offer/answer exchanges never drop across different ISP routing paths.
2. **Dual-Path STUN + Port 443 TURN Relay Fallback**:
   We added OpenRelay TURN servers configured with TCP/TLS on port 443:

```typescript
export const ICE_SERVERS: RTCIceServer[] = [
  { urls: ['stun:stun.cloudflare.com:3478'] },
  { urls: ['stun:stun.l.google.com:19302'] },
  {
    urls: [
      'turn:openrelay.metered.ca:443?transport=tcp',
      'turns:openrelay.metered.ca:443?transport=tcp',
    ],
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];
```

Because mobile networks never block port 443 (HTTPS), WebRTC seamlessly falls back to the relayed route whenever direct P2P is blocked by enterprise firewalls or carrier CGNATs.

---

#### 4. The Air-Gapped / Offline QR Mode

What happens if you are in an airplane, a basement, or on a remote film set with an isolated local Wi-Fi router and **zero internet access**?

Because normal signaling requires an external server, AirStream includes a dedicated **Offline / Air-Gapped SDP Exchanger**. 
Device A generates a base64-compressed SDP Offer as a QR code. Device B scans it with its camera, generates an Answer QR code, and Device A scans it back. 

Boom. Direct peer-to-peer data transfer with **zero connection to the outside internet**.

---

### Try It Out!

The project is live, MIT-licensed, and 100% free:

1. Open **[air-stream.pages.dev](https://air-stream.pages.dev)** on your laptop.
2. Click **Pair Devices** and scan the QR code with your phone (or share the 6-character room code).
3. Drop a file, paste into the live clipboard, or test the collaborative code scratchpad!

---

### Let's Chat!

I'd love to hear your thoughts:
- What's the weirdest or most cursed WebRTC edge case you've ever had to debug?
- What file sizes or network setups should I stress-test next?
- Would you find an auto-discovery feature (like mDNS / local LAN peer discovery) useful?

Drop your feedback below or star the repo on GitHub:  
⭐ **[github.com/QuantumTechCoder/AirStream](https://github.com/QuantumTechCoder/AirStream)**
