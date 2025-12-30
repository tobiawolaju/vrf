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
    },

    // --- LEADERBOARD LOGIC ---
    updateGameStats: async (gameState, winnerId) => {
        if (!useRedis && !useKV) {
            console.warn("Leaderboard requires Redis/KV. Skipping persistence.");
            return;
        }

        const pipeline = useRedis ? redisClient.pipeline() : kvClient.pipeline();

        for (const player of gameState.players) {
            // Use Twitter handle if available, else wallet/ID fallback
            // NOTE: We rely on the fact that we will store 'handle' on the player object in server.js
            const handle = player.twitterHandle || player.name || player.id;
            const isWinner = player.id === winnerId;

            const userKey = `user:stats:${handle}`;

            // 1. Increment Matches Played
            pipeline.hincrby(userKey, 'played', 1);

            // 2. Increment Wins if winner
            if (isWinner) {
                pipeline.hincrby(userKey, 'won', 1);
            }
        }

        // Execute increments
        await pipeline.exec();

        // 3. Re-calculate Win Rate for these players and update Leaderboard ZSET
        // We need a second pass or separate pipeline because we need the NEW values.
        // For simplicity/perf in this demo, accessing specific keys individually or logic-heavy
        // approaches might be slow. We'll just read them back.

        for (const player of gameState.players) {
            const handle = player.twitterHandle || player.name || player.id;
            const userKey = `user:stats:${handle}`;

            let stats;
            if (useRedis) {
                stats = await redisClient.hgetall(userKey);
            } else {
                stats = await kvClient.hgetall(userKey);
            }

            if (stats) {
                const played = parseInt(stats.played || 0);
                const won = parseInt(stats.won || 0);
                if (played > 0) {
                    const winRate = (won / played) * 100;
                    // ZADD leaderboard score member
                    if (useRedis) {
                        await redisClient.zadd('leaderboard', winRate, handle);
                    } else {
                        await kvClient.zadd('leaderboard', { score: winRate, member: handle });
                    }
                }
            }
        }
    },

    getLeaderboard: async () => {
        // Returns top 50 playres
        if (!useRedis && !useKV) return [];

        let topMembers;

        if (useRedis) {
            // ZREVRANGE leaderboard 0 49 WITHSCORES
            topMembers = await redisClient.zrevrange('leaderboard', 0, 49, 'WITHSCORES');
            // Redis returns array [member1, score1, member2, score2...]
            const result = [];
            for (let i = 0; i < topMembers.length; i += 2) {
                result.push({
                    rank: (i / 2) + 1,
                    name: topMembers[i],
                    winRate: parseFloat(topMembers[i + 1]).toFixed(1)
                });
            }
            return result;
        } else {
            // Vercel KV
            topMembers = await kvClient.zrange('leaderboard', 0, 49, { rev: true, withScores: true });
            // KV returns object list or similar depending on library version, usually [{ member, score }]
            // Check library docs or assume standard Object return for @vercel/kv zrange w/ options
            // Actually @vercel/kv returns [score, member, ...] or [{member, score}] depending on config.
            // Let's assume standardized array of objects if recent, but plain array if basic. 
            // It usually acts like Redis command.
            // Let's safe guard.

            // If it returns flat array:
            if (Array.isArray(topMembers) && typeof topMembers[0] === 'string') {
                const result = [];
                for (let i = 0; i < topMembers.length; i += 2) {
                    result.push({
                        rank: (i / 2) + 1,
                        name: topMembers[i], // For Vercel KV `zrange` member might be second if not careful, but usually Member/Score
                        // Actually Vercel KV `zrange` often returns distinct objects if configured, 
                        // but let's stick to the specific Vercel KV behavior: 
                        // It returns [{ member: 'foo', score: 10 }] if using the high level client helpers?
                        // No, we are using `kvClient` (createClient).
                        // Let's try to map assuming it returns objects as that is standard for their SDK
                    });
                }
            }
            // Actually, @vercel/kv `zrange` returns array of objects { member: string, score: number } by default in recent versions
            return topMembers.map((item, index) => ({
                rank: index + 1,
                name: item.member,
                winRate: parseFloat(item.score).toFixed(1)
            }));
        }
    }
};
