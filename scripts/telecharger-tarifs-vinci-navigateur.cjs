'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { chromium } = require('playwright');
const pageUrl = 'https://www.vinci-autoroutes.com/fr/conseils/autoroute-mode-demploi/tarifs-peage-vinci-autoroutes/';
const labels = [['ASF','Tarifs ASF'],['ESCOTA','Tarifs Escota'],['A86','Tarifs A86'],['COFIROUTE_ARCOUR','Tarifs Cofiroute / Arcour'],['ARCOS','Tarifs Arcos']];
const dir = path.resolve('artifacts/vinci-sources/browser');
fs.mkdirSync(dir, { recursive: true });
const report = { page_url: pageUrl, checked_at: new Date().toISOString(), sources: [] };
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();
    await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    const events = [];
    context.on('page', p => { events.push({ type: 'new_page', url: p.url() }); p.on('framenavigated', f => { if (f === p.mainFrame()) events.push({ type: 'popup_navigation', url: f.url() }); }); });
    page.on('framenavigated', f => { if (f === page.mainFrame()) events.push({ type: 'navigation', url: f.url() }); });
    page.on('request', req => { if (/\\.txt(?:[?#]|$)|tarif|download/i.test(req.url())) events.push({ type: 'request', url: req.url() }); });
    page.on('response', res => { if (/\\.txt(?:[?#]|$)|tarif|download/i.test(res.url())) events.push({ type: 'response', url: res.url(), status: res.status(), content_type: res.headers()['content-type'] }); });
    const known = {
      ESCOTA: 'https://public-content.vinci-autoroutes.com/PDF/Tarifs-peage-Escota/Tarifs_ESCOTA.txt',
      A86: 'https://public-content.vinci-autoroutes.com/PDF/Tarifs-Duplex-A86/Tarifs_A86.txt',
      COFIROUTE_ARCOUR: 'https://public-content.vinci-autoroutes.com/PDF/Tarifs-peage-Cofiroute/Tarifs_Cofiroute_Arcour.txt',
      ARCOS: 'https://public-content.vinci-autoroutes.com/PDF/Tarifs-peage-Arcos/Tarifs_Arcos.txt',
    };
    for (const [operator, label] of labels) {
      if (known[operator]) {
        const entry = { operator, label, download_url: known[operator], status: 'not_downloaded' };
        report.sources.push(entry);
        try {
          const response = await context.request.get(known[operator], { timeout: 25000 });
          entry.http_status = response.status();
          entry.content_type = response.headers()['content-type'];
          const bytes = await response.body();
          entry.bytes = bytes.length;
          if (!response.ok() || bytes.length === 0) { entry.error = 'HTTP failure or empty response'; continue; }
          const destination = path.join(dir, 'Tarifs_' + operator + '.txt');
          fs.writeFileSync(destination, bytes);
          entry.sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
          entry.status = 'downloaded_unverified';
        } catch (error) { entry.error = String(error.message || error).slice(0, 500); }
        continue;
      }
      const eventStart = events.length;
      const entry = { operator, label, status: 'not_downloaded' };
      report.sources.push(entry);
      try {
        const target = page.getByText(label, { exact: true });
        entry.matches = await target.count();
        if (entry.matches !== 1) { entry.error = 'expected exactly one matching label'; continue; }
        const [download] = await Promise.all([
          page.waitForEvent('download', { timeout: 25000 }),
          target.click({ timeout: 15000 }),
        ]);
        const sourceUrl = download.url();
        const host = new URL(sourceUrl).hostname;
        entry.download_url = sourceUrl;
        if (!/(^|\.)(vinci-autoroutes\.com|vinci-autoroutes\.fr)$/.test(host)) {
          entry.error = 'download host not on official allowlist'; continue;
        }
        const failure = await download.failure();
        if (failure) { entry.error = failure; continue; }
        const destination = path.join(dir, 'Tarifs_' + operator + '.txt');
        await download.saveAs(destination);
        const bytes = fs.readFileSync(destination);
        entry.bytes = bytes.length;
        entry.sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
        entry.original_filename = download.suggestedFilename();
        entry.status = 'downloaded_unverified';
        if (!bytes.length) { entry.status = 'empty'; fs.unlinkSync(destination); }
      } catch (error) { entry.error = String(error.message || error).slice(0, 500); } finally { entry.browser_events = events.slice(eventStart, eventStart + 30); entry.current_url = page.url(); }
    }
  } finally {
    await browser.close();
    fs.writeFileSync(path.join(dir, 'rapport.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
