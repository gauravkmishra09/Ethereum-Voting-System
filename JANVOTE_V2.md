# JanVote V2 implementation

This branch preserves the existing Sepolia contract and adds a browser-only local demo mode to the current frontend. It also contains an isolated V2 smart-contract track. The local demo starts at zero, requires no wallet/RPC connection, and stores simulated votes only in the current browser. It is for classroom presentation only; it does not reset or modify blockchain history.

## Features in the V2 contract
- Admin-controlled creation and scheduling of multiple elections.
- Candidate setup per election before its start.
- Voter registration requests and explicit admin approval.
- One vote per approved wallet per election.
- Candidate totals and total votes queried from the contract.
- On-chain events for registration, approval, election lifecycle and vote receipts.
- Optional eligibility-verifier hook. A real ZK circuit/verifier must be implemented and independently audited before claiming ZK verification.

## Important limitations
This is a student demonstration, not a production election system. The wallet address is visible, and the candidate choice is emitted in the VoteCast event and reflected in public vote totals. This is not a secret ballot or anonymous voting protocol. The optional verifier hook only calls an external verifier; it does not itself implement a ZK circuit. Do not configure a mock verifier on a public network or claim that Aadhaar or real-world identity has been verified.

The contract has no reset function. A fresh deployment creates a new election registry with zero votes while preserving the historical deployment.

## Install and compile
The existing project has a legacy Solidity 0.5.16 setup. V2 therefore uses a separate Hardhat config and separate source/test/artifact directories.

```bash
npm install
npx hardhat --config hardhat.v2.config.cjs compile
```

## Configure Sepolia
Create a local `.env` (never commit it):

```env
SEPOLIA_RPC_URL=https://YOUR_SEPOLIA_RPC
PRIVATE_KEY=0xYOUR_DEDICATED_TEST_WALLET_PRIVATE_KEY
```

Fund the dedicated wallet with Sepolia test ETH. Never use a mainnet wallet or commit private keys.

Deploy:

```bash
npx hardhat --config hardhat.v2.config.cjs run scripts/deploy-v2.cjs --network sepolia
```

Record the new address and verify the contract on Sepolia Etherscan. The existing frontend still points to the old contract and is not switched automatically by this branch.

## Create a demo election
Use the admin wallet to call `createElection(title, startsAt, endsAt)`, then `addCandidate(electionId, name, party)` for each candidate. Voters call `requestRegistration(electionId, "0x")`; the admin calls `approveVoter(electionId, voterAddress)`; approved voters call `vote(electionId, candidateId)`.

Use future timestamps for the start/end window. For local testing, use a local chain and test accounts.

## Current frontend behavior
The frontend in this branch starts in **LOCAL DEMO · NOT ON BLOCKCHAIN** mode. It shows four sample candidates with zero votes, lets one local demo vote be recorded per browser, and provides a **Reset demo votes to 0** control. This state is stored in browser local storage and can be cleared from the page. No MetaMask, RPC provider, contract call, or transaction is used in this mode. The demo vote is not a real vote and must not be presented as blockchain evidence.

## Remaining UI work
The existing site is a static jQuery/Web3.js app with a legacy ABI. It must be upgraded to use the V2 ABI and new contract address before it can use these multi-election and registration functions. The admin, voter, results, receipt and audit screens should be built against the V2 ABI, with all displayed counts read from chain state/events. ZK proof generation and the real verifier contract are a separate cryptographic implementation milestone.
