/**
 * seo-updater.mjs
 * סורק אתרי מתחרים, מחלץ מילות מפתח, ומעדכן:
 *   1. index.html — meta description + keywords (seedKeywords תמיד ראשונים)
 *   2. blog.html  — meta keywords
 *   3. posts/*.html — meta keywords ספציפיים לכל מאמר
 *
 * Usage: node seo-updater.mjs [--dry-run]
 */

import { readFile, writeFile, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

const DRY_RUN = process.argv.includes('--dry-run');
const BASE_DIR = process.cwd();
const INDEX_PATH = join(BASE_DIR, 'index.html');
const BLOG_PATH  = join(BASE_DIR, 'blog.html');
const POSTS_DIR   = join(BASE_DIR, 'posts');
const SITEMAP_PATH = join(BASE_DIR, 'sitemap.xml');
const CONFIG_PATH = join(BASE_DIR, 'seo-config.json');

// ─── HTML helpers ─────────────────────────────────────────────────────────────

function stripHtmlTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractMeta(html, name) {
  const m =
    html.match(new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']*?)["']`, 'i')) ||
    html.match(new RegExp(`<meta[^>]+content=["']([^"']*?)["'][^>]+name=["']${name}["']`, 'i'));
  return m ? m[1] : null;
}

function extractTitle(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? stripHtmlTags(m[1]) : null;
}

function extractHeadings(html) {
  const matches = [];
  const re = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi;
  let m;
  while ((m = re.exec(html)) !== null) matches.push(stripHtmlTags(m[1]));
  return matches.join(' ');
}

function extractParagraphs(html, maxChars = 2000) {
  const matches = [];
  const re = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let m, total = 0;
  while ((m = re.exec(html)) !== null && total < maxChars) {
    const text = stripHtmlTags(m[1]);
    matches.push(text);
    total += text.length;
  }
  return matches.join(' ').slice(0, maxChars);
}

// ─── Keyword helpers ──────────────────────────────────────────────────────────

function tokenizeHebrew(text) {
  return text.match(/[א-ת]{2,}|[a-zA-Z]{3,}/g) || [];
}

function buildFrequencyMap(texts, stopWords, minLen) {
  const stopSet = new Set(stopWords.map(w => w.trim()));
  const freq = {};
  for (const text of texts) {
    for (const token of tokenizeHebrew(text)) {
      const word = token.trim();
      if (word.length < minLen || stopSet.has(word)) continue;
      freq[word] = (freq[word] || 0) + 1;
    }
  }
  return freq;
}

function topN(freq, n) {
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([word]) => word);
}

// seedKeywords תמיד ראשונים, ואחריהם מילים מהמתחרים (ללא כפילות)
function mergeKeywords(seedKeywords, competitorKeywords, total) {
  const seen = new Set(seedKeywords.map(k => k.toLowerCase()));
  const extra = competitorKeywords.filter(k => !seen.has(k.toLowerCase()));
  return [...seedKeywords, ...extra].slice(0, total);
}

// ─── Meta tag updaters ────────────────────────────────────────────────────────

function updateMetaTag(html, name, newContent) {
  const patternName = new RegExp(
    `(<meta\\s+name=["']${name}["']\\s+content=["'])([^"']*)(["'])`, 'i'
  );
  const patternContent = new RegExp(
    `(<meta\\s+content=["'])([^"']*)(["']\\s+name=["']${name}["'])`, 'i'
  );
  if (patternName.test(html))    return html.replace(patternName,    `$1${newContent}$3`);
  if (patternContent.test(html)) return html.replace(patternContent, `$1${newContent}$3`);
  return null;
}

function updateOgTag(html, property, newContent) {
  const pattern = new RegExp(
    `(<meta\\s+property=["']${property}["']\\s+content=["'])([^"']*)(["'])`, 'i'
  );
  const patternAlt = new RegExp(
    `(<meta\\s+content=["'])([^"']*)(["']\\s+property=["']${property}["'])`, 'i'
  );
  if (pattern.test(html))    return html.replace(pattern,    `$1${newContent}$3`);
  if (patternAlt.test(html)) return html.replace(patternAlt, `$1${newContent}$3`);
  return null;
}

function upsertKeywordsTag(html, newKeywords) {
  const existing = extractMeta(html, 'keywords');
  if (existing !== null) {
    return updateMetaTag(html, 'keywords', newKeywords) || html;
  }
  // הוסף אחרי meta description
  const insertAfter = /<meta[^>]+name=["']description["'][^>]*>/i;
  const m = html.match(insertAfter);
  if (!m) return html;
  const tag = `\n  <meta name="keywords" content="${newKeywords}" />`;
  return html.replace(insertAfter, m[0] + tag);
}

// ─── Description protection ───────────────────────────────────────────────────

function shouldProtectDescription(currentDesc, protectTerms) {
  return protectTerms.some(term => currentDesc.includes(term));
}

// ─── Fetch competitor ─────────────────────────────────────────────────────────

async function fetchCompetitor(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SEO-Bot/1.0)' },
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    return {
      url,
      title:       extractTitle(html),
      description: extractMeta(html, 'description'),
      headings:    extractHeadings(html),
      paragraphs:  extractParagraphs(html),
    };
  } catch (err) {
    console.warn(`  ⚠️  נכשל: ${url} — ${err.message}`);
    return null;
  }
}

// ─── Update index.html ────────────────────────────────────────────────────────

async function updateIndexPage(config, competitorKeywords) {
  const { seedKeywords, descriptionProtectTerms, topKeywordsCount } = config;

  if (!existsSync(INDEX_PATH)) {
    console.error(`\n❌ לא נמצא: ${INDEX_PATH}`);
    return;
  }

  let html = await readFile(INDEX_PATH, 'utf8');
  const originalHtml = html;

  const finalKeywords = mergeKeywords(seedKeywords, competitorKeywords, topKeywordsCount + seedKeywords.length);
  const newKeywordsStr = finalKeywords.join(', ');

  // Keywords
  html = upsertKeywordsTag(html, newKeywordsStr);

  // Description — רק אם לא מכיל מונחי מותג
  const currentDesc = extractMeta(html, 'description') || '';
  if (!shouldProtectDescription(currentDesc, descriptionProtectTerms)) {
    const topHebrew = finalKeywords.filter(w => /[א-ת]/.test(w)).slice(0, 6);
    const newDesc = `קליקס אוטומציות (Clix) — ${topHebrew.slice(0, 3).join(', ')}. `
      + `חיבור מערכות: Make, Monday, WhatsApp ו-CRM לעסק שלך. `
      + `${topHebrew.slice(3, 6).join(', ')}. השאר פרטים ותקבל ייעוץ חינם.`;

    const updatedDesc = updateMetaTag(html, 'description', newDesc);
    if (updatedDesc) { html = updatedDesc; }

    const updatedOgDesc = updateOgTag(html, 'og:description', newDesc);
    if (updatedOgDesc) { html = updatedOgDesc; }

    const updatedTwitterDesc = updateMetaTag(html, 'twitter:description', newDesc);
    if (updatedTwitterDesc) { html = updatedTwitterDesc; }

    console.log('  ✏️  עודכן: description (לא הכיל מונחי מותג)');
  } else {
    console.log('  🔒 description מוגן (מכיל מונחי מותג) — לא שונה');
  }

  if (html === originalHtml) {
    console.log('  ℹ️  אין שינויים ב-index.html');
    return null;
  }

  if (DRY_RUN) {
    console.log('  🧪 DRY RUN — index.html לא נשמר');
    return null;
  }
  await writeFile(INDEX_PATH, html, 'utf8');
  console.log('  💾 נשמר: index.html');
  return 'https://clix-automations.com/';
}

// ─── Update blog.html ─────────────────────────────────────────────────────────

async function updateBlogPage(config, competitorKeywords) {
  const { seedKeywords, descriptionProtectTerms } = config;

  if (!existsSync(BLOG_PATH)) return;

  let html = await readFile(BLOG_PATH, 'utf8');
  const originalHtml = html;

  const blogKeywords = mergeKeywords(
    [...seedKeywords, 'בלוג אוטומציה', 'מדריך אוטומציה', 'AI לעסקים'],
    competitorKeywords,
    20
  );

  html = upsertKeywordsTag(html, blogKeywords.join(', '));

  // עדכן description רק אם אינו מוגן
  const currentDesc = extractMeta(html, 'description') || '';
  if (!shouldProtectDescription(currentDesc, descriptionProtectTerms)) {
    const topHebrew = blogKeywords.filter(w => /[א-ת]/.test(w)).slice(0, 6);
    const newDesc = `בלוג קליקס אוטומציות — ${topHebrew.slice(0, 3).join(', ')}. `
      + `מדריכים ומאמרים על Make, Monday, WhatsApp ו-AI לעסק שלך. `
      + `${topHebrew.slice(3, 6).join(', ')}.`;

    const updatedDesc = updateMetaTag(html, 'description', newDesc);
    if (updatedDesc) { html = updatedDesc; }

    const updatedOgDesc = updateOgTag(html, 'og:description', newDesc);
    if (updatedOgDesc) { html = updatedOgDesc; }

    const updatedTwitterDesc = updateMetaTag(html, 'twitter:description', newDesc);
    if (updatedTwitterDesc) { html = updatedTwitterDesc; }

    console.log('  ✏️  עודכן: description (לא הכיל מונחי מותג)');
  } else {
    // description מוגן — סנכרן בכל זאת og:description ו-twitter:description
    const updatedOgDesc = updateOgTag(html, 'og:description', currentDesc);
    if (updatedOgDesc) { html = updatedOgDesc; }
    const updatedTwitterDesc = updateMetaTag(html, 'twitter:description', currentDesc);
    if (updatedTwitterDesc) { html = updatedTwitterDesc; }
    console.log('  🔒 description מוגן — סונכרן og ו-twitter');
  }

  if (html === originalHtml) {
    console.log('  ℹ️  אין שינויים ב-blog.html');
    return null;
  }

  if (DRY_RUN) {
    console.log('  🧪 DRY RUN — blog.html לא נשמר');
    return null;
  }
  await writeFile(BLOG_PATH, html, 'utf8');
  console.log('  💾 נשמר: blog.html');
  return 'https://clix-automations.com/blog.html';
}

// ─── Update posts/*.html ──────────────────────────────────────────────────────

async function updatePostPages(config, competitorKeywords) {
  const { postSeedKeywords, stopWords, minWordLength } = config;

  let files;
  try {
    files = await readdir(POSTS_DIR);
  } catch {
    console.warn('  ⚠️  תיקיית posts/ לא נמצאה');
    return;
  }

  const htmlFiles = files.filter(f => f.endsWith('.html') && f !== 'coming-soon.html');
  console.log(`\n📝 מעדכן ${htmlFiles.length} מאמרים...`);
  const modifiedUrls = [];

  for (const file of htmlFiles) {
    const filePath = join(POSTS_DIR, file);
    let html = await readFile(filePath, 'utf8');
    const originalHtml = html;

    // חלץ מילות מפתח ספציפיות מהמאמר עצמו
    const postTitle    = extractTitle(html)    || '';
    const postHeadings = extractHeadings(html) || '';
    const postText     = extractParagraphs(html, 1000);

    const postFreq = buildFrequencyMap(
      [postTitle, postHeadings, postText],
      stopWords,
      minWordLength
    );
    const postSpecific = topN(postFreq, 8);

    // בנה רשימת keywords: seed + ספציפי למאמר + מתחרים
    const finalKeywords = mergeKeywords(
      [...postSeedKeywords, ...postSpecific],
      competitorKeywords,
      20
    );

    html = upsertKeywordsTag(html, finalKeywords.join(', '));

    // סנכרן og:description ו-twitter:description עם meta description
    const postDesc = extractMeta(html, 'description') || '';
    if (postDesc) {
      const updatedOgDesc = updateOgTag(html, 'og:description', postDesc);
      if (updatedOgDesc) { html = updatedOgDesc; }
      const updatedTwitterDesc = updateMetaTag(html, 'twitter:description', postDesc);
      if (updatedTwitterDesc) { html = updatedTwitterDesc; }
    }

    if (html === originalHtml) {
      console.log(`  ℹ️  ללא שינוי: ${file}`);
      continue;
    }

    if (DRY_RUN) {
      console.log(`  🧪 DRY RUN: ${file} — keywords: ${finalKeywords.slice(0, 5).join(', ')}...`);
    } else {
      await writeFile(filePath, html, 'utf8');
      console.log(`  💾 נשמר: ${file}`);
      console.log(`       keywords: ${finalKeywords.slice(0, 5).join(', ')}...`);
      modifiedUrls.push(`https://clix-automations.com/posts/${file}`);
    }
  }
  return modifiedUrls;
}

// ─── Sitemap lastmod updater ──────────────────────────────────────────────────

async function updateSitemapLastmod(modifiedUrls) {
  if (!existsSync(SITEMAP_PATH) || modifiedUrls.length === 0) return;

  let xml = await readFile(SITEMAP_PATH, 'utf8');
  const today = new Date().toISOString().slice(0, 10);
  let changed = false;

  for (const url of modifiedUrls) {
    const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(<loc>${escaped}<\\/loc>\\s*<lastmod>)[^<]*(<\\/lastmod>)`, 'g');
    const updated = xml.replace(pattern, `$1${today}$2`);
    if (updated !== xml) { xml = updated; changed = true; }
  }

  if (!changed) return;

  if (DRY_RUN) {
    console.log(`\n  🧪 DRY RUN — sitemap.xml לא עודכן`);
  } else {
    await writeFile(SITEMAP_PATH, xml, 'utf8');
    console.log(`\n🗺️  עודכן lastmod ב-sitemap.xml עבור ${modifiedUrls.length} דפים`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🔍 Clix SEO Keyword Updater');
  console.log('═'.repeat(50));

  const config = JSON.parse(await readFile(CONFIG_PATH, 'utf8'));
  const { competitors, stopWords, minWordLength, topKeywordsCount, siteKeywords } = config;

  // סרוק מתחרים
  console.log(`\n📡 סורק ${competitors.length} אתרי מתחרים...\n`);
  const results = await Promise.all(competitors.map(fetchCompetitor));
  const valid = results.filter(Boolean);
  console.log(`\n✅ הצליח לסרוק: ${valid.length}/${competitors.length} אתרים`);

  // בנה מפת תדירות ממתחרים
  const allTexts = valid.flatMap(r => [
    r.title || '', r.description || '', r.headings || '', r.paragraphs || '',
  ]);
  const allStopWords = [...stopWords, ...siteKeywords.flatMap(k => k.split(' '))];
  const freq = buildFrequencyMap(allTexts, allStopWords, minWordLength);
  const competitorKeywords = topN(freq, topKeywordsCount);

  console.log('\n📊 מילות מפתח מובילות מהמתחרים:');
  competitorKeywords.forEach((kw, i) =>
    console.log(`  ${String(i + 1).padStart(2)}. ${kw} (${freq[kw]} הופעות)`)
  );

  // עדכן דפים
  console.log('\n🌐 מעדכן index.html...');
  const indexUrl = await updateIndexPage(config, competitorKeywords);

  console.log('\n📰 מעדכן blog.html...');
  const blogUrl = await updateBlogPage(config, competitorKeywords);

  const postUrls = await updatePostPages(config, competitorKeywords);

  const allModified = [indexUrl, blogUrl, ...postUrls].filter(Boolean);
  await updateSitemapLastmod(allModified);

  console.log('\n' + '═'.repeat(50));
  console.log(`✅ סיום — ${new Date().toLocaleString('he-IL')}\n`);
}

main().catch(err => {
  console.error('❌ שגיאה:', err.message);
  process.exit(1);
});
