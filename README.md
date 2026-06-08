# 🗳️ Decentralised Voting Platform - Indian General Election 2026

A blockchain-based decentralized voting application built on Ethereum that ensures transparent, tamper-proof, and fraud-free elections.

## 🌐 Live Demo
**https://ethereum-voting-system.vercel.app**

## 📋 Problem Statement
Electoral fraud is illegal interference with elections — inflating votes for favoured candidates or suppressing rival votes. This project eliminates fake votes using blockchain technology.

## ✅ Solution
A decentralized application on Ethereum where:
- Each wallet address can cast exactly **one vote** (enforced on-chain)
- All votes are **permanently recorded** on the blockchain
- Results are **publicly verifiable** on Etherscan
- No central authority can manipulate the data

## 🔗 Smart Contract
- **Network:** Ethereum Sepolia Testnet
- **Contract Address:** `0xf664550a77585d52944db0FbD3CDB2148B7777c9`
- **Etherscan:** https://sepolia.etherscan.io/address/0xf664550a77585d52944db0FbD3CDB2148B7777c9

## 🛠️ Tech Stack
- **Smart Contract:** Solidity
- **Development & Deployment:** Hardhat
- **Frontend:** HTML, CSS, JavaScript, Web3.js
- **Wallet:** MetaMask
- **Hosting:** Vercel
- **Testnet RPC:** Infura

## 🚀 Run Locally
1. Clone the repo
2. Run `npm install`
3. Create `.env` with your `PRIVATE_KEY` and `INFURA_URL`
4. Deploy: `npx hardhat run scripts/deploy.cjs --network sepolia`
5. Run: `npm run dev`
6. Open http://localhost:3000

## 👨‍💻 Developer
**Gaurav Mishra** | B.Tech IT | ABES Engineering College
