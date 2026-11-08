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
    for (const [operator, label] of labels) {
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
      } catch (error) { entry.error = String(error.message || error).slice(0, 500); }
    }
  } finally {
    await browser.close();
    fs.writeFileSync(path.join(dir, 'rapport.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
