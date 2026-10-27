# Contributing to AirStream

First off, thank you for considering contributing to AirStream! It's people like you that make AirStream an awesome, free, and decentralized tool for everyone.

## Getting Started

1. **Fork the repository** on GitHub.
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/<your-username>/AirStream.git
   cd AirStream
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Create a branch** for your feature or fix:
   ```bash
   git checkout -b feature/my-cool-feature
   ```
5. **Run the local dev server**:
   ```bash
   npm run dev
   ```

## Development Guidelines

- **Testing**: Run `npm run test` before submitting changes.
- **Build Checks**: Run `npm run build` to verify TypeScript and Vite bundling succeed without errors.
- **Commit Messages**: Follow standard conventional commits format (e.g. `feat: add audio notification toggle`, `fix: handle edge buffer stall`).

## Submitting a Pull Request

1. Push your branch to your GitHub fork:
   ```bash
   git push origin feature/my-cool-feature
   ```
2. Open a Pull Request against `main` on the official repository.
3. Fill out the PR template with relevant context and verification steps.

Thank you for building with us!
