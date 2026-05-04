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

await page.evaluate(() => {
  document.querySelectorAll('.reveal').forEach(el => el.classList.add('visible'));
});
await new Promise(r => setTimeout(r, 1000));

// 1. Integrations marquee
const marquee = await page.$('section[style*="padding: 2rem 0 2.25rem"]');
if (marquee) {
  await marquee.screenshot({ path: path.join(dir, 'check-1-marquee.png') });
  console.log('Saved check-1-marquee.png');
} else {
  console.log('MISSING: marquee section');
}

// 2. About section
const about = await page.$('#about');
if (about) {
  await about.screenshot({ path: path.join(dir, 'check-2-about.png') });
  console.log('Saved check-2-about.png');
} else {
  console.log('MISSING: #about section');
}

// 3. WhatsApp button - take a full-page screenshot and crop bottom-left
const fullDims = await page.evaluate(() => ({
  w: document.documentElement.scrollWidth,
  h: document.documentElement.scrollHeight
}));

// Screenshot bottom portion where WhatsApp button overlays
await page.screenshot({
  path: path.join(dir, 'check-3-wa-btn.png'),
  clip: { x: 0, y: fullDims.h - 300, width: 300, height: 300 }
});
console.log('Saved check-3-wa-btn.png');

// 4. Mobile view check (375px)
await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 2 });
await new Promise(r => setTimeout(r, 500));

const aboutMobile = await page.$('#about');
if (aboutMobile) {
  await aboutMobile.screenshot({ path: path.join(dir, 'check-4-about-mobile.png') });
  console.log('Saved check-4-about-mobile.png');
}

const marqueeMobile = await page.$('section[style*="padding: 2rem 0 2.25rem"]');
if (marqueeMobile) {
  await marqueeMobile.screenshot({ path: path.join(dir, 'check-5-marquee-mobile.png') });
  console.log('Saved check-5-marquee-mobile.png');
}

await browser.close();
