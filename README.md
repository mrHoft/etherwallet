# EtherWallet

A Vue 3-based Ethereum wallet application with comprehensive functionality for managing wallets, transferring tokens, and interacting with the Ethereum blockchain.

## Features

- **Wallet Management**
  - Create new Ethereum wallets
  - Restore existing wallets using mnemonic phrases
  - Delete wallets
  - View wallet balances and transaction history

- **User Interface**
  - Clean and intuitive Vue 3 components
  - QR code generation for wallet addresses
  - Copy address functionality
  - Password protection for sensitive operations
  - Responsive navigation

- **Blockchain Integration**
  - Real-time gas price estimation
  - Token price tracking
  - Transaction history retrieval
  - Multi-call contract interactions
  - RPC provider management

- **Pages**
  - Home dashboard
  - Wallet management
  - Transfer tokens
  - Create new wallet
  - 404 error page

## Tech Stack

- **Frontend**: Vue 3 (Composition API)
- **Build Tool**: Vite
- **Language**: TypeScript
- **Blockchain Library**: ethers.js v6
- **Testing**: Jest, Vue Test Utils
- **Utilities**: QRCode for address visualization

## Installation

```bash
# Install dependencies
npm install

# Start development server (port 3000)
npm run dev

# Build for production
npm run build
