<div align="center">

# ⚡ AirStream

### **Real-Time Peer-to-Peer File Transfer, Live Clipboard & Collaborative Workspace**

*Stream Gigabytes in Seconds. Zero Cloud Storage. Zero File Size Limits.*

[![Live App](https://img.shields.io/badge/Live_App-air--stream.pages.dev-00f0ff?style=for-the-badge&logo=google-chrome&logoColor=black)](https://air-stream.pages.dev)
[![PWA](https://img.shields.io/badge/PWA-Installable-8b5cf6?style=for-the-badge&logo=pwa&logoColor=white)](https://air-stream.pages.dev)

[![AirStream CI](https://github.com/QuantumTechCoder/AirStream/actions/workflows/ci.yml/badge.svg)](https://github.com/QuantumTechCoder/AirStream/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![WebRTC](https://img.shields.io/badge/WebRTC-RTCDataChannel-cyan.svg)](https://webrtc.org/)
[![Cloudflare Pages](https://img.shields.io/badge/Cloudflare_Pages-Functions-F38020.svg?logo=cloudflare)](https://air-stream.pages.dev)
[![React 19](https://img.shields.io/badge/React-19-61DAFB.svg?logo=react)](https://react.dev/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/QuantumTechCoder/AirStream/pulls)

### 👉 **[Use AirStream Now at air-stream.pages.dev](https://air-stream.pages.dev)** 👈

*No accounts. No installations. No cloud upload limits.*

</div>

---

## 💥 Why AirStream?

Sending files with traditional services (**WeTransfer**, **Google Drive**, **Dropbox**) sucks:
- ⏳ **The "Double Wait"**: You wait 20 minutes for your file to upload to their cloud server, and then your recipient waits another 20 minutes to download it.
- 🛑 **Greedy Limits**: 2GB free cap, subscription paywalls, and artificial download bandwidth throttling.
- 🔓 **Zero Privacy**: Your private photos, confidential files, or source code end up stored on third-party servers.
- 🍏 **Walled Gardens**: Apple's AirDrop only talks to Apple hardware.

---

## ✨ Enter AirStream

**AirStream connects two or more browsers directly over an encrypted WebRTC data tunnel:**

- 🚀 **Zero Size Limits**: Stream 500MB, 5GB, or 50GB+ files without paying a cent or hitting caps.
- ⚡ **Real-Time Streaming**: The recipient starts receiving chunks **immediately as you send them**—no waiting for cloud uploads to finish.
- 📶 **Gigabit LAN Speeds**: When both devices are on the same Wi-Fi or local network, transfers bypass your ISP entirely, reaching full hardware speeds (100MB/s+).
- 🔒 **End-to-End Encrypted**: Files flow directly device-to-device through DTLS-SRTP encryption. No intermediate server ever touches your data.
- 📱 **Universal Cross-Platform**: Works instantly across Windows, macOS, Linux, Android, iOS, ChromeOS, and Safari.
- 📋 **Live Shared Clipboard**: Copy text, links, or code on your PC and paste them instantly on your phone.
- 💻 **Collaborative Code Workspace**: Real-time synchronized CodeMirror scratchpad with syntax highlighting (JS, TS, Python, Markdown, JSON).
- 🔌 **Air-Gapped / Offline Mode**: Connect devices on isolated local networks with zero internet access using our offline SDP QR / token exchanger.

---

## 📊 How Does AirStream Compare?

| Feature | ⚡ AirStream | WeTransfer | AirDrop | Google Drive | Wormhole |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Max File Size** | 🚀 **Unlimited** | 2 GB (Free) | Unlimited | 15 GB quota | 10 GB |
| **Direct P2P Streaming** | ✅ **Instant** | ❌ Double Wait | ✅ Instant | ❌ Double Wait | ❌ Double Wait |
| **Cross-Platform (PC ↔ Mac ↔ Phone)** | ✅ **Universal** | ✅ Universal | ❌ Apple Only | ✅ Universal | ✅ Universal |
| **Local Wi-Fi Bypasses ISP** | ✅ **Yes (LAN speeds)**| ❌ Cloud only | ✅ Yes | ❌ Cloud only | ❌ Cloud only |
| **Live Shared Clipboard** | ✅ **Built-in** | ❌ No | ❌ Apple Only | ❌ No | ❌ No |
| **Collaborative Code Editor** | ✅ **Built-in** | ❌ No | ❌ No | ❌ No | ❌ No |
| **No Account / Signup Needed** | ✅ **100% Frictionless** | ✅ Yes | ❌ Apple ID | ❌ Google Login | ✅ Yes |
| **Air-Gapped / Offline LAN Mode** | ✅ **Yes (SDP QR)** | ❌ No | ❌ No | ❌ No | ❌ No |
| **Open Source** | ✅ **MIT** | ❌ Proprietary | ❌ Proprietary | ❌ Proprietary | ❌ Proprietary |

---

## 🎯 How to Use (3 Simple Steps)

You don't need to install anything or set up any servers. Just open the web app:

1. **Open the App**: Head to **[air-stream.pages.dev](https://air-stream.pages.dev)** on Device A.
2. **Pair Devices**: Click **"Pair Devices"** and scan the QR code with your phone, or share the 6-character room code / link with your peer.
3. **Stream Away**: Drag and drop files into the Drop Zone, paste text into the Live Clipboard, or code together in the workspace!

*(Tip: Click "Install" in your browser's address bar to install AirStream as a standalone PWA on desktop or mobile!)*

---

## 🛠️ Architecture & Under the Hood

```mermaid
flowchart LR
    subgraph DeviceA["💻 Device A (Sender)"]
        UI_A["AirStream Web UI"]
        FSA_A["64KB Chunk Slicer\n(Framed Packets)"]
        Backpressure["Backpressure Throttle\n(bufferedAmount <= 256KB)"]
        RTC_A["WebRTC RTCDataChannel\n(DTLS-SRTP Encrypted)"]
        
        UI_A --> FSA_A
        FSA_A --> Backpressure
        Backpressure --> RTC_A
    end

    subgraph Signaling["☁️ Ephemeral Handshake Mailbox"]
        CF_Signal["Cloudflare Pages Function\n(/api/signal)"]
    end

    subgraph DeviceB["📱 Device B (Receiver)"]
        RTC_B["WebRTC RTCDataChannel\n(DTLS-SRTP Encrypted)"]
        Assembler["Memory-Safe Chunk Assembler\n(Blob URL / StreamSaver)"]
        UI_B["AirStream Web UI"]

        RTC_B --> Assembler
        Assembler --> UI_B
    end

    DeviceA <.. "1. Initial Handshake / SDP Exchange" ..> CF_Signal
    DeviceB <.. "1. Initial Handshake / SDP Exchange" ..> CF_Signal
    RTC_A <=== "2. Direct High-Speed P2P Data Tunnel (Files, Clipboard, Code)" ===> RTC_B
```

### 🧠 Engineering Highlights

- **Backpressure Flow Control**: Slices files into 64KB chunks and monitors `RTCDataChannel.bufferedAmount`. When the buffer exceeds 1MB, sending pauses until the socket drains, preventing browser memory crashes on massive multi-gigabyte transfers.
- **Multiplexed Channels**:
  - `files`: Binary (`arraybuffer`) channel for high-throughput streaming.
  - `clipboard`: Fast JSON channel for live clipboard sync.
  - `workspace`: Low-latency delta sync for CodeMirror editing.
  - `ping`: Active heartbeat channel measuring real-time RTT latency in milliseconds.
- **Dual STUN Configuration**: Uses Cloudflare STUN (`stun:stun.cloudflare.com:3478`) and Google STUN (`stun:stun.l.google.com:19302`) for NAT traversal.

---

## 💻 Contributing & Local Development

> **Note**: If you just want to use AirStream, you do **not** need to download or run anything locally—simply visit **[air-stream.pages.dev](https://air-stream.pages.dev)**! 
> 
> The instructions below are for developers who want to contribute features, fix bugs, or test changes locally.

### 1. Clone the Repository
```bash
git clone https://github.com/QuantumTechCoder/AirStream.git
cd AirStream
npm install
```

### 2. Start Dev Server
```bash
npm run dev
```
Open **`http://localhost:5173`**.

> **💡 Multi-Tab Testing**: AirStream includes a local `BroadcastChannel` fallback. Open two browser tabs or private windows, click **"Pair Devices"**, and test file streaming and real-time syncing locally with zero external configuration!

### 3. Run Automated Tests
```bash
npm run test
```

### 4. Build & Typecheck
```bash
npm run build
```

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

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for details.

---

<div align="center">

### ⭐ If you love AirStream, please star the repo on GitHub! ⭐

Built with ❤️ by [**QuantumTechCoder**](https://github.com/QuantumTechCoder)

</div>
