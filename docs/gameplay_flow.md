# MonkeyHand: Gameplay Lifecycle Flow

This document describes the end-to-end flow of a single game round, from the code level to the blockchain.

## 1. Initialization (`waiting` phase)
- **Trigger**: User clicks "Create Match" on the Home page.
- **Frontend**: `createGame()` calls `POST /api/create`.
- **Backend (`server.js`)**: Calls `initializeGame()` from `gameLogic.js`.
- **State**: `phase: 'waiting'`, `round: 0`.

## 2. Participation (`waiting` -> `commit`)
- **Action**: Players join via `POST /api/join`.

// something is wrong from here, 1. after joing the match, when the countdown for th first round 0/5(should be 1/5 ).... hits zero, everything seems to freeze, 1. i dont see the dice ,2,i dont see any transcation on the conatacrt ihn monad explore...see..
1/1 voted
Scoreboard
#1
tobiawolaju
tobiawolaju
0
Round 0/5
0s remaining
✓ Recorded

YOUR HAND
Card 1
Card 2
Card 3
Skip...no dice.
- **Transition**: `checkTimeouts()` (in `gameLogic.js`) is called during every `/api/state` poll. Once `now > startDeadline`, it sets `phase: 'commit'`.

## 3. Commitment Flow (`commit` phase)
- **Frontend**: `App.jsx` polls `/api/state` every 3s.
- **User Action**: Player selects a card. `POST /api/commit` stores the choice in `gameState.commitments[playerId]`.
- **Deadline**: `advanceRound()` sets a 25s `commitDeadline`.

## 4. VRF Trigger (`commit` -> `rolling`)
- **Backend (`server.js`, `/api/state` handler)**:
    - If `now > commitDeadline` AND `!rollRequested`:
    - Sets `gameState.phase = 'rolling'` and `gameState.rollRequested = true`.
    - **Calls `executeOnChainRoll(gameCode, round)`**.
- **Blockchain (`DiceRoller.sol`)**:
    - `executeOnChainRoll` calls `contract.write.requestDiceRoll(roundId)`.
    - Contract emits `DiceRequested`.

## 5. Fulfillment (`rolling` phase)
- **Backend (Background Task)**:
    1. Waits for `requestDiceRoll` to be mined.
    2. Fetches/Simulates randomness (The "Pull" from Switchboard).
    3. Calls `contract.write.submitVerifiedRoll(roundId, randomness)`.
- **Blockchain (`DiceRoller.sol`)**:
    - `submitVerifiedRoll` calculates `result = (randomness % 3) + 1`.
    - Emits `DiceRolled(roundId, result, randomness)`.

## 6. Resolution (`rolling` -> `resolve`)
- **Backend (EventListener)**: `setupContractListener()` watches for `DiceRolled`.
- **Logic**:
    - Finds the `gameCode` indexed by `roundId`.
    - Updates `gameState.lastRoll = result`.
    - Iterates through `gameState.players` to compare `commitments` vs `result`.
    - Updates `credits` (win) or sets `isBurned = true` (loss).
    - Sets `gameState.phase = 'resolve'` and `gameState.resolveDeadline = Date.now() + 5000`.
- **Frontend**: Receives `phase: 'resolve'` on the next poll, triggers dice animation and outcome sound.

## 7. Advancement (`resolve` -> `commit`)
- **Trigger**: Next poll to `/api/state`.
- **Logic**: `checkTimeouts()` sees `now > resolveDeadline` and calls `advanceRound()`.
- **Result**: `round++`, `phase: 'commit'`, and the loop restarts.

---

### Key Failure Points (Where to look for errors)
1. **Polling Latency**: If the poll interval is too high, the transition to `rolling` might feel delayed.
2. **Gas/RPC**: `executeOnChainRoll` fails if the admin wallet lacks MON or the RPC is unresponsive.
3. **Event Listener**: If the backend process crashes or the websocket/poll for events drops, the game gets stuck in `rolling`.
4. **State Lock**: If two players poll exactly at the deadline, `!rollRequested` check is critical to prevent double on-chain calls.
