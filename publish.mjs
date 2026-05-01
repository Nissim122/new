/**
 * publish.mjs
 * מפרסם טיוטה מ-drafts/YYYY-MM-DD.json לתוך blog.html
 * ויוצר דף מאמר מלא ב-posts/YYYY-MM-DD.html
 *
 * Usage: node publish.mjs YYYY-MM-DD
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

const dateArg = process.argv[2];
if (!dateArg || !/^\d{4}-\d{2}-\d{2}-\d+$/.test(dateArg)) {
  console.error('❌ שימוש: node publish.mjs YYYY-MM-DD-N  (למשל: 2026-04-24-1)');
  process.exit(1);
}
const datePart = dateArg.slice(0, 10);
const postN     = parseInt(dateArg.slice(11), 10);
const imageSlug = postN === 1 ? datePart : `${datePart}-${postN - 1}`;

const BASE_DIR    = process.cwd();
const META_PATH   = join(BASE_DIR, 'drafts', `${dateArg}.json`);
const BLOG_PATH   = join(BASE_DIR, 'blog.html');
const POSTS_DIR   = join(BASE_DIR, 'posts');
const INDEX_PATH  = join(POSTS_DIR, 'index.json');
const MARKER      = '<!-- AGENT_INSERT_HERE -->';

const CATEGORIES = {
  make:     { label: 'Make',           css: 'make' },
  zapier:   { label: 'Zapier',         css: 'make' },
  ai:       { label: 'AI כלים',        css: 'ai' },
  monday:   { label: 'Monday.com',     css: 'monday' },
  whatsapp: { label: 'WhatsApp עסקי', css: 'whatsapp' },
  tips:     { label: 'טיפים',          css: 'tips' },
};

function resolveImagePath(slug) {
  for (const ext of ['webp', 'jpg', 'png']) {
    if (existsSync(join(BASE_DIR, 'images', 'blog', `${slug}.${ext}`))) {
      return `images/blog/${slug}.${ext}`;
    }
  }
  return `images/blog/${slug}.webp`;
}

function buildPostHtml(post, cat, heDate, postSlug, imageSlug) {
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${post.title} | Clix Automations</title>
  <meta name="description" content="${post.excerpt}" />
  <meta name="keywords" content="${Array.isArray(post.keywords) ? post.keywords.join(', ') : ''}" />
  <meta name="author" content="ניסים בנגייב" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="https://clix-automations.com/posts/${postSlug}.html" />
  <link rel="icon" type="image/svg+xml" href="../favicon.svg" />

  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="Clix Automations" />
  <meta property="og:locale" content="he_IL" />
  <meta property="og:url" content="https://clix-automations.com/posts/${postSlug}.html" />
  <meta property="og:title" content="${post.title}" />
  <meta property="og:description" content="${post.excerpt}" />
  <meta property="og:image" content="https://clix-automations.com/images/blog/${imageSlug}.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="article:published_time" content="${datePart}T00:00:00+03:00" />
  <meta property="article:modified_time" content="${datePart}T00:00:00+03:00" />
  <meta property="article:author" content="ניסים בנגייב" />
  <meta property="article:section" content="${post.category}" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@ClixAutomations" />
  <meta name="twitter:title" content="${post.title}" />
  <meta name="twitter:description" content="${post.excerpt}" />
  <meta name="twitter:image" content="https://clix-automations.com/images/blog/${imageSlug}.png" />

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": "${post.title.replace(/"/g, '\\"')}",
    "description": "${post.excerpt.replace(/"/g, '\\"')}",
    "image": "https://clix-automations.com/images/blog/${imageSlug}.png",
    "datePublished": "${datePart}T00:00:00+03:00",
    "dateModified": "${datePart}T00:00:00+03:00",
    "author": {
      "@type": "Person",
      "name": "ניסים בנגייב",
      "url": "https://clix-automations.com"
    },
    "publisher": {
      "@type": "Organization",
      "name": "Clix Automations",
      "url": "https://clix-automations.com",
      "logo": {
        "@type": "ImageObject",
        "url": "https://clix-automations.com/brand_assets/profile_pic_2_nobg.png"
      }
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": "https://clix-automations.com/posts/${postSlug}.html"
    },
    "inLanguage": "he",
    "keywords": "${Array.isArray(post.keywords) ? post.keywords.join(', ') : ''}",
    "articleSection": "${post.category}"
  }
  </script>

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "דף הבית", "item": "https://clix-automations.com/" },
      { "@type": "ListItem", "position": 2, "name": "בלוג", "item": "https://clix-automations.com/blog.html" },
      { "@type": "ListItem", "position": 3, "name": "${post.title.replace(/"/g, '\\"')}", "item": "https://clix-automations.com/posts/${postSlug}.html" }
    ]
  }
  </script>

  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;600;700;800;900&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
  <script>
    window.addEventListener('load', () => {
      const s = document.createElement('script');
      s.src = 'https://www.googletagmanager.com/gtag/js?id=G-SJT8YRED9B';
      s.async = true;
      document.head.appendChild(s);
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      window.gtag = gtag;
      gtag('js', new Date());
      gtag('config', 'G-SJT8YRED9B', { send_page_view: true });
    });
  </script>

  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }
    body { font-family: 'Heebo', sans-serif; background: #0e1628; color: #ffffff; overflow-x: hidden; }

    nav { position: sticky; top: 0; z-index: 100; background: transparent; padding: 0.75rem 1rem; }
    .nav-inner {
      max-width: calc(80% - 2rem); margin: 0 auto;
      background: rgba(14,16,28,0.55); backdrop-filter: blur(22px); -webkit-backdrop-filter: blur(22px);
      border-radius: 16px; border: 1.5px solid rgba(255,255,255,0.10);
      padding: 0 1.25rem; height: 68px;
      display: flex; align-items: center; justify-content: space-between;
      box-shadow: 0 4px 28px rgba(0,0,0,0.35);
    }
    nav a { color: rgba(255,255,255,0.75); text-decoration: none; font-size: 1.05rem; font-weight: 500; transition: color 0.2s; }
    nav a:hover { color: #fff; }
    .btn-cta {
      display: inline-flex; align-items: center; gap: 0.4rem;
      padding: 0.55rem 1.4rem; background: #e0176b; color: #fff;
      font-family: 'Heebo', sans-serif; font-weight: 700; font-size: 0.9rem;
      border-radius: 10px; border: none; cursor: pointer; text-decoration: none;
    }
    .btn-arrow { display: inline-block; transition: transform 0.25s cubic-bezier(0.34,1.56,0.64,1); }
    .btn-cta:hover .btn-arrow { transform: translateX(-5px); }
    .hamburger-btn { display: none; flex-direction: column; gap: 5px; background: none; border: none; cursor: pointer; padding: 6px; }
    .hamburger-btn span { display: block; width: 24px; height: 2px; background: #fff; border-radius: 2px; }
    @media (max-width: 768px) {
      .hamburger-btn { display: flex; }
      .nav-links-desktop { display: none !important; }
      .nav-cta-desktop { display: none !important; }
      .nav-inner { max-width: 100%; }
    }
    #mobile-menu { display: none; }
    #mobile-menu.open { display: flex; }

    /* Article */
    .post-wrap { max-width: 760px; margin: 0 auto; padding: 3rem 1.5rem 6rem; }
    .back-link {
      display: inline-flex; align-items: center; gap: 0.4rem;
      color: #2196b0; font-size: 0.9rem; font-weight: 600; text-decoration: none;
      margin-bottom: 2.2rem;
      transition: color 0.2s;
    }
    .back-link:hover { color: #5ecfec; }
    .post-tag {
      display: inline-block; padding: 0.25rem 0.8rem;
      border-radius: 999px; font-size: 0.78rem; font-weight: 700;
      margin-bottom: 1rem;
    }
    .post-tag.ai       { background: rgba(33,150,176,0.18); color: #5ecfec; border: 1px solid rgba(33,150,176,0.35); }
    .post-tag.make     { background: rgba(108,70,220,0.18); color: #b39dff; border: 1px solid rgba(108,70,220,0.35); }
    .post-tag.monday   { background: rgba(255,85,0,0.15);   color: #ff9a5c; border: 1px solid rgba(255,85,0,0.3); }
    .post-tag.whatsapp { background: rgba(37,211,102,0.15); color: #5dde8a; border: 1px solid rgba(37,211,102,0.3); }
    .post-tag.tips     { background: rgba(255,200,0,0.12);  color: #ffd966; border: 1px solid rgba(255,200,0,0.3); }
    .post-header { text-align: center; margin-bottom: 2.5rem; padding-bottom: 2rem; border-bottom: 1px solid rgba(255,255,255,0.08); }
    h1 { font-size: clamp(1.6rem, 3vw, 2.2rem); font-weight: 900; line-height: 1.25; letter-spacing: -0.02em; margin-bottom: 1.2rem; text-align: center; }
    .post-meta { display: flex; flex-wrap: wrap; gap: 0.6rem 1.2rem; font-size: 0.85rem; color: rgba(255,255,255,0.45); justify-content: center; }
    .post-content h2 { font-size: 1.4rem; font-weight: 800; color: #2196b0; margin: 2.4rem 0 0.7rem; }
    .post-content h3 { font-size: 1.12rem; font-weight: 700; color: #5ecfec; margin: 1.8rem 0 0.5rem; }
    .post-content p  { line-height: 1.85; color: #c8d8ee; margin-bottom: 1.2rem; font-size: 1.05rem; }
    .post-content ul { padding-right: 1.5rem; margin-bottom: 1.4rem; }
    .post-content li { margin-bottom: 0.5rem; color: #c8d8ee; line-height: 1.75; font-size: 1.05rem; }
    .post-cta {
      margin-top: 3.5rem; padding: 2rem 2rem;
      background: rgba(33,150,176,0.08); border: 1px solid rgba(33,150,176,0.22);
      border-radius: 16px; text-align: center;
    }
    .post-cta p { color: rgba(255,255,255,0.7); margin-bottom: 1.2rem; font-size: 1rem; }
  </style>
</head>
<body>

<nav aria-label="תפריט ראשי">
  <div class="nav-inner">
    <a href="../index.html" aria-label="Clix Automations — דף הבית" style="text-decoration:none;display:flex;align-items:baseline;gap:0.15rem;flex-shrink:0;direction:ltr;">
      <span style="font-family:'Inter',sans-serif;font-weight:700;font-size:1.75rem;letter-spacing:-0.04em;color:#ffffff;">Clix</span><span style="font-family:'Inter',sans-serif;font-weight:400;font-size:1.35rem;letter-spacing:-0.02em;color:#e0176b;">Automations</span>
    </a>
    <div style="display:flex;gap:2.5rem;" class="hidden md:flex nav-links-desktop">
      <a href="../index.html">דף הבית</a>
      <a href="../index.html#results">תוצאות</a>
      <a href="../index.html#process">תהליך</a>
      <a href="../blog.html" style="color:#2196b0;font-weight:700;">בלוג</a>
      <a href="../index.html#contact">צרו קשר</a>
    </div>
    <a href="../index.html#contact" class="btn-cta nav-cta-desktop" style="font-size:0.85rem;padding:0.5rem 1.25rem;">
      לפרטים נוספים <span class="btn-arrow">◄</span>
    </a>
    <button class="hamburger-btn" id="hamburger-btn" onclick="toggleMobileMenu()" aria-label="פתח תפריט" aria-expanded="false" aria-controls="mobile-menu">
      <span></span><span></span><span></span>
    </button>
  </div>
</nav>

<div id="mobile-menu" role="dialog" aria-modal="true" aria-label="תפריט ניווט" style="position:fixed;inset:0;background:rgba(10,15,30,0.97);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);z-index:200;flex-direction:column;align-items:center;justify-content:center;gap:2rem;">
  <button onclick="closeMobileMenu()" style="position:absolute;top:1.25rem;left:1.25rem;background:none;border:none;color:#fff;font-size:1.6rem;cursor:pointer;opacity:0.7;">✕</button>
  <a href="../index.html"         onclick="closeMobileMenu()" style="color:rgba(255,255,255,0.85);font-weight:600;font-size:1.5rem;text-decoration:none;">דף הבית</a>
  <a href="../index.html#results" onclick="closeMobileMenu()" style="color:rgba(255,255,255,0.85);font-weight:600;font-size:1.5rem;text-decoration:none;">תוצאות</a>
  <a href="../index.html#process" onclick="closeMobileMenu()" style="color:rgba(255,255,255,0.85);font-weight:600;font-size:1.5rem;text-decoration:none;">תהליך</a>
  <a href="../blog.html"          onclick="closeMobileMenu()" style="color:#2196b0;font-weight:800;font-size:1.5rem;text-decoration:none;">בלוג</a>
  <a href="../index.html#contact" onclick="closeMobileMenu()" style="color:rgba(255,255,255,0.85);font-weight:600;font-size:1.5rem;text-decoration:none;">צרו קשר</a>
  <a href="../index.html#contact" onclick="closeMobileMenu()" class="btn-cta" style="font-size:1rem;padding:0.75rem 2rem;margin-top:0.5rem;">
    לתיאום פגישה <span class="btn-arrow">◄</span>
  </a>
</div>

<main>
  <div class="post-wrap">
    <a href="../blog.html" class="back-link">◄ חזרה לבלוג</a>

    <div style="border-radius:16px;overflow:hidden;margin-bottom:2.5rem;aspect-ratio:16/9;background:#131c34;">
      <img src="../images/blog/${imageSlug}.webp"
           onerror="(function(t,b){var e=['png','jpg'],i=0;t.onerror=function(){i<e.length?t.src=b+'.'+e[i++]:t.onerror=null};t.onerror()})(this,'../images/blog/${imageSlug}')"
           alt="${post.title}" style="width:100%;height:100%;object-fit:cover;display:block;" />
    </div>

    <div class="post-header">
      <span class="post-tag ${cat.css}">${cat.label}</span>
      <h1>${post.title}</h1>
      <div class="post-meta">
        <span>✍️ ניסים בנגייב</span>
        <span>📅 ${heDate}</span>
        <span>⏱ ${post.readTime} דק' קריאה</span>
      </div>
    </div>

    <div class="post-content">
      ${post.content}
    </div>

    <div class="post-cta">
      <p>רוצים ליישם אוטומציה בעסק שלכם? נשמח לעזור.</p>
      <a href="../index.html#contact" class="btn-cta" style="font-size:1rem;padding:0.7rem 2rem;">
        לתיאום שיחת אפיון - ללא עלות <span class="btn-arrow">◄</span>
      </a>
    </div>
  </div>
</main>

<footer style="border-top:1px solid rgba(255,255,255,0.08);padding:2rem 1.5rem;text-align:center;">
  <div style="max-width:1100px;margin:0 auto;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:1rem;">
    <a href="../index.html" style="font-family:'Inter',sans-serif;font-weight:700;font-size:1.2rem;letter-spacing:-0.03em;color:#fff;text-decoration:none;">
      Clix<span style="font-weight:400;color:#e0176b;">Automations</span>
    </a>
    <p style="font-size:0.82rem;color:rgba(255,255,255,0.3);">© 2025 Clix Automations. כל הזכויות שמורות.</p>
    <div style="display:flex;gap:1.5rem;">
      <a href="../privacy.html" style="font-size:0.82rem;color:rgba(255,255,255,0.35);text-decoration:none;">מדיניות פרטיות</a>
      <a href="../index.html#contact" style="font-size:0.82rem;color:rgba(255,255,255,0.35);text-decoration:none;">צרו קשר</a>
    </div>
  </div>
</footer>

<script>
  function toggleMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    const btn  = document.getElementById('hamburger-btn');
    const open = menu.classList.toggle('open');
    btn.setAttribute('aria-expanded', open);
    document.body.style.overflow = open ? 'hidden' : '';
  }
  function closeMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    const btn  = document.getElementById('hamburger-btn');
    menu.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }
</script>
</body>
</html>`;
}

async function main() {
  if (!existsSync(META_PATH)) {
    console.error(`❌ לא נמצאה טיוטה: drafts/${dateArg}.json`);
    process.exit(1);
  }
  if (!existsSync(BLOG_PATH)) {
    console.error('❌ לא נמצא blog.html');
    process.exit(1);
  }

  const post = JSON.parse(await readFile(META_PATH, 'utf8'));
  const cat  = CATEGORIES[post.category] || CATEGORIES.tips;

  const heDate = new Date(datePart).toLocaleDateString('he-IL', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const postSlug = dateArg;
  const postPath = join(POSTS_DIR, `${postSlug}.html`);

  // ── 1. Create post page ──────────────────────────────────────────────────────
  if (!existsSync(POSTS_DIR)) await mkdir(POSTS_DIR, { recursive: true });

  const isPlaceholder = existsSync(postPath) &&
    (await readFile(postPath, 'utf8')).includes('המאמר בכתיבה');

  await writeFile(postPath, buildPostHtml(post, cat, heDate, postSlug, imageSlug), 'utf8');
  console.log(isPlaceholder
    ? `📄 דורס placeholder: posts/${postSlug}.html`
    : `📄 נוצר: posts/${postSlug}.html`);

  // ── 2. Insert card into blog.html ────────────────────────────────────────────
  let html = await readFile(BLOG_PATH, 'utf8');

  if (!html.includes(MARKER)) {
    console.error(`❌ לא נמצא marker בבלוג:\n   ${MARKER}`);
    process.exit(1);
  }

  if (html.includes(`<!-- AGENT POST ${dateArg} -->`)) {
    console.warn(`⚠️  הכרטיס של ${dateArg} כבר קיים ב-blog.html.`);
  } else {
    const cardHtml = `<!-- AGENT POST ${dateArg} -->
      <article class="blog-card reveal" data-cats="${post.category}" style="transition-delay:0.05s;">
        <div class="blog-card-thumb-wrap">
          <img src="images/blog/${imageSlug}.webp"
               onerror="(function(t,b){var e=['png','jpg'],i=0;t.onerror=function(){i<e.length?t.src=b+'.'+e[i++]:t.onerror=null};t.onerror()})(this,'images/blog/${imageSlug}')"
               alt="${post.title}" loading="lazy" />
        </div>
        <div class="blog-card-body">
          <span class="blog-tag ${cat.css}">${cat.label}</span>
          <a href="posts/${postSlug}.html" class="blog-title">
            ${post.title}
          </a>
          <p class="blog-excerpt">
            ${post.excerpt}
          </p>
          <div class="blog-meta">
            <span>ניסים בנגייב</span>
            <span class="blog-meta-dot"></span>
            <span>${heDate}</span>
            <span class="blog-meta-dot"></span>
            <span>${post.readTime} דק' קריאה</span>
          </div>
        </div>
      </article>
      ${MARKER}`;

    html = html.replace(MARKER, cardHtml);
    await writeFile(BLOG_PATH, html, 'utf8');
    console.log(`🃏 נוסף כרטיס ל-blog.html`);
  }

  // ── 3. Update posts/index.json ───────────────────────────────────────────────
  const index = existsSync(INDEX_PATH)
    ? JSON.parse(await readFile(INDEX_PATH, 'utf8'))
    : [];

  const alreadyInIndex = index.some(p => p.slug === postSlug || p.slug === dateArg);
  if (alreadyInIndex) {
    console.warn(`⚠️  ${postSlug} כבר קיים ב-index.json`);
  } else {
    index.unshift({
      slug:         postSlug,
      title:        post.title,
      excerpt:      post.excerpt,
      date:         datePart,
      dateLabel:    heDate,
      readTime:     `${post.readTime} דק' קריאה`,
      tag:          post.category,
      tagLabel:     cat.label,
      image:        resolveImagePath(imageSlug),
      imageFallback:resolveImagePath(imageSlug),
      url:          `posts/${postSlug}.html`,
    });
    await writeFile(INDEX_PATH, JSON.stringify(index, null, 2), 'utf8');
    console.log(`📋 עודכן: posts/index.json`);
  }

  // ── 4. Update sitemap.xml ──────────────────────────────────────────────────
  const SITEMAP_PATH = join(BASE_DIR, 'sitemap.xml');
  if (existsSync(SITEMAP_PATH)) {
    let sitemap = await readFile(SITEMAP_PATH, 'utf8');
    const postUrl = `https://clix-automations.com/posts/${postSlug}.html`;

    if (sitemap.includes(postUrl)) {
      console.warn(`⚠️  ${postSlug} כבר קיים ב-sitemap.xml`);
    } else {
      const SITEMAP_MARKER = '  <!-- דפים נוספים -->';
      if (!sitemap.includes(SITEMAP_MARKER)) {
        console.warn('⚠️  מרקר sitemap.xml לא נמצא — הסיטמאפ לא עודכן');
      } else {
        const entry = `\n  <url>\n    <loc>${postUrl}</loc>\n    <lastmod>${datePart}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
        sitemap = sitemap.replace(SITEMAP_MARKER, entry + SITEMAP_MARKER);
        await writeFile(SITEMAP_PATH, sitemap, 'utf8');
        console.log(`🗺️  עודכן: sitemap.xml`);
      }
    }
  }

  console.log(`\n✅ פורסם בהצלחה!`);
  console.log(`   כותרת: "${post.title}"`);
  console.log(`   קטגוריה: ${cat.label} | ${heDate}`);
  console.log(`\n👉 עשה commit ו-push כדי לעדכן את האתר.`);
}

main().catch(err => {
  console.error('❌ שגיאה:', err.message);
  process.exit(1);
});
