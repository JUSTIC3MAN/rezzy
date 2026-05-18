import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const topScores = await redis.zrevrange('leaderboard', 0, 9);
        
        const parsedScores = topScores.map(member => {
            try {
                return typeof member === 'string' ? JSON.parse(member) : member;
            } catch (e) {
                return null;
            }
        }).filter(item => item !== null);

        return res.status(200).json({ success: true, scores: parsedScores });
    } catch (error) {
        console.error('Error fetching scores:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
