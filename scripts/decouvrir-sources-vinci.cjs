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
    const anchors = [...decoded.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
    out.tariff_anchors = anchors.map(m => ({ href: m[1], label: m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160) })).filter(x => /tarif|grille|asf|escota|cofiroute|arcos|a86|télécharg|telecharg/i.test(x.href + ' ' + x.label)).slice(0, 100);
    out.txt_contexts = ['Tarifs ASF', 'Tarifs Escota', 'Tarifs A86', 'Tarifs Cofiroute', 'Tarifs Arcos'].map(label => {
      const index = decoded.toLowerCase().indexOf(label.toLowerCase());
      return { label, found: index >= 0, html_context: index < 0 ? null : decoded.slice(Math.max(0, index - 350), index + 250).replace(/\s+/g, ' ').slice(0, 600) };
    });
    const embedded = [...decoded.matchAll(/[^\s"'<>]{1,350}\.(?:txt|csv)(?:\?[^\s"'<>]*)?/gi)];
    out.embedded_tariff_files = [...new Set(embedded.map(m => m[0]))].filter(x => /tarif|asf|escota|cofiroute|arcour|arcos|a86/i.test(x)).slice(0, 100);
    out.framework_hints = {
      next_data: decoded.includes('__NEXT_DATA__'),
      next_flight: decoded.includes('self.__next_f'),
      script_count: (decoded.match(/<script\b/gi) || []).length,
      txt_mentions: (decoded.match(/\.txt/gi) || []).length,
    };
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
  console.log(JSON.stringify({ http_status: out.http_status, candidates: out.candidates.length, urls: out.candidates, tariff_anchors: out.tariff_anchors, txt_contexts: out.txt_contexts, embedded_tariff_files: out.embedded_tariff_files, framework_hints: out.framework_hints, errors: out.errors }));
  if (out.errors.length) process.exitCode = 1;
})();
