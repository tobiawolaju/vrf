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

import { determineWinner } from './gameLogic.js';

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
    processGameStats: async (gameState) => {
        // Only process if game ended and not yet recorded
        if (gameState.phase !== 'ended' || gameState.statsRecorded) return gameState;

        try {
            const winner = determineWinner(gameState);
            if (!winner) {
                console.warn("No winner found for game", gameState.gameCode);
                return gameState;
            }

            // Helper to update player stats
            const updatePlayerStats = async (player) => {
                const isWinner = player.id === winner.id;
                const statsKey = `user:${player.id}:stats`;

                // Fields to update
                // Note: We use a simple JSON object for "user stats" storage for simplicity across Redis/KV/Memory
                let stats = { matches_played: 0, matches_won: 0, name: player.name, avatar: player.avatar };

                if (useRedis) {
                    const existing = await redisClient.get(statsKey);
                    if (existing) stats = JSON.parse(existing);
                } else if (useKV) {
                    const existing = await kvClient.get(statsKey);
                    if (existing) stats = existing;
                } else {
                    stats = global.userStats?.[player.id] || stats;
                }

                // Update values
                stats.matches_played = (stats.matches_played || 0) + 1;
                if (isWinner) {
                    stats.matches_won = (stats.matches_won || 0) + 1;
                }
                stats.name = player.name; // Update latest name
                stats.avatar = player.avatar; // Update latest avatar

                // Save back
                if (useRedis) {
                    await redisClient.set(statsKey, JSON.stringify(stats));
                    await redisClient.sadd('all_players', player.id);
                } else if (useKV) {
                    await kvClient.set(statsKey, stats);
                    await kvClient.sadd('all_players', player.id);
                } else {
                    global.userStats = global.userStats || {};
                    global.userStats[player.id] = stats;
                    global.allPlayers = global.allPlayers || new Set();
                    global.allPlayers.add(player.id);
                }
            };

            // Process all players in parallel
            await Promise.all(gameState.players.map(p => updatePlayerStats(p)));

            // Mark game as recorded
            gameState.statsRecorded = true;
            return gameState;

        } catch (error) {
            console.error("Failed to update stats:", error);
            // Return gameState even if stats failed, to avoid breaking game flow
            return gameState;
        }
    },
    getLeaderboard: async () => {
        let players = [];

        if (useRedis) {
            const playerIds = await redisClient.smembers('all_players');
            if (playerIds && playerIds.length > 0) {
                // Fetch all stats in parallel
                // Use mget if possible, but keys might be dynamic, so map get
                // Redis 'mget' expects individual keys, loop is fine for reasonable size or pipeline
                const pipeline = redisClient.pipeline();
                playerIds.forEach(id => pipeline.get(`user:${id}:stats`));
                const results = await pipeline.exec();

                players = results.map(([err, res]) => res ? JSON.parse(res) : null).filter(p => p);
            }
        } else if (useKV) {
            const playerIds = await kvClient.smembers('all_players');
            if (playerIds && playerIds.length > 0) {
                // kvClient doesn't have standard pipeline in all versions, map get is safest
                players = await Promise.all(playerIds.map(id => kvClient.get(`user:${id}:stats`)));
                players = players.filter(p => p);
            }
        } else {
            if (global.allPlayers) {
                players = Array.from(global.allPlayers).map(id => global.userStats[id]).filter(p => p);
            }
        }

        // Calculate Win % and Sort
        // Win % = (wins / played) * 100
        const leaderboard = players.map(p => ({
            ...p,
            winRate: p.matches_played > 0 ? (p.matches_won / p.matches_played) : 0
        }));

        // Sort: WinRate DESC, then MatchesPlayed DESC (to favor more active players with same rate)
        leaderboard.sort((a, b) => {
            if (b.winRate !== a.winRate) return b.winRate - a.winRate;
            return b.matches_played - a.matches_played;
        });

        return leaderboard.slice(0, 500); // Top 500
    },
    getAllGames: async () => {
        // Not implemented for Redis/KV
        return useRedis || useKV ? {} : global.gameRooms;
    }
};
