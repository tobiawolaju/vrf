# 🎲 MonkeyHand

**MonkeyHand** is a multiplayer dice game architecture exploring how to coordinate fast off-chain gameplay with **on-chain–enforced randomness and resolution guarantees** on Monad.

The project focuses on **fairness boundaries, liveness, and zero-trust backend design**, not on pushing full gameplay on-chain.

---

## 🧠 What This Demonstrates

- On-chain randomness generation for game resolution
- Explicit smart-contract state machines for critical actions
- Permissionless round finalization (no player or backend stalls)
- Event-driven backend with **no authority over outcomes**
- Practical frontend ↔ backend ↔ smart contract orchestration

---

## 🔐 Randomness Model (High-Level)

- Gameplay logic runs off-chain for speed.
- Each round requests randomness from a smart contract.
- The contract finalizes results immutably on-chain.
- Anyone can advance or expire stalled rounds.

This constrains trust to the contract itself and removes reliance on the server or UI for correctness.

> Note: Oracle-based VRF was explored architecturally but not used in the final deployed version.

---

## 🛠️ Tech Stack

- **Solidity** — randomness + on-chain state machine
- **Node.js + Viem** — read-only indexer & liveness trigger
- **React** — multiplayer game UI
- **Chain:** Monad

---

## 🎯 Why It Exists

MonkeyHand is a systems-design exercise:  
how to build **non-stalling, multiplayer Web3 games** where the backend cannot cheat and the frontend cannot lie.

Not a casino. Not a token demo.  
A protocol-minded game architecture.

---
