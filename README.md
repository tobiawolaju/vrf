# 🎲 MonkeyHand

**MonkeyHand** is a multiplayer dice-based game architecture that demonstrates how to combine fast off-chain gameplay with on-chain verifiable randomness using oracle-native design patterns on Monad.

The project is intentionally built as a **fairness anchor**, not a fully on-chain game: gameplay remains performant and inexpensive off-chain, while critical randomness and resolution are verifiable, auditable, and resistant to manipulation.

---

## 🎮 Game Concept

MonkeyHand is a “last-player-standing” prediction game:

- Players predict dice outcomes (1–3) using limited cards.
- Each round consumes cards based on correctness.
- The last player holding cards wins.

The core design constraint is **fair randomness under adversarial conditions**, not maximizing on-chain logic.

---

## 🧠 Architectural Philosophy

> Fast gameplay off-chain.  
> Fairness guarantees on-chain.  
> Minimal trust everywhere.

Rather than pushing all logic on-chain, MonkeyHand focuses on *where trust actually matters*:
- randomness generation
- result finality
- replay and stall resistance

---

## 🔐 Verifiable Randomness Design

MonkeyHand integrates a VRF-style workflow using **Pyth Entropy on Monad**, structured around explicit on-chain state transitions and permissionless completion.

### High-Level Flow

```mermaid
sequenceDiagram
    participant UI as Frontend
    participant SC as DiceRoller.sol
    participant IDX as Backend (Indexer / Crank)
    participant ORA as Pyth Entropy

    UI->>SC: requestDiceRoll(gameId, roundId)
    SC->>ORA: requestWithCallback(commitment)
    ORA-->>SC: entropyCallback(randomness)
    SC-->>IDX: DiceRolled event
    IDX-->>UI: Game state update
