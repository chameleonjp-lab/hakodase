const SUPABASE_URL = 'https://mlpnjgezrnhdxsxolyzj.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_drzcy0v97knU6FgjqSgBHw_0A9XPdFM';

async function callRpc(name, payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
    if (!response.ok) throw new Error(`${name}: ${response.status}`);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

export function submitScore({ displayName, score, clientVersion }) {
  return callRpc('submit_score', {
    p_display_name: displayName,
    p_game_slug: 'hakodase',
    p_score: Math.round(score),
    p_client_version: clientVersion,
  });
}

export async function getTopRanking() {
  const rows = await callRpc('get_best_score_ranking', { p_game_slug: 'hakodase', p_limit: 10 });
  return Array.isArray(rows) ? rows.slice(0, 10) : [];
}

export function formatRankingScore(score) {
  const milliseconds = Number(score);
  return Number.isFinite(milliseconds) ? `${(milliseconds / 1000).toFixed(2)}秒` : '—';
}
