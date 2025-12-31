# Local Development Setup

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd frontend
npm install
```

### 2. Configure Environment (Optional)

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Edit `.env` and add your private key if you want blockchain features:
```env
DICEROLLER_ADDRESS=0xa80C2dAbbD2F3aa329E686cc3B1DC21F7a18113b
ADMIN_PRIVATE_KEY=0xYourPrivateKeyHere
```

> **Note:** Blockchain features are **optional** for local testing. The game works without them using simulated rolls.

### 3. Run BOTH Servers

**Terminal 1 - Backend Server:**
```bash
cd frontend
npm run server
```

**Terminal 2 - Frontend Dev Server:**
```bash
cd frontend  
npm run dev
```

### 4. Open the App
Visit: http://localhost:5173

---

## 📡 Server Ports

| Server | Port | Purpose |
|--------|------|---------|
| Backend API | `3001` | Game logic, blockchain integration |
| Frontend | `5173` | Vite dev server (proxies API to 3001) |

---

## 🔍 Troubleshooting

### "Failed to create game" Error

**Problem:** Backend server not running

**Solution:** Make sure `npm run server` is running in a separate terminal

**Expected Console Output:**
```
🎲 Local Dev Server running on http://localhost:3001
⚠️ ADMIN_PRIVATE_KEY not set. Blockchain features disabled.
```

Or with blockchain:
```
🔗 Connected to Monad as 0xYourAddress
👂 Listening for DiceRolled events...
```

### Backend Crashes on Startup

Check that `frontend/.env` has valid `ADMIN_PRIVATE_KEY` (must start with `0x`)

### Game Works But No On-Chain Rolls

This is expected if `ADMIN_PRIVATE_KEY` is not set. The game will use simulated rolls for testing.

---

## 🌐 Deployment to Vercel

See [DEPLOYMENT.md](../DEPLOYMENT.md) for production setup with environment variables.
