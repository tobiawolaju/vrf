# Pyth Entropy VRF Deployment Guide

## ✅ Smart Contract Deployed

**DiceRoller Contract (Pyth Entropy)**: `0x131e56853F087F74Dbd59f7c6581cd57201a5f34`

- **Network**: Monad Mainnet (Chain ID: 143)
- **Entropy Contract**: `0x98046Bd286715D3B0BC227Dd7a956b83D8978603`
- **Entropy Provider**: `0x6CC14824Ea2918f5De5C2f75A9Da968ad4BD6344`
- **Explorer**: [View on Monad Explorer](https://monadexplorer.com/address/0x131e56853F087F74Dbd59f7c6581cd57201a5f34)

## Architecture Overview

This implementation uses **Pyth Entropy** for truly decentralized VRF:

1. **Commit Phase**: User calls `requestDiceRoll()` with a random commitment
2. **Pyth Provider**: Automatically generates and reveals randomness
3. **Callback**: Pyth calls `entropyCallback()` with the random number
4. **Result**: Dice result (1-3) is stored on-chain

## Oracle Backend Setup

### Local Development

1. **Install dependencies**:
   ```bash
   cd oracle-backend
   npm install
   ```

2. **Configure environment** (`.env`):
   ```
   MONAD_RPC_URL=https://rpc-mainnet.monadinfra.com
   ADMIN_PRIVATE_KEY=your_private_key_here
   PORT=3001
   ```

3. **Start server**:
   ```bash
   npm start
   ```

### Production Deployment (Render)

1. **Update `render.yaml`** with new contract address
2. **Set environment variables** in Render dashboard:
   - `MONAD_RPC_URL`
   - `ADMIN_PRIVATE_KEY`
3. **Deploy** to Render

## Frontend Integration

### Update Environment Variables

Add to Vercel environment variables:
- **Name**: `ORACLE_BACKEND_URL`
- **Value**: `https://vrf-oracle-backend.onrender.com` (or your Render URL)

### Contract Configuration

The frontend is already configured with:
- Contract address: `0x131e56853F087F74Dbd59f7c6581cd57201a5f34`
- Updated ABI with Pyth Entropy methods
- Commit-reveal flow support

## Testing

### Test VRF Locally

```bash
cd contracts
node scripts/test-pyth-vrf.js
```

This will:
1. Get the VRF fee
2. Generate a random commitment
3. Request a dice roll
4. Wait for Pyth provider to reveal
5. Display the result

### Test Oracle Backend

**Health check**:
```bash
curl http://localhost:3001/health
```

**Get fee**:
```bash
curl http://localhost:3001/api/get-fee
```

**Full roll test**:
```bash
curl -X POST http://localhost:3001/api/roll-dice \
  -H "Content-Type: application/json" \
  -d '{"gameCode":"TEST","roundNumber":1}'
```

## How It Works

### 1. Request Flow
```javascript
// Frontend calls oracle backend
POST /api/roll-dice
{
  "gameCode": "ABC123",
  "roundNumber": 1
}
```

### 2. Oracle Backend
```javascript
// Generates random commitment
const commitment = generateUserCommitment();

// Calls contract with fee
await contract.write.requestDiceRoll(
  [roundId, commitment],
  { value: fee }
);
```

### 3. Pyth Entropy
- Receives commitment on-chain
- Provider generates randomness
- Automatically calls `entropyCallback()`
- Result stored in contract

### 4. Result Retrieval
```javascript
// Backend polls for result
const [isFulfilled, result] = await contract.read.getDiceResult([roundId]);
```

## Key Advantages

✅ **Truly Decentralized**: Uses Pyth's oracle network, not server-side random  
✅ **Cryptographically Secure**: Commit-reveal prevents manipulation  
✅ **Monad Native**: Deployed on Monad from block one  
✅ **Low Cost**: Optimized for Monad's high performance  
✅ **Verifiable**: All randomness verifiable on-chain  

## Troubleshooting

### "Timeout waiting for reveal"
- Pyth provider may take 10-30 seconds to reveal
- Check contract directly: `getDiceResult(roundId)`
- Verify fee was paid correctly

### "Insufficient fee"
- Call `getFee()` to get current fee
- Fee may change based on network conditions

### "Already fulfilled"
- Each roundId can only be used once
- Generate new roundId for each roll

## Next Steps

1. ✅ Deploy oracle backend to Render
2. ✅ Update Vercel environment variables
3. ✅ Test end-to-end flow
4. 📝 Monitor Pyth provider performance
5. 📝 Consider adding event listeners for real-time updates
