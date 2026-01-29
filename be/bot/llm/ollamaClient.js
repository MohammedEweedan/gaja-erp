const OLLAMA = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const MODEL = process.env.LLM_MODEL || 'gaja-bot';

async function chat(messages, opts = {}) {
  const res = await fetch(`${OLLAMA}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, messages, stream: false, ...opts }),
  });
  if (!res.ok) throw new Error(`ollama error ${res.status}`);
  return res.json();
}

module.exports = { chat };
