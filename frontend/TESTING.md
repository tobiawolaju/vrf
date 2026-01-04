# On-Chain Dice Roll Scripts

## 🎲 `roll-dice.js` - Test Switchboard VRF

Tests the on-chain randomness integration by triggering a real dice roll on Monad Mainnet and simulating the fulfillment.

### Usage

```bash
cd frontend
node roll-dice.js
```

### What It Does

1. **Connects** to Monad Mainnet using your `ADMIN_PRIVATE_KEY`
2. **Requests** on-chain randomness from the new DiceRoller contract (`0x0D4649fC3B09d1c73CA4282a5F546CE984B27d0a`)
3. **Polls** Switchboard Crossbar API for the proof
4. **Submits** the fulfillment transaction (`settleAndFulfill`)
5. **Displays** the verified result (1-3)

---

## 🎮 Testing the Full Game

To test the entire game flow with Switchboard VRF:

1. **Start Backend (The Authority/Crank)**:
   ```bash
   cd frontend
   npm run server
   ```
   *Note: Ensure `ADMIN_PRIVATE_KEY` in `.env` has some MON for gas!*

2. **Start Frontend**:
   ```bash
   cd frontend
   npm run dev
   ```

3. **Play a Match**:
   - Open `localhost:5173` in two different browser sessions (e.g. Chrome and Incognito).
   - Log in using Privy on both.
   - Player A creates a game; Player B joins.
   - When the timer ends, **Player A** (Leader) will automatically prompt for the roll request.
   - The **Backend Crank** will detect the request and fulfill it 5-10 seconds later.
   - Both players will see the result and the winner announcement!

### Verification

Click the provided explorer link to verify:
- The transaction was executed on-chain
- The randomness came from Switchboard Oracle
- The result is cryptographically verifiable

---

## 🧪 `test.js` - Server API Tests

Full test suite for all server endpoints. See main README for details.

```bash
node test.js
```
