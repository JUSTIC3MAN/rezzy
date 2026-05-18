import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { name, score } = req.body;

        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return res.status(400).json({ error: 'Name is required' });
        }
        
        const cleanName = name.trim().substring(0, 7);
        
        if (score === undefined || typeof score !== 'number' || score < 0) {
            return res.status(400).json({ error: 'Valid score is required' });
        }

        const member = JSON.stringify({
            name: cleanName,
            score: score,
            timestamp: Date.now()
        });

        await redis.zadd('leaderboard', score, member);

        return res.status(200).json({ success: true, message: 'Score submitted successfully' });
    } catch (error) {
        console.error('Error submitting score:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
