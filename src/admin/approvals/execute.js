export default async function handler(req, res) {
  const { id, action, reason } = req.body;
  if (!id || !action || !reason) {
    return res.status(400).send('Missing fields');
  }
  // Here, call Supabase Edge Function or DB to record audit and perform action
  // For demo, just respond success
  res.status(200).json({ ok: true, id, action, reason });
}
