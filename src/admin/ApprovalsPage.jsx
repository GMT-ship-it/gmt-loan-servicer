import React, { useEffect, useState } from 'react';

// Simple approvals dashboard to display pending gmt_approval_requests with full payload
export default function ApprovalsPage() {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/admin/approvals/pending')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load pending approvals');
        return res.json();
      })
      .then(data => {
        // Expect data to be an array of { id, payload } with full JSONB payload in payload field
        setPending(data || []);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const execute = async (row, action) => {
    const reason = prompt(`Reason for ${action} approval for id ${row.id}:`);
    if (!reason || reason.trim() === '') {
      alert('Reason is required.');
      return;
    }
    const resp = await fetch('/api/admin/approvals/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' , 'X-Requested-With':'XMLHttpRequest' },
      body: JSON.stringify({ id: row.id, action, reason })
    });
    if (resp.ok) {
      // refresh or mark
      setPending(p => p.filter(r => r.id !== row.id));
    } else {
      const err = await resp.text();
      alert('Failed: ' + err);
    }
  };

  if (loading) return <div>Loading pending approvals...</div>;
  if (error) return <div>Error: {error}</div>;
  return (
    <div className="approvals">
      <h2>Pending GMT Approvals</h2>
      <p>Full JSONB payload displayed in each row for auditing.</p>
      {pending.length === 0 ? (
        <div>No pending approvals.</div>
      ) : (
        <table border={1} cellPadding={6} cellSpacing={0} style={{borderCollapse:'collapse'}}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Payload (full)</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pending.map((r)=> (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td><pre style={{maxHeight:200, overflow:'auto'}}>{JSON.stringify(r.payload, null, 2)}</pre></td>
                <td>
                  <button onClick={()=>execute(r, 'approve')}>Approve</button>
                  <button onClick={()=>execute(r, 'reject')} style={{marginLeft:8}}>Reject</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
