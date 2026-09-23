// Post-build: write dist/<route>.html for each public page with its own
// <title>, description, canonical and Open Graph tags baked into the HTML.
// Firebase Hosting ("cleanUrls": true) serves /meal-prep from meal-prep.html,
// so crawlers and link previews see the right head without running JS —
// previously every page shipped the homepage's title and a canonical tag
// pointing at "/", which is why Google skipped indexing them.
import fs from 'fs';
import path from 'path';
import { PAGE_META, SITE_URL } from '../src/seo/pageMeta';

const dist = path.resolve(process.cwd(), 'dist');
const shell = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function withMeta(html: string, title: string, description: string, url: string) {
  const swaps: [RegExp, string][] = [
    [/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`],
    [/<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${esc(description)}" />`],
    [/<link rel="canonical" href="[^"]*"\s*\/?>/, `<link rel="canonical" href="${esc(url)}" />`],
    [/<meta property="og:title" content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${esc(title)}" />`],
    [/<meta property="og:description" content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${esc(description)}" />`],
    [/<meta property="og:url" content="[^"]*"\s*\/?>/, `<meta property="og:url" content="${esc(url)}" />`],
    [/<meta name="twitter:title" content="[^"]*"\s*\/?>/, `<meta name="twitter:title" content="${esc(title)}" />`],
    [/<meta name="twitter:description" content="[^"]*"\s*\/?>/, `<meta name="twitter:description" content="${esc(description)}" />`],
  ];
  for (const [re, rep] of swaps) {
    if (!re.test(html)) throw new Error(`prerender-meta: tag not found in index.html: ${re}`);
    html = html.replace(re, rep);
  }
  return html;
}

let count = 0;
for (const [route, meta] of Object.entries(PAGE_META)) {
  const html = withMeta(shell, meta.title, meta.description, `${SITE_URL}${route}`);
  const file = route === '/' ? 'index.html' : `${route.slice(1)}.html`;
  fs.writeFileSync(path.join(dist, file), html);
  count++;
}
console.log(`prerender-meta: wrote ${count} pages`);
