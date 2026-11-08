'use strict';
const fs = require('node:fs');
const url = 'https://www.vinci-autoroutes.com/fr/conseils/autoroute-mode-demploi/tarifs-peage-vinci-autoroutes/';
(async () => {
  const out = { source: url, checked_at: new Date().toISOString(), candidates: [], errors: [] };
  try {
    const response = await fetch(url, { headers: { 'user-agent': 'ConvoyageUltra-SourceAudit/1.0' }, signal: AbortSignal.timeout(25000) });
    out.http_status = response.status;
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const html = await response.text();
    const decoded = html.replaceAll('&amp;', '&').replaceAll('\/', '/').replaceAll('&#038;', '&');
    const matches = [...decoded.matchAll(/(?:href|data-url|src)\s*=\s*["']([^"']+)["']/gi), ...decoded.matchAll(/(https?:\/\/[^\s"'<>]+\.(?:txt|csv|pdf)(?:\?[^\s"'<>]*)?)/gi)];
    for (const match of matches) {
      try {
        const candidate = new URL(match[1], url);
        if (candidate.protocol === 'https:' && /(^|\.)(?:vinci-autoroutes\.com|vinci-autoroutes\.fr)$/i.test(candidate.hostname) && /\.(?:txt|csv|pdf)(?:$|\?)/i.test(candidate.href)) out.candidates.push(candidate.href);
      } catch { /* ignore malformed URLs */ }
    }
    out.candidates = [...new Set(out.candidates)].sort();
    out.html_bytes = Buffer.byteLength(html);
  } catch (error) { out.errors.push(String(error.message || error)); }
  fs.mkdirSync('artifacts/vinci-sources', { recursive: true });
  fs.writeFileSync('artifacts/vinci-sources/decouverte.json', JSON.stringify(out, null, 2) + '\n');
  console.log(JSON.stringify({ http_status: out.http_status, candidates: out.candidates.length, urls: out.candidates, errors: out.errors }));
  if (out.errors.length) process.exitCode = 1;
})();
