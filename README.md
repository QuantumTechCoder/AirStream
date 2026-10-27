<div align="center">

# ⚡ AirStream

### **Real-Time Peer-to-Peer File Transfer, Live Clipboard & Collaborative Workspace**

*Stream Gigabytes in Seconds. Zero Cloud Storage. Zero File Size Limits.*

[![AirStream CI](https://github.com/QuantumTechCoder/AirStream/actions/workflows/ci.yml/badge.svg)](https://github.com/QuantumTechCoder/AirStream/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![WebRTC](https://img.shields.io/badge/WebRTC-RTCDataChannel-cyan.svg)](https://webrtc.org/)
[![Cloudflare Pages](https://img.shields.io/badge/Cloudflare_Pages-Functions-F38020.svg?logo=cloudflare)](https://pages.cloudflare.com/)
[![React 19](https://img.shields.io/badge/React-19-61DAFB.svg?logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF.svg?logo=vite)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC.svg?logo=tailwind-css)](https://tailwindcss.com/)
[![PWA](https://img.shields.io/badge/PWA-Installable-purple.svg)](https://web.dev/progressive-web-apps/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/QuantumTechCoder/AirStream/pulls)

[**Live Demo**](https://airstream.pages.dev) • [**Report Bug**](https://github.com/QuantumTechCoder/AirStream/issues) • [**Request Feature**](https://github.com/QuantumTechCoder/AirStream/issues)

</div>

---

## 💥 The Problem AirStream Solves

Traditional file transfer services (like **WeTransfer**, **Google Drive**, or **Dropbox**) have major drawbacks:
1. ⏳ **The "Double Wait" Penalty**: Sender uploads 100% of the file to a cloud server, *then* recipient waits to download it.
2. 🛑 **Arbitrary Size Limits**: Free tiers cut you off at 2GB, charge monthly subscriptions, or throttle download speeds.
3. 🔓 **Privacy Concerns**: Your confidential files, photos, and proprietary source code sit on third-party servers.
4. 🍏 **Platform Lock-In**: Apple's AirDrop only works between Apple hardware.

---

## ✨ The AirStream Solution

**AirStream** turns your browser into a high-speed, direct peer-to-peer transmission terminal:
- **Instant Streaming**: Recipient receives bytes **as they are being sent** in real time—no waiting for cloud uploads.
- **Zero Size Limits**: Send 500MB, 10GB, or 100GB+ files without paying a penny.
- **Local Wi-Fi Gigabit Speeds**: When both devices are on the same Wi-Fi, transfers bypass the public internet entirely, transferring at full router hardware speed (100MB/s+).
- **100% End-to-End Encrypted**: Data flows through DTLS-SRTP encrypted WebRTC `RTCDataChannel` tunnels. No intermediate server ever touches your data.
- **Cross-Platform Everywhere**: Works seamlessly across Windows, macOS, Linux, Android, iOS, ChromeOS, and Safari.
- **Multi-Tool Workspace**: Also bundles an **Instant Live Clipboard** and a **Real-Time Collaborative Code Editor**.

---

## 📊 Feature Comparison Matrix

| Feature | ⚡ AirStream | WeTransfer | AirDrop | Google Drive | Wormhole |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Max File Size** | 🚀 **Unlimited** | 2 GB (Free) | Unlimited | 15 GB quota | 10 GB |
| **Direct P2P Streaming** | ✅ **Yes** | ❌ No | ✅ Yes | ❌ No | ❌ No |
| **Cross-Platform (PC ↔ Mac ↔ Phone)** | ✅ **Universal** | ✅ Universal | ❌ Apple Only | ✅ Universal | ✅ Universal |
| **Local Wi-Fi Bypasses ISP** | ✅ **Yes** | ❌ No | ✅ Yes | ❌ No | ❌ No |
| **Live Shared Clipboard** | ✅ **Yes** | ❌ No | ❌ Apple Only | ❌ No | ❌ No |
| **Collaborative Code Editor** | ✅ **Yes** | ❌ No | ❌ No | ❌ No | ❌ No |
| **No Account / Login Required** | ✅ **Yes** | ✅ Yes | ❌ Apple ID | ❌ Google Login | ✅ Yes |
| **Air-Gapped / Offline LAN Mode** | ✅ **Yes (SDP QR)** | ❌ No | ❌ No | ❌ No | ❌ No |
| **100% Open Source** | ✅ **MIT** | ❌ Proprietary | ❌ Proprietary | ❌ Proprietary | ❌ Proprietary |

---

## 🛠️ Architecture & Under the Hood

```mermaid
flowchart LR
    subgraph DeviceA["💻 Device A (Sender)"]
        UI_A["AirStream UI"]
        FSA_A["Web Streams / File Slicer\n(64KB Framed Chunks)"]
        Backpressure["Backpressure Throttle\n(bufferedAmount <= 256KB)"]
        RTC_A["WebRTC RTCDataChannel\n(DTLS-SRTP Encrypted)"]
        
        UI_A --> FSA_A
        FSA_A --> Backpressure
        Backpressure --> RTC_A
    end

    subgraph Signaling["☁️ Cloudflare Pages Functions (Free Tier)"]
        CF_Signal["/api/signal\n(Ephemeral Handshake Mailbox)"]
    end

    subgraph DeviceB["📱 Device B (Receiver)"]
        RTC_B["WebRTC RTCDataChannel\n(DTLS-SRTP Encrypted)"]
        Assembler["Memory-Safe Chunk Assembler\n(Blob URL / StreamSaver)"]
        UI_B["AirStream UI"]

        RTC_B --> Assembler
        Assembler --> UI_B
    end

    DeviceA <.. "1. Initial SDP / ICE Handshake" ..> CF_Signal
    DeviceB <.. "1. Initial SDP / ICE Handshake" ..> CF_Signal
    RTC_A <=== "2. Direct High-Speed P2P Data Tunnel (Files, Clipboard, Code)" ===> RTC_B
```

### 🧠 Deep-Dive Engineering Highlights

1. **Backpressure-Driven Chunking**:
   Sending gigabytes over `RTCDataChannel` without flow control causes browser tabs to crash with `Out of Memory` errors. AirStream uses a sliding 64KB chunking engine that monitors `RTCDataChannel.bufferedAmount`. When the buffer exceeds 1MB, the sender pauses and awaits `onbufferedamountlow`, ensuring smooth, non-blocking performance.

2. **Zero-Config Cloudflare Pages Functions Signaling**:
   AirStream uses Cloudflare Pages Functions (`/api/signal/*`) as a lightweight, ephemeral mailbox for SDP offers, answers, and ICE candidate exchanges. Once paired, the server is completely out of the loop.

3. **Air-Gapped / Offline SDP Mode**:
   Have two laptops connected to an ad-hoc Wi-Fi network without internet? AirStream includes an **Offline SDP Token Exchanger** that lets peers connect by scanning an SDP QR code or pasting tokens.

4. **Multi-Channel Multiplexing**:
   - `files`: Binary (`arraybuffer`) channel for raw file streaming.
   - `clipboard`: Fast JSON channel for live clipboard sync.
   - `workspace`: Low-latency delta channel for collaborative CodeMirror editing.
   - `ping`: Active heartbeat channel measuring live round-trip time (RTT in ms).

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js 18+ (tested on Node v20 & v24)
- npm or pnpm

### 1. Clone & Install
```bash
git clone https://github.com/QuantumTechCoder/AirStream.git
cd AirStream
npm install
```

### 2. Start Local Development
```bash
npm run dev
```
Open **[http://localhost:5173](http://localhost:5173)**.

> **💡 Multi-Tab Testing**: AirStream automatically includes an in-browser `BroadcastChannel` bridge. Open two browser tabs or private windows, click **"Pair Devices"**, and watch them connect instantly without external setup!

### 3. Run Automated Tests
```bash
npm run test
```

### 4. Build for Production
```bash
npm run build
```

---

## 🌐 Deploy to Cloudflare Pages in 60 Seconds

AirStream is architected to run seamlessly on the **Cloudflare Pages & Functions 100% Free Tier**:

1. Fork this repository.
2. In the [Cloudflare Dashboard](https://dash.cloudflare.com/), go to **Workers & Pages** &rarr; **Create application** &rarr; **Pages** &rarr; **Connect to Git**.
3. Select your forked **AirStream** repository.
4. Set Build Settings:
   - **Framework preset**: `Vite`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
5. Click **Save and Deploy**. Your P2P streaming node is live!

---

## 📱 Progressive Web App (PWA)

AirStream is a full-featured PWA:
- 📲 **Installable**: Install as a desktop or mobile application directly from Chrome, Edge, or Safari.
- ⚡ **Offline-Ready**: The application shell is cached by Service Workers for instant loading anywhere.
- 📋 **Share Target**: Ready for native OS "Share to AirStream" integration.

---

## 🤝 Contributing

Contributions are what make the open-source community an incredible place to learn, inspire, and create. Any contributions you make are **greatly appreciated**!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'feat: Add AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

Please review our [Contributing Guidelines](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md).

---

## 📜 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for more information.

---

<div align="center">

### ⭐ If you find AirStream useful, please give it a star on GitHub! ⭐

Built with ❤️ by [**QuantumTechCoder**](https://github.com/QuantumTechCoder)

</div>
