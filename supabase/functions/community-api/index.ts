// Public gateway. Deployment must use verify_jwt=false: user JWT is verified below.
// No client-provided user ID, voter key or admin flag is trusted.
const url = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const allowed = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',');
const publicActions = new Set(['feed', 'comments', 'confession']);
Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'Vary': 'Origin', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS', 'X-Content-Type-Options': 'nosniff',
  };
  if (origin && allowed.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
  const send = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
  if (origin && !allowed.includes(origin)) return send({ error: 'Nedozvoljeno porijeklo.' }, 403);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return send({ error: 'Nedozvoljen zahtjev.' }, 405);
  try {
    // Bound actual bytes even if Content-Length is omitted or dishonest.
    const reader = req.body?.getReader();
    if (!reader) return send({ error: 'Nedostaje zahtjev.' }, 400);
    let size = 0; const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 32768) { await reader.cancel(); return send({ error: 'Zahtjev je prevelik.' }, 413); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size); let pos = 0;
    for (const chunk of chunks) { bytes.set(chunk, pos); pos += chunk.length; }
    const body = JSON.parse(new TextDecoder().decode(bytes));
    if (!body || typeof body !== 'object' || Array.isArray(body)) return send({ error: 'Neispravan zahtjev.' }, 400);
    const action = body.action;
    if (typeof action !== 'string' || !/^[a-z_]{1,30}$/.test(action)) return send({ error: 'Neispravna radnja.' }, 400);
    const args = body.args ?? {};
    if (!args || typeof args !== 'object' || Array.isArray(args)) return send({ error: 'Neispravan zahtjev.' }, 400);
    let uid: string | null = null;
    if (!publicActions.has(action)) {
      const token = req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
      if (!token) return send({ error: 'Potrebna je anonimna sesija.' }, 401);
      const response = await fetch(url + '/auth/v1/user', {
        headers: { apikey: serviceKey, Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) return send({ error: 'Sesija je istekla. Osvježi stranicu.' }, 401);
      const user = await response.json(); uid = user.id;
      if (!uid) return send({ error: 'Neispravna sesija.' }, 401);
      if (action.startsWith('admin_')) {
        if (user.is_anonymous !== false) return send({ error: 'Potreban je administratorski nalog sa dvofaktorskom potvrdom.' }, 403);
        // Token signature/expiry has just been checked by Auth. Never authorize on user_metadata.
        const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        if (payload.aal !== 'aal2' || !payload.session_id) return send({ error: 'Potreban je administratorski nalog sa dvofaktorskom potvrdom.' }, 403);
        args._session_id = payload.session_id;
      }
    }
    const response = await fetch(url + '/rest/v1/rpc/community_dispatch', {
      method: 'POST', headers: { apikey: serviceKey, Authorization: 'Bearer ' + serviceKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_uid: uid, p_action: action, p_args: args }), signal: AbortSignal.timeout(15000),
    });
    const result = await response.json();
    if (!response.ok) {
      const status = result.code === '42501' ? 403 : result.code === '28000' ? 401 : result.code === 'P0001' ? 400 : 500;
      return send({ error: status === 500 ? 'Radnja nije uspjela. Pokušaj ponovo.' : result.message }, status);
    }
    return send(result);
  } catch (error) {
    if (error instanceof SyntaxError) return send({ error: 'Neispravan zahtjev.' }, 400);
    return send({ error: 'Server trenutno nije dostupan. Pokušaj ponovo.' }, 503);
  }
});
