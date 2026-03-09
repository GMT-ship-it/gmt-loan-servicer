// pages/api/auth/quickbooks/callback.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import path from 'path'

function tokenPath(){
  return '/root/.openclaw/credentials/quickbooks_tokens.json'
}

export default async function handler(req: NextApiRequest, res: NextApiResponse){
  const code = req.query?.code as string | undefined
  const realmId = req.query?.realmId as string | undefined

  if(!code || !realmId){
    return res.status(400).json({error:'Missing code or realmId in callback'})
  }

  const clientId = process.env.QUICKBOOKS_CLIENT_ID || ''
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET || ''
  const redirectUri = process.env.QUICKBOOKS_REDIRECT_URI || 'http://localhost:3000/api/auth/quickbooks/callback'
  
  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  try {
    const bodyArgs = new URLSearchParams()
    bodyArgs.append('grant_type', 'authorization_code')
    bodyArgs.append('code', code)
    bodyArgs.append('redirect_uri', redirectUri)

    const tokenRes = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${authHeader}`
      },
      body: bodyArgs
    })
    
    if(!tokenRes.ok){
      const t = await tokenRes.text()
      return res.status(500).json({error: 'Token exchange failed', text: t})
    }

    const tokenData = await tokenRes.json()
    tokenData.realmId = realmId

    const p = tokenPath()
    const dir = path.dirname(p)
    if(!fs.existsSync(dir)) fs.mkdirSync(dir, {recursive:true})
    fs.writeFileSync(p, JSON.stringify(tokenData, null, 2), 'utf8')

    res.status(200).json({ok: true, message: 'Tokens saved locally in credentials store.', tokens: tokenData})
  } catch (err: any) {
    res.status(500).json({error: err.message})
  }
}
