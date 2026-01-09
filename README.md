# 🎲 MonkeyHand

**MonkeyHand** is a multiplayer dice game architecture exploring how to anchor fast off-chain gameplay to **on-chain verifiable randomness** using oracle-native VRF patterns on Monad.

The project focuses on **fairness, liveness, and zero-trust backend design**, not on pushing all gameplay on-chain.

---

## 🧠 What This Demonstrates

- Oracle-based verifiable randomness (Pyth Entropy)
- Explicit on-chain state machines for critical game actions
- Permissionless round finalization (no player or backend stalls)
- Event-driven backend with **zero authority over outcomes**
- Practical frontend ↔ backend ↔ smart contract coordination

---

## 🔐 Randomness Model (High-Level)

- Gameplay runs off-chain for speed.
- Each round requests randomness on-chain.
- An oracle callback finalizes the result immutably.
- Anyone can finalize or expire stalled rounds.

This removes trust in the server, players, or UI while keeping the game performant.

---

## 🛠️ Tech Stack

- **Solidity** — VRF / oracle integration + state machine
- **Node.js + Viem** — read-only indexer & liveness trigger
- **React** — multiplayer game UI
- **Chain:** Monad

---

## 🎯 Why It Exists

MonkeyHand is a protocol exercise:  
how to design **fair, non-stalling multiplayer games** under adversarial conditions without bloating the chain.

Not a casino. Not a demo token.  
A systems-thinking project.

---
