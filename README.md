# 🎲 Last Die Standing

A minimal but complete multiplayer dice prediction game with verifiable random function (VRF) proof generation.

## 🎮 Game Rules

- **Players**: 2-4 players (local multiplayer)
- **Starting Cards**: Each player starts with cards [1, 2, 3]
- **Each Round**:
  - **Commit Phase** (5 seconds): Players secretly select a card (1/2/3) or skip
  - **Resolve Phase**: Backend rolls a 3-sided die using VRF
  - **Outcomes**:
    - ✅ Correct prediction → +1 credit, card retained
    - ❌ Wrong prediction → card burned (removed)
    - ⏭️ Skip → no change
- **End Condition**: Game ends after 5 rounds OR when all players have no cards
- **Winner**: Highest credits
  - **Tie-breakers**: Most remaining cards → Earliest correct prediction

## 🛠️ Tech Stack

- **Frontend**: React (Vite)
- **Backend**: Node.js (Express)
- **Real-time**: Simple polling (no WebSockets)
- **VRF**: Mock implementation using `crypto.randomInt()` + SHA256 proof

## 🚀 How to Run

### Prerequisites
- Node.js (v16 or higher)
- npm

### Backend Setup

```bash
cd backend
npm install
npm start
```

The backend will start on `http://localhost:3001`

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend will start on `http://localhost:5173` (or similar Vite dev server port)

### Play the Game

1. Open your browser to the frontend URL
2. Select number of players (2-4)
3. Click "Start Game"
4. Each player takes turns selecting cards or skipping
5. Once all players commit, click "Roll the Die!"
6. View results and VRF proof
7. Click "Verify Roll" to validate the proof client-side
8. Continue for 5 rounds or until all cards are gone

## 🔒 How Fairness Works (VRF)

### Current Implementation (Mock VRF)

The game uses a **mock VRF** for demonstration purposes:

1. **Random Generation**: `crypto.randomInt(1, 4)` generates a random number 1-3
2. **Seed Creation**: `timestamp + round number` creates a unique seed
3. **Proof Generation**: `SHA256(seed + result)` creates a cryptographic proof hash
4. **Client Verification**: Frontend recomputes the hash to verify integrity

### How to Verify

1. After each roll, note the displayed:
   - **Seed**: e.g., `1735218346000-round-1`
   - **Roll Result**: e.g., `2`
   - **Proof Hash**: e.g., `a3f5b9c...`
2. Click **"Verify Roll"** button
3. The client recomputes `SHA256(seed:result)` and compares with the proof
4. ✅ **Valid** = proof matches, ❌ **Invalid** = proof doesn't match

### Production VRF Integration

In a production environment, replace the mock VRF with a real VRF service:

#### Where to Integrate (see `backend/dice.js`)

Look for the commented section:
```javascript
// ========================================================================
// MOCK VRF IMPLEMENTATION
// ========================================================================
// In production, this would be replaced with a real VRF service like:
// - Switchboard VRF (Solana)
// - Chainlink VRF (EVM chains)
// - Pyth Entropy (Multi-chain)
```

#### Real VRF Services

**Switchboard VRF (Solana)**
- Request randomness with a callback
- Receive cryptographically verifiable random value
- Verify proof on-chain

**Chainlink VRF (Ethereum/EVM)**
- Request randomness via smart contract
- Oracle returns random value + proof
- Verify proof on-chain automatically

**Pyth Entropy (Multi-chain)**
- Request entropy from Pyth network
- Receive random value with cryptographic proof
- Verify via Pyth's verification endpoint

#### Integration Steps

1. **Replace `generateVRFRoll()` function** with VRF service API call
2. **Store VRF request ID** for tracking
3. **Receive callback** with random value + proof
4. **Verify proof** using service's verification method
5. **Use verified random value** for game logic

## 📁 Project Structure

```
vrf/
├── backend/
│   ├── dice.js          # Express server with game logic
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx      # Main game component
│   │   ├── App.css      # Arcade-style styling
│   │   └── main.jsx     # React entry point
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
└── README.md
```

## 🎯 Features Implemented

✅ 2-4 player support  
✅ Card selection UI with visual feedback  
✅ 5-second countdown timer  
✅ Hidden commitments (revealed only after all players commit)  
✅ VRF mock with seed + proof generation  
✅ Client-side proof verification  
✅ Real-time game state polling  
✅ Winner determination with tie-breakers  
✅ Arcade-style UI with animations  
✅ Complete game flow from setup to end  

## 🔧 API Endpoints

- `POST /api/start` - Start new game with player count
- `POST /api/commit` - Submit player card selection or skip
- `POST /api/roll` - Roll die and resolve round (VRF)
- `GET /api/state` - Get current game state

## 📝 Notes

- No authentication or payments required
- All game state stored in-memory (resets on server restart)
- Simple polling every 1 second for state updates
- Minimal dependencies for easy weekend implementation
- Ready for VRF integration with clear code comments

---

Built with ❤️ as a minimal, shippable game demo
