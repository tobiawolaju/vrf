# 🎲 MonkeyHand - Frontend

## 🎮 Game Description
**MonkeyHand** is a multiplayer, round-based elimination game built with **React**, **Vite**, and **Privy** for Web3 authentication.

Players join a match and are dealt 3 cards. In each round, they must secretly commit to one of their cards. A dice is rolled (simulated via VRF logic), and if a player's committed card matches the roll, they gain a point (credit). If it doesn't match, they lose that card. The game continues until only one player remains or 5 rounds are completed.

Key features:
- **Web3 Auth**: Sign in with **Privy** (Twitter, Email, Wallet).
- **Multiplayer**: Real-time(ish) state synchronization via polling.
- **Leaderboard**: Persistent tracking of Global Win Rates using Redis.
- **VRF Logic**: Verifiable Random Function logic for fair dice rolls.

---

## 🏗️ Technology Stack
- **Frontend Framework**: React 18 (Vite)
- **Styling**: Vanilla CSS (Cyberpunk/Balatro-inspired aesthetic)
- **Authentication**: [Privy](https://privy.io/)
- **Blockchain Interaction**: `wagmi` & `viem` (Monad Mainnet/Testnet support)
- **Backend API**: Express.js (simulating Vercel Serverless Functions)
- **Database**: Redis (or Vercel KV) for game state and leaderboard persistence.

---

## 📂 Project Structure

### `src/`
The core source code.

*   **`App.jsx`**: Main application component. Handles routing (Home -> Lobby -> Game), global game state polling, and Privy authentication context.
*   **`main.jsx`**: Entry point. Wraps the app in `PrivyProvider` and `WagmiProvider`.
*   **`server.js`**: A custom Express server that mimicks Vercel Serverless functions for local development. Handles API routes like `/api/create`, `/api/join`, `/api/commit`, and `/api/leaderboard`.

### `src/pages/`
Router-like views managed by `App.jsx`.

*   **`Home.jsx`**: Landing page. Allows users to login, create a match, join a match, or view the leaderboard. Includes wallet connection and contract interaction tests.
*   **`CreateGame.jsx`**: View for setting up a new match (e.g., configuring start delay).
*   **`JoinGame.jsx`**: View for entering a Game Code to join an existing lobby.
*   **`WaitingRoom.jsx`**: Lobby view where players wait for the match to start.
*   **`Gameplay.jsx`**: The main game interface. Displays cards, timer, opponents, and handles card commitment/drag-and-drop interactions.
*   **`Leaderboard.jsx`**: Displays the global player rankings (Win Rate) fetched from the backend.

### `src/components/`
Reusable UI components.

*   **`SetupCard.jsx`**: A styled container wrapper used for most "menu" screens.
*   **`Card.jsx`**: Renders a game card (1, 2, or 3).
*   **`EndGameOverlay.jsx`**: Modal shown when the match ends, displaying the winner.
*   **`PrivyWrapper.jsx`**: Configuration wrapper for Privy and Wagmi.
*   **`ContractTest.jsx`**: Component to test blockchain interactions.
*   **`BalatroBackground.jsx`**: The animated background component.

### `src/lib/`
Shared logic and utilities.

*   **`gameLogic.js`**: Core game mechanics. Contains functions to initialize games, process rounds, determine winners, and generate deterministic VRF-style rolls.
*   **`store.js`**: Data persistence layer. Abstracts the database connection, switching between **Redis** (production), **Vercel KV**, or **In-Memory** (local dev fallback) to store game rooms and leaderboard stats.

### `src/utils/`
*   **`chains.js`**: Configuration for blockchain networks (Monad Mainnet, Monad Testnet).

---

## 🚀 Setup & Running

1.  **Install Dependencies**
    ```bash
    npm install
    ```

2.  **Environment Variables**
    Create a `.env` file (optional for local dev, required for Redis):
    ```env
    # For persistent leaderboard
    REDIS_URL=redis://your-redis-url...
    # OR
    KV_REST_API_URL=...
    KV_REST_API_TOKEN=...
    ```

3.  **Run Development Server**
    Start both the Vite frontend and the Express backend API:
    ```bash
    npm run dev
    ```
    - Frontend: `http://localhost:5173`
    - Backend API: `http://localhost:3001`

4.  **Build for Production**
    ```bash
    npm run build
    ```
