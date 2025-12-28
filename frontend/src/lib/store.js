import { createClient } from '@vercel/kv';

// Check if KV environment variables are configured (Vercel Production)
const useKV = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;

let kv = null;
if (useKV) {
    kv = createClient({
        url: process.env.KV_REST_API_URL,
        token: process.env.KV_REST_API_TOKEN,
    });
}

// Global variable for local development fallback
global.gameRooms = global.gameRooms || new Map();

export const db = {
    getGame: async (gameCode) => {
        if (useKV) {
            return await kv.get(`game:${gameCode}`);
        }
        return global.gameRooms.get(gameCode);
    },
    setGame: async (gameCode, gameState) => {
        if (useKV) {
            // Expire game after 24 hours (86400 seconds) to clean up
            await kv.set(`game:${gameCode}`, gameState, { ex: 86400 });
            return gameState;
        }
        global.gameRooms.set(gameCode, gameState);
        return gameState;
    },
    getAllGames: async () => {
        if (useKV) {
            // Limitation: KV doesn't efficiently support "get all" without a set/list index.
            // For now, debugging "all games" on prod isn't critical for the user.
            return {};
        }
        return global.gameRooms;
    }
};
