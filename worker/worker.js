// 國土測繪中心 3D 建物 API 中繼站（Cloudflare Worker）
// NLSC 只允許 3dmaps.nlsc.gov.tw 跨域呼叫，這裡代為轉送並補上 CORS。
// 只開放查詢指令，只接受自己網站的來源。

const ALLOWED_ORIGINS = [
  'https://mnj711211-glitch.github.io',
  'http://localhost:3003',
];
const ALLOWED_CMDS = ['OV_SEARCHBYINTERSECT', 'OV_SEARCHBYDISTANCE', 'OV_GET_ENT_FIELDSANDATTRS'];
const UPSTREAMS = [
  'https://mapserver02.nlsc.gov.tw/oview/docmd?cmd=',
  'https://mapserver01.nlsc.gov.tw/oview/docmd?cmd=',
  'https://mapserver51.nlsc.gov.tw/oview/docmd?cmd=',
];

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') || '';
    if (!ALLOWED_ORIGINS.includes(origin)) return new Response('forbidden', { status: 403 });
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors(origin) });
    if (request.method !== 'POST') return new Response('method', { status: 405, headers: cors(origin) });

    const cmd = new URL(request.url).searchParams.get('cmd') || '';
    if (!ALLOWED_CMDS.includes(cmd)) return new Response('bad cmd', { status: 400, headers: cors(origin) });
    const body = await request.text();
    if (body.length > 20000) return new Response('too large', { status: 413, headers: cors(origin) });

    let lastErr = '';
    for (const up of UPSTREAMS) {
      try {
        const r = await fetch(up + cmd, {
          method: 'POST',
          body,
          headers: { 'Content-Type': 'application/json', 'Referer': 'https://3dmaps.nlsc.gov.tw/FrontMap/' },
        });
        if (!r.ok) { lastErr = 'HTTP ' + r.status; continue; }
        return new Response(await r.text(), {
          headers: { ...cors(origin), 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400' },
        });
      } catch (e) { lastErr = String(e); }
    }
    return new Response(JSON.stringify({ SUCCESS: false, ERRMSG: lastErr }), {
      status: 502, headers: { ...cors(origin), 'Content-Type': 'application/json' },
    });
  },
};
