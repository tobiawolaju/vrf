# Pyth Entropy VRF Deployment Guide (Trust-Minimal)

## ✅ Smart Contract Deployed

**DiceRoller Contract (Pyth Entropy)**: `0x131e56853F087F74Dbd59f7c6581cd57201a5f34`

- **Network**: Monad Mainnet (Chain ID: 143)
- **Entropy Contract**: `0x98046Bd286715D3B0BC227Dd7a956b83D8978603`
- **Entropy Provider**: `0x6CC14824Ea2918f5De5C2f75A9Da968ad4BD6344`
- **Explorer**: [View on Monad Explorer](https://monadexplorer.com/address/0x131e56853F087F74Dbd59f7c6581cd57201a5f34)

## Architecture Overview

This implementation uses an **Oracle-Native** model with **Pyth Entropy**. The system is design to be trust-minimal: the backend holds no private keys and only observes events.

1. **Commit Phase**: Player's browser generates a secret and commits the hash to the `DiceRoller` contract.
2. **Fetch Phase**: Player's browser fetches the oracle's secret from the Pyth Hermes API.
3. **Reveal Phase**: Player's browser submits both secrets to the Pyth Entropy contract.
4. **Callback**: Pyth verifies and triggers the `DiceRoller.entropyCallback` on-chain.
5. **Index**: The backend indexer detects the result and updates the match state.

## Oracle Backend Setup (Read-Only Indexer)

The backend is now a **read-only indexer**. It does not require a private key.

### Local Development

1. **Install dependencies**:
   ```bash
   cd oracle-backend
   npm install
   ```

2. **Configure environment** (`.env`):
   ```
   MONAD_RPC_URL=https://rpc-mainnet.monadinfra.com
   PORT=3001
   ```

3. **Start server**:
   ```bash
   npm start
   ```

### Production Deployment (Render)

1. **Update `render.yaml`** with the new contract address.
2. **Set environment variables** in Render dashboard:
   - `MONAD_RPC_URL` (e.g., via Monad Infra or Ankr)
3. **Note**: The `ADMIN_PRIVATE_KEY` is no longer required and should be removed for security.

## Frontend Integration

### Update Environment Variables

Add to Vercel environment variables:
- **Name**: `ORACLE_BACKEND_URL`
- **Value**: `https://vrf-oracle-backend.onrender.com` (your Render URL)

### Contract Configuration

The frontend orchestrates the VRF flow:
1. **Request**: `DiceRoller.requestDiceRoll(roundId, userCommitment)`
2. **Reveal**: `PythEntropy.revealWithCallback(provider, sequenceNumber, userSecret, oracleSecret)`

## Testing

### Test VRF Locally (Front-end Simulation)

```bash
cd contracts
node scripts/test-pyth-vrf.js
```

### Test Oracle Indexer

**Health check**:
```bash
curl http://localhost:3001/health
```
Expected response: `{"status":"ok","mode":"read-only-indexer","contract":"0x131e..."}`

## Security Advantages

✅ **Zero Trust**: The server cannot manipulate results or sign unauthorized transactions.
✅ **Provably Fair**: Randomness is derived from two independent secrets (Player + Oracle).
✅ **Crankless**: No need for a backend "relayer" to finalize rolls; the player (or any user) can reveal.
✅ **Verifiable**: All logs are indexed and linkable to Monad transactions.

## Troubleshooting

### "Results not appearing in UI"
- Ensure the backend indexer is running and connected to a Monad RPC.
- Check logs for "DiceRolled" event detection.

### "Transaction failed on reveal"
- Ensure the player has enough MON for gas to sign the reveal transaction.
- Verify that the `sequenceNumber` matches the one emitted in the `DiceRequested` event.

---

**Built with ❤️ for Monad Hackathon 2025**
