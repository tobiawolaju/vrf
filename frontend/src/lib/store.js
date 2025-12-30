import { createClient } from '@vercel/kv';
import Redis from 'ioredis';

// --- CONFIGURATION ---
// 1. Check for standard Redis (Redis Cloud / TCP)
const useRedis = !!process.env.REDIS_URL;

// 2. Check for Vercel KV (Rest API / HTTP)
const useKV = !useRedis && process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;

// --- INITIALIZATION ---
let redisClient = null;
let kvClient = null;

if (useRedis) {
    console.log("Using Standard Redis (ioredis)");
    redisClient = new Redis(process.env.REDIS_URL);
} else if (useKV) {
    console.log("Using Vercel KV (REST)");
    kvClient = createClient({
        url: process.env.KV_REST_API_URL,
        token: process.env.KV_REST_API_TOKEN,
    });
} else {
    // Falls back to memory
    console.log("Using In-Memory Store (Non-Persistent)");
}

// Global variable for local development fallback
global.gameRooms = global.gameRooms || new Map();

export const db = {
    getGame: async (gameCode) => {
        if (useRedis) {
            const data = await redisClient.get(`game:${gameCode}`);
            return data ? JSON.parse(data) : null;
        }
        if (useKV) {
            return await kvClient.get(`game:${gameCode}`);
        }
        return global.gameRooms.get(gameCode);
    },
    setGame: async (gameCode, gameState) => {
        // Expire game after 24 hours (86400 seconds)
        const EXPIRE_SECONDS = 86400;

        if (useRedis) {
            await redisClient.set(`game:${gameCode}`, JSON.stringify(gameState), 'EX', EXPIRE_SECONDS);
            return gameState;
        }
        if (useKV) {
            await kvClient.set(`game:${gameCode}`, gameState, { ex: EXPIRE_SECONDS });
            return gameState;
        }
        global.gameRooms.set(gameCode, gameState);
        return gameState;
    },
    getAllGames: async () => {
        // Not implemented for Redis/KV
        return useRedis || useKV ? {} : global.gameRooms;
    }
};
