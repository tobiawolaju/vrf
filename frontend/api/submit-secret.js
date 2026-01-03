import { db } from '../src/lib/store.js';

/**
 * Secret Submission API (Vercel)
 * Stores the userReveal secret in KV/Redis so the persistent Crank can find it.
 */
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const { roundId, userReveal } = req.body;
        if (!roundId || !userReveal) {
            return res.status(400).json({ error: 'Missing roundId or userReveal' });
        }

        console.log(`🔑 [Vercel] Storing secret for round ${roundId}`);

        // Store in DB with an expiration (e.g. 1 hour)
        await db.setSecret(roundId.toString(), userReveal);

        res.status(200).json({ success: true });
    } catch (e) {
        console.error('Submit-Secret API Error:', e);
        res.status(500).json({ error: 'Internal Server Error', details: e.message });
    }
}
