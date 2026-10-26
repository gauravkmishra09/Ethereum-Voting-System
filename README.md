# JanVote — Decentralised Voting Demo

A student-built voting DApp using Solidity, Ethereum Sepolia, MetaMask, Web3.js, and a legacy Truffle contract wrapper.

## Live demo
https://ethereum-voting-system.vercel.app/

## Deployment
- Network: Ethereum Sepolia testnet
- Contract: `0xf664550a77585d52944db0FbD3CDB2148B7777c9`
- Explorer: https://sepolia.etherscan.io/address/0xf664550a77585d52944db0FbD3CDB2148B7777c9

## Frontend improvements
- Responsive candidate cards with party-symbol images.
- Candidate counts are read from the deployed contract and rendered with at least two digits (for example, `00`, `01`).
- Total votes are calculated from candidate counts instead of a static display value.
- Handles both legacy candidate tuple formats: `(id, name, voteCount)` and `(id, name, party, voteCount)`.
- MetaMask and Sepolia readiness checks, transaction receipt polling, and clearer status/error messages.
- A demo prerequisite checklist and local-only camera preview.

## Important scope and privacy notes
This is an educational Sepolia testnet demo, not an official election platform. The current smart contract enforces one vote per wallet address; it does not prove that a wallet belongs to one unique eligible voter.

The document checkbox is only a demo acknowledgement. No Aadhaar number, Aadhaar image, DigiLocker credentials, or document contents are collected. The camera preview is local browser media and does not perform face recognition or identity matching. Do not describe these checks as verified identity or voter eligibility.

Real Aadhaar/DigiLocker integration requires an appropriately authorized, compliant identity-provider flow, a secure backend, explicit consent, and a privacy/security review. It must not be simulated by collecting personal ID details in a static webpage.

The Solidity source in `contracts/Election.sol` and the checked-in deployed artifact should be verified for consistency before compiling and redeploying. This frontend revision intentionally does not replace the deployed contract.

## Run locally
1. Clone the repository and run `npm install`.
2. Run `npm run dev`.
3. Open the local URL printed by lite-server. Camera access requires HTTPS or localhost.
4. To deploy a new contract, configure the required environment values in a local `.env` file. Never commit private keys or RPC secrets.

## Tech stack
- Solidity smart contract
- Hardhat / Truffle-compatible artifact
- Web3.js and MetaMask
- Static HTML/CSS/JavaScript frontend
- Vercel hosting
