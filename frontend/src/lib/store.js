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
        if (useRedis || useKV) return []; // Not implemented for distributed yet
        return Array.from(global.gameRooms.values());
    },

    // --- LEADERBOARD LOGIC ---
    updateGameStats: async (gameState, winnerId) => {
        // Prepare pipeline for Redis/KV
        const pipeline = (useRedis && redisClient) ? redisClient.pipeline() : (useKV && kvClient) ? kvClient.pipeline() : null;

        // In-Memory Fallback
        if (!useRedis && !useKV) {
            global.playerStats = global.playerStats || new Map();
            global.leaderboard = global.leaderboard || [];
        }

        for (const player of gameState.players) {
            const handle = player.twitterHandle || player.name || player.id;
            const isWinner = player.id === winnerId;
            const userKey = `user:stats:${handle}`;

            if (pipeline) {
                // Redis/KV Update
                pipeline.hincrby(userKey, 'played', 1);
                if (isWinner) pipeline.hincrby(userKey, 'won', 1);
            } else {
                // In-Memory Update
                const stats = global.playerStats.get(handle) || { played: 0, won: 0 };
                stats.played += 1;
                if (isWinner) stats.won += 1;
                global.playerStats.set(handle, stats);
            }
        }

        // Execute Redis/KV Pipeline
        if (pipeline) await pipeline.exec();

        // Recalculate Ratios and Update Leaderboard
        for (const player of gameState.players) {
            const handle = player.twitterHandle || player.name || player.id;

            let played = 0;
            let won = 0;

            if (useRedis) {
                const stats = await redisClient.hgetall(`user:stats:${handle}`);
                if (stats) {
                    played = parseInt(stats.played || 0);
                    won = parseInt(stats.won || 0);
                }
            } else if (useKV) {
                const stats = await kvClient.hgetall(`user:stats:${handle}`);
                if (stats) {
                    played = parseInt(stats.played || 0);
                    won = parseInt(stats.won || 0);
                }
            } else {
                const stats = global.playerStats.get(handle);
                if (stats) {
                    played = stats.played;
                    won = stats.won;
                }
            }

            if (played > 0) {
                // Calculate Win Ratio (percentage)
                const winRatio = (won / played) * 100;
                const score = winRatio + (played * 0.0001);

                if (useRedis) {
                    await redisClient.zadd('leaderboard', score, handle);
                } else if (useKV) {
                    await kvClient.zadd('leaderboard', { score: score, member: handle });
                } else {
                    const stats = global.playerStats.get(handle);
                    stats.score = score;
                    stats.winRate = winRatio; // Store pure ratio for display
                    global.playerStats.set(handle, stats);
                }
            }
        }
    },

    getLeaderboard: async () => {
        const CAP = 20; // Cap to Top 20

        if (useRedis) {
            const topMembers = await redisClient.zrevrange('leaderboard', 0, CAP - 1, 'WITHSCORES');
            const result = [];
            for (let i = 0; i < topMembers.length; i += 2) {
                result.push({
                    rank: (i / 2) + 1,
                    name: topMembers[i],
                    winRate: Math.floor(parseFloat(topMembers[i + 1])).toFixed(1)
                });
            }
            return result;
        }

        if (useKV) {
            const topMembers = await kvClient.zrange('leaderboard', 0, CAP - 1, { rev: true, withScores: true });
            if (Array.isArray(topMembers)) {
                if (topMembers.length > 0 && typeof topMembers[0] === 'string') {
                    const result = [];
                    for (let i = 0; i < topMembers.length; i += 2) {
                        result.push({
                            rank: (i / 2) + 1,
                            name: topMembers[i],
                            winRate: Math.floor(parseFloat(topMembers[i + 1])).toFixed(1)
                        });
                    }
                    return result;
                }
                return topMembers.map((item, index) => ({
                    rank: index + 1,
                    name: item.member,
                    winRate: Math.floor(item.score).toFixed(1)
                }));
            }
            return [];
        }

        if (global.playerStats) {
            const sorted = Array.from(global.playerStats.entries())
                .map(([name, stats]) => ({
                    name,
                    score: stats.score || 0,
                    winRate: stats.winRate || 0
                }))
                .sort((a, b) => b.score - a.score)
                .slice(0, CAP);

            return sorted.map((item, index) => ({
                rank: index + 1,
                name: item.name,
                winRate: item.winRate.toFixed(1)
            }));
        }

        return [];
    }
};
