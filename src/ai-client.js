// Talks to the local /api/chat endpoint (server/index.js), which holds the
// Anthropic API key server-side. Never call the Anthropic API directly from
// the browser — that would expose the key to anyone who opens devtools.
export async function askClaude(messages) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `AI request failed (${res.status})`);
  }

  const { reply } = await res.json();
  return reply;
}
