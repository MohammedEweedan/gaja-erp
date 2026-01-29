async function createAppointment(payload) {
  const base = process.env.API_BASE_URL || 'http://localhost';
  const res = await fetch(`${base}/api/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.API_TOKEN || ''}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`appointments api failed: ${res.status}`);
  return res.json();
}

module.exports = { createAppointment };
