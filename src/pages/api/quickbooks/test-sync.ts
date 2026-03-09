import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    res.status(200).json({ 
        success: true, 
        message: 'QuickBooks sync completed successfully', 
        syncId: 'mock-qb-456' 
    });
}
