# On-Chain Dice Roll Scripts

## 🎲 `roll-dice.js` - Test Switchboard VRF

Tests the on-chain randomness integration by triggering a real dice roll on Monad Mainnet.

### Usage

```bash
cd frontend
node roll-dice.js
```

### Expected Output

```
🎲 ON-CHAIN DICE ROLL TEST
═══════════════════════════════════════════

⚙️  Setting up connection...
✓ Connected as: 0x37674EE795f126BC933Dc57439eb194889dA0d0E

🎯 Round ID: 1735664400123

📡 Requesting on-chain randomness...
   Contract: 0xa80C2dAbbD2F3aa329E686cc3B1DC21F7a18113b
✓ Request submitted!
   Tx Hash: 0xabc...
   View: https://monadvision.com/tx/0xabc...

⏳ Waiting for transaction confirmation...
✓ Request confirmed in block 1234567

👂 Listening for Switchboard Oracle response...
   (This may take 5-30 seconds)

═══════════════════════════════════════════
🎉 DICE ROLLED - VERIFIED RESULT
═══════════════════════════════════════════

   🎲 Result: 2
   🔗 Round ID: 1735664400123

📜 Verification:
   Request Tx:  0xabc...
   Result Tx:   0xdef...

   🔍 Verify on Explorer:
   https://monadvision.com/tx/0xdef...

✅ Randomness verified by Switchboard Oracle on Monad!
```

### What It Does

1. **Connects** to Monad Mainnet using your `ADMIN_PRIVATE_KEY`
2. **Requests** on-chain randomness from DiceRoller contract
3. **Waits** for Switchboard Oracle to fulfill the request
4. **Displays** the verified result (1-3) and transaction hashes
5. **Provides** verification links to Monad Explorer

### Requirements

- `ADMIN_PRIVATE_KEY` in `.env`
- Wallet must have small amount of MON for gas
- DiceRoller contract deployed and configured

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
