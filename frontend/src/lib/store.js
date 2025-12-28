// Simple in-memory store for demonstration.
// In a real Vercel Serverless deployment, this will NOT persist between different lambda invocations
// if the functions are cold-booted on different instances.
// You MUST integrate Vercel KV (Redis) or another DB for production resilience.

// Global variable to hold state in a "warm" lambda container
global.gameRooms = global.gameRooms || new Map();

export const db = {
    getGame: async (gameCode) => {
        return global.gameRooms.get(gameCode);
    },
    setGame: async (gameCode, gameState) => {
        global.gameRooms.set(gameCode, gameState);
        return gameState;
    },
    getAllGames: async () => {
        return global.gameRooms;
    }
};
