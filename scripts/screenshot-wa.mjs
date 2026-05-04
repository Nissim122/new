import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(__dirname, 'temporary screenshots');

const browser = await puppeteer.launch({
  headless: true,
  executablePath: 'C:/Users/nisim/.cache/puppeteer/chrome/win64-146.0.7680.153/chrome-win64/chrome.exe',
  args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu'],
  timeout: 60000,
});

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
await page.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 30000 });

// Reveal all
await page.evaluate(() => {
  document.querySelectorAll('.reveal').forEach(el => el.classList.add('visible'));
});
await new Promise(r => setTimeout(r, 1000));

// Scroll to bottom so footer is visible as context
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await new Promise(r => setTimeout(r, 500));

// fullPage:false captures the viewport at current scroll position — fixed elements visible
await page.screenshot({
  path: path.join(dir, 'check-8-wa-fixed.png'),
  fullPage: false,
});
console.log('Saved check-8-wa-fixed.png');

// Also: check WA button properties
const waBtn = await page.$('#wa-float-btn');
const info = await page.evaluate(el => {
  const r = el.getBoundingClientRect();
  const cs = window.getComputedStyle(el);
  return {
    rect: { x: r.x, y: r.y, w: r.width, h: r.height },
    visible: cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0',
    href: el.getAttribute('href'),
    zIndex: cs.zIndex,
  };
}, waBtn);
console.log('WA button info:', JSON.stringify(info, null, 2));

await browser.close();
