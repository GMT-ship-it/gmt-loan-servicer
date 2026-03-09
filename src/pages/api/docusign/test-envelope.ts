import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    res.status(200).json({ 
        success: true, 
        message: 'DocuSign test envelope triggered successfully', 
        envelopeId: 'mock-env-123' 
    });
}
