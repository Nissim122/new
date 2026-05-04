import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const url = process.argv[2] || 'http://localhost:3000';

const screenshotDir = path.join(__dirname, 'temporary screenshots');
if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });

const devices = [
  { name: 'mobile-375',  width: 375,  height: 812, scale: 2 },
  { name: 'mobile-414',  width: 414,  height: 896, scale: 2 },
  { name: 'tablet-768',  width: 768,  height: 1024, scale: 2 },
  { name: 'desktop-1280', width: 1280, height: 800, scale: 1 },
  { name: 'wide-1920',  width: 1920, height: 1080, scale: 1 },
];

const browser = await puppeteer.launch({
  headless: true,
  executablePath: 'C:/Users/nisim/.cache/puppeteer/chrome/win64-146.0.7680.153/chrome-win64/chrome.exe',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  timeout: 60000,
});

for (const d of devices) {
  const page = await browser.newPage();
  await page.setViewport({ width: d.width, height: d.height, deviceScaleFactor: d.scale });
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  // Reveal all scroll-animated elements
  await page.evaluate(() => {
    document.querySelectorAll('.reveal, .zz-node').forEach(el => {
      el.classList.add('visible', 'shown');
    });
  });
  await new Promise(r => setTimeout(r, 1000));

  // Auto-increment filename
  let n = 1;
  while (fs.existsSync(path.join(screenshotDir, `dev-${d.name}-${n}.png`))) n++;
  const outPath = path.join(screenshotDir, `dev-${d.name}-${n}.png`);

  await page.screenshot({ path: outPath, fullPage: true });
  await page.close();
  console.log(`Saved: ${outPath}`);
}

await browser.close();
console.log('Done.');
