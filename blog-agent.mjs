/**
 * blog-agent.mjs
 * סוכן בלוג שבועי — סורק חדשות אוטומציה ו-AI, בוחר נושא רלוונטי,
 * כותב מאמר בעברית אנושי ומקצועי, ומפרסם לבלוג אוטומטית.
 *
 * Usage: node blog-agent.mjs [--dry-run]
 * Requires: GEMINI_API_KEY environment variable
 */

import { writeFile, readFile, mkdir, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { execFileSync } from 'child_process';

const DRY_RUN = process.argv.includes('--dry-run');
const BASE_DIR = process.cwd();
const DRAFTS_DIR = join(BASE_DIR, 'drafts');
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const TODAY = new Date().toISOString().split('T')[0];

function getSlug() {
  let n = 1;
  while (existsSync(join(DRAFTS_DIR, `${TODAY}-${n}.json`))) n++;
  return `${TODAY}-${n}`;
}

const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`;

const RSS_FEEDS = [
  { name: 'Make Blog',      url: 'https://www.make.com/en/blog/rss.xml' },
  { name: 'Zapier Blog',    url: 'https://zapier.com/blog/feeds/latest/' },
  { name: 'n8n Blog',       url: 'https://blog.n8n.io/rss/' },
  { name: 'Geektime',       url: 'https://www.geektime.co.il/feed/' },
  { name: 'The Verge AI',   url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml' },
  { name: 'TechCrunch AI',  url: 'https://techcrunch.com/category/artificial-intelligence/feed/' },
];

const CATEGORIES = {
  make:      { label: 'Make',           css: 'make',      he: 'Make & Zapier' },
  zapier:    { label: 'Zapier',         css: 'make',      he: 'Make & Zapier' },
  ai:        { label: 'AI כלים',        css: 'ai',        he: 'AI כלים' },
  monday:    { label: 'Monday.com',     css: 'monday',    he: 'Monday.com' },
  whatsapp:  { label: 'WhatsApp עסקי', css: 'whatsapp',  he: 'WhatsApp עסקי' },
  tips:      { label: 'טיפים',          css: 'tips',      he: 'טיפים' },
};

const TOPIC_FILE = join(BASE_DIR, 'next-topic.txt');

// ─── Topic Request ────────────────────────────────────────────────────────────

async function readTopicRequest() {
  if (!existsSync(TOPIC_FILE)) return null;
  try {
    const { mtimeMs } = await stat(TOPIC_FILE);
    if (Date.now() - mtimeMs > 7 * 24 * 60 * 60 * 1000) return null;
    const content = (await readFile(TOPIC_FILE, 'utf8')).trim();
    return content || null;
  } catch {
    return null;
  }
}

// ─── RSS Parsing ──────────────────────────────────────────────────────────────

function stripTags(str) {
  return (str || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseRssItems(xml, sourceName) {
  const items = [];
  const itemRe = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];
    const title = stripTags(block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '');
    const desc  = stripTags(block.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1] || '');
    if (title) items.push({ title, desc: desc.slice(0, 300), source: sourceName });
  }
  return items.slice(0, 5);
}

async function fetchRss(feed) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(feed.url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BlogBot/1.0)' },
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return parseRssItems(await res.text(), feed.name);
  } catch (err) {
    console.warn(`  ⚠️  נכשל: ${feed.name} — ${err.message}`);
    return [];
  }
}

// ─── Gemini API ───────────────────────────────────────────────────────────────

async function callGemini(prompt) {
  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.85, maxOutputTokens: 4096 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

function buildPrompt(newsItems) {
  const newsBlock = newsItems
    .slice(0, 15)
    .map((item, i) => `${i + 1}. [${item.source}] ${item.title}\n   ${item.desc}`)
    .join('\n\n');

  return `אתה כותב תוכן מקצועי עבור בלוג של CLIX Automations — חברה ישראלית לאוטומציות עסקיות.
הכותב הוא ניסים בנגייב, מומחה שעובד בשטח עם Make, Monday, WhatsApp Business, CRM ועוד.

סגנון כתיבה:
- אנושי, ישיר, מקצועי — לא שיווקי ולא רובוטי
- מדבר כמו מישהו שעשה את זה בעצמו, לא כמו מי שקרא עליו
- ללא ביטויים כמו: "בעידן הדיגיטלי", "כפי שציינתי", "לסיכום", "חשוב לציין"
- עם דוגמאות ספציפיות ומספרים אמיתיים כשאפשר
- עברית ישראלית טבעית, לא מתורגמת

חדשות האוטומציה השבוע:
${newsBlock}

המשימה:
1. בחר את הנושא הכי שימושי לבעלי עסקים קטנים-בינוניים בישראל.
2. כתוב מאמר בלוג בעברית, 500-700 מילים.
3. מבנה: כותרת ראשית → תתי-כותרות (h2) → דוגמה מעשית אחת → פסקת סיום עם קריאה לפעולה אחת, טבעית.
4. בחר קטגוריה אחת: make | zapier | ai | monday | whatsapp | tips
5. כתוב תקציר קצר (2 משפטים) לכרטיס הבלוג.
6. הערך מספר דקות קריאה (4–7).

החזר JSON בלבד, ללא markdown fences:
{
  "title": "כותרת המאמר",
  "category": "make|ai|monday|whatsapp|tips",
  "excerpt": "תקציר 2 משפטים",
  "readTime": 5,
  "content": "תוכן המאמר ב-HTML פשוט — p, h2, h3, ul, li בלבד"
}`;
}

function buildTopicPrompt(topic) {
  return `אתה כותב תוכן מקצועי עבור בלוג של CLIX Automations — חברה ישראלית לאוטומציות עסקיות.
הכותב הוא ניסים בנגייב, מומחה שעובד בשטח עם Make, Monday, WhatsApp Business, CRM ועוד.

סגנון כתיבה:
- אנושי, ישיר, מקצועי — לא שיווקי ולא רובוטי
- מדבר כמו מישהו שעשה את זה בעצמו, לא כמו מי שקרא עליו
- ללא ביטויים כמו: "בעידן הדיגיטלי", "כפי שציינתי", "לסיכום", "חשוב לציין"
- עם דוגמאות ספציפיות ומספרים אמיתיים כשאפשר
- עברית ישראלית טבעית, לא מתורגמת

הנושא המבוקש לשבוע הזה: ${topic}

המשימה:
1. כתוב מאמר בלוג בעברית על הנושא שצוין, 500-700 מילים.
2. מבנה: כותרת ראשית → תתי-כותרות (h2) → דוגמה מעשית אחת → פסקת סיום עם קריאה לפעולה אחת, טבעית.
3. בחר קטגוריה אחת: make | zapier | ai | monday | whatsapp | tips
4. כתוב תקציר קצר (2 משפטים) לכרטיס הבלוג.
5. הערך מספר דקות קריאה (4–7).

החזר JSON בלבד, ללא markdown fences:
{
  "title": "כותרת המאמר",
  "category": "make|ai|monday|whatsapp|tips",
  "excerpt": "תקציר 2 משפטים",
  "readTime": 5,
  "content": "תוכן המאמר ב-HTML פשוט — p, h2, h3, ul, li בלבד"
}`;
}

// ─── Draft HTML builder ───────────────────────────────────────────────────────

function hebrewDate(slug) {
  return new Date(slug.slice(0, 10)).toLocaleDateString('he-IL', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

function buildCardHtml(post, date) {
  const cat = CATEGORIES[post.category] || CATEGORIES.tips;
  return `      <!-- AGENT POST ${date} -->
      <article class="blog-card reveal" data-cats="${post.category}" style="transition-delay:0.05s;">
        <div class="blog-card-thumb-wrap">
          <picture>
            <source srcset="images/blog/${date}.webp" type="image/webp" />
            <img src="images/blog/${date}.jpg" alt="${post.title}" loading="lazy" />
          </picture>
        </div>
        <div class="blog-card-body">
          <span class="blog-tag ${cat.css}">${cat.label}</span>
          <a href="posts/${date}.html" class="blog-title">
            ${post.title}
          </a>
          <p class="blog-excerpt">
            ${post.excerpt}
          </p>
          <div class="blog-meta">
            <span>ניסים בנגייב</span>
            <span class="blog-meta-dot"></span>
            <span>${hebrewDate(date)}</span>
            <span class="blog-meta-dot"></span>
            <span>${post.readTime} דק' קריאה</span>
          </div>
        </div>
      </article>`;
}

function buildDraftHtml(post, date) {
  const cat = CATEGORIES[post.category] || CATEGORIES.tips;
  const cardHtml = buildCardHtml(post, date);

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>טיוטה: ${post.title}</title>
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;700;900&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box; }
  body { font-family: 'Heebo', sans-serif; background: #0e1628; color: #e2e8f8; direction: rtl; margin: 0; padding: 0; }
  .wrap { max-width: 740px; margin: 0 auto; padding: 2.5rem 1.5rem 5rem; }
  h1 { font-size: clamp(1.8rem,4vw,2.5rem); font-weight: 900; line-height: 1.2; margin-bottom: 1.2rem; }
  .draft-badge { display: inline-block; background: #e0176b; color: #fff; font-weight: 800; font-size: 0.78rem; letter-spacing: 0.05em; padding: 0.3rem 0.9rem; border-radius: 6px; margin-bottom: 1.2rem; }
  .meta-bar { display: flex; flex-wrap: wrap; gap: 1rem; background: rgba(33,150,176,0.1); border: 1px solid rgba(33,150,176,0.22); border-radius: 10px; padding: 0.9rem 1.2rem; margin-bottom: 2.2rem; font-size: 0.85rem; color: #5ecfec; }
  .content h2 { font-size: 1.35rem; font-weight: 800; color: #2196b0; margin: 2rem 0 0.6rem; }
  .content h3 { font-size: 1.1rem; font-weight: 700; color: #5ecfec; margin: 1.5rem 0 0.5rem; }
  .content p  { line-height: 1.8; margin-bottom: 1.1rem; color: #c8d8ee; }
  .content ul { padding-right: 1.4rem; margin-bottom: 1.2rem; }
  .content li { margin-bottom: 0.4rem; color: #c8d8ee; line-height: 1.7; }
  .section { background: rgba(255,255,255,0.035); border: 1px dashed rgba(33,150,176,0.28); border-radius: 12px; padding: 1.4rem; margin-top: 2.5rem; }
  .section-label { font-size: 0.75rem; font-weight: 800; letter-spacing: 0.08em; color: #5ecfec; text-transform: uppercase; margin-bottom: 0.8rem; }
  .card-preview-title { font-weight: 800; font-size: 1rem; color: #e2e8f8; margin-bottom: 0.4rem; }
  .card-preview-excerpt { font-size: 0.88rem; color: #8a9bbd; }
  pre { background: rgba(0,0,0,0.45); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 1rem; font-size: 0.75rem; overflow-x: auto; white-space: pre-wrap; color: #a0c4d8; direction: ltr; text-align: left; }
  .publish-cmd { margin-top: 2rem; background: rgba(33,150,176,0.08); border-radius: 10px; padding: 1.2rem 1.5rem; font-size: 0.88rem; color: #5ecfec; }
  .publish-cmd code { background: rgba(0,0,0,0.35); padding: 0.2rem 0.6rem; border-radius: 5px; font-family: monospace; }
</style>
</head>
<body>
<div class="wrap">
  <div class="draft-badge">⚠ טיוטה — לא פורסם</div>
  <h1>${post.title}</h1>
  <div class="meta-bar">
    <span>📁 ${cat.he}</span>
    <span>⏱ ${post.readTime} דק' קריאה</span>
    <span>📅 ${hebrewDate(date)}</span>
    <span>✍️ ניסים בנגייב</span>
  </div>
  <div class="content">
    ${post.content}
  </div>

  <div class="section" style="border-color: rgba(224,23,107,0.4);">
    <div class="section-label" style="color:#e0176b;">📸 תמונה נדרשת לפני פרסום</div>
    <p style="color:#c8d8ee;font-size:0.9rem;line-height:1.7;margin:0;">
      צור תמונה AI שקשורה למאמר ושמור אותה בנתיב:<br/>
      <code style="background:rgba(0,0,0,0.4);padding:0.2rem 0.6rem;border-radius:5px;font-family:monospace;color:#5ecfec;">images/blog/${date}.jpg</code><br/>
      (גודל מומלץ: 1280×720 px)<br/><br/>
      לאחר העלאה, הרץ: <code style="background:rgba(0,0,0,0.4);padding:0.2rem 0.6rem;border-radius:5px;font-family:monospace;color:#5ecfec;">node optimize-images.mjs</code><br/>
      — ידחס את התמונה ויצור גרסת WebP קלה יותר אוטומטית.
    </p>
  </div>

  <div class="section">
    <div class="section-label">תצוגה מקדימה — כרטיס בלוג</div>
    <div class="card-preview-title">${post.title}</div>
    <div class="card-preview-excerpt">${post.excerpt}</div>
  </div>

  <div class="section">
    <div class="section-label">HTML לכרטיס (לשימוש publish.mjs)</div>
    <pre>${cardHtml.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</pre>
  </div>

  <div class="publish-cmd">
    <strong>לפרסום:</strong> הרץ <code>node publish.mjs ${date}</code>
  </div>
</div>
</body>
</html>`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n✍️  CLIX Blog Agent');
  console.log('═'.repeat(50));

  if (!GEMINI_API_KEY) {
    console.error('❌ חסר: GEMINI_API_KEY');
    process.exit(1);
  }

  // 1. Check for user-requested topic
  const requestedTopic = await readTopicRequest();
  let raw;

  if (requestedTopic) {
    console.log(`\n📌 נושא שנבחר ידנית: "${requestedTopic}"`);
    console.log('🤖 כותב מאמר על הנושא המבוקש...');
    raw = await callGemini(buildTopicPrompt(requestedTopic));
  } else {
    // 1b. Fetch RSS for market research
    console.log(`\n📡 סורק ${RSS_FEEDS.length} מקורות חדשות...\n`);
    const allItems = (await Promise.all(RSS_FEEDS.map(fetchRss))).flat();
    console.log(`✅ נמצאו ${allItems.length} פריטים`);
    allItems.slice(0, 6).forEach((item, i) =>
      console.log(`  ${i + 1}. [${item.source}] ${item.title}`)
    );
    console.log('\n🤖 כותב מאמר עם Gemini...');
    raw = await callGemini(buildPrompt(allItems));
  }

  // 3. Parse JSON
  let post;
  try {
    const cleaned = raw.replace(/^```[a-z]*\n?/gm, '').replace(/^```$/gm, '').trim();
    post = JSON.parse(cleaned);
  } catch {
    console.error('❌ שגיאה בפענוח JSON:\n', raw.slice(0, 600));
    throw new Error('Gemini לא החזיר JSON תקין');
  }

  console.log(`\n📝 "${post.title}"`);
  console.log(`   קטגוריה: ${post.category} | ${post.readTime} דק' קריאה`);

  // 4. Save draft
  if (DRY_RUN) {
    console.log('\n🧪 DRY RUN — לא נשמר.');
    return;
  }

  if (!existsSync(DRAFTS_DIR)) await mkdir(DRAFTS_DIR, { recursive: true });

  const SLUG = getSlug();
  const draftPath = join(DRAFTS_DIR, `${SLUG}.html`);
  const metaPath  = join(DRAFTS_DIR, `${SLUG}.json`);

  await writeFile(draftPath, buildDraftHtml(post, SLUG), 'utf8');
  await writeFile(metaPath,  JSON.stringify({ ...post, date: TODAY }, null, 2), 'utf8');

  console.log(`\n💾 נשמר: drafts/${SLUG}.html`);
  console.log(`💾 נשמר: drafts/${SLUG}.json`);

  // Clear topic request after use so next week starts fresh
  if (requestedTopic) {
    await writeFile(TOPIC_FILE, '', 'utf8');
    console.log('🗑️  next-topic.txt נוקה');
  }

  // Auto-publish
  console.log('\n🚀 מפרסם לבלוג...');
  execFileSync(process.execPath, [join(BASE_DIR, 'publish.mjs'), SLUG], {
    cwd: BASE_DIR,
    stdio: 'inherit',
  });

  console.log(`\n📅 ${new Date().toLocaleString('he-IL')}`);
  console.log('═'.repeat(50));
}

main().catch(err => {
  console.error('❌ שגיאה:', err.message);
  process.exit(1);
});
