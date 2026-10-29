#!/usr/bin/env python3
"""Gerador do blog rafaelwerlang.com — só biblioteca padrão do Python, nenhum pacote externo.

  python3 build.py            gera docs/ (o que o GitHub Pages serve)
  python3 build.py --drafts   inclui posts com `draft: true` (para revisar antes)
  python3 -m http.server -d docs 8000   ver em http://127.0.0.1:8000

Posts: posts/AAAA-MM-DD-slug.md com cabeçalho entre '---' (title, date, description, tags, draft).
Páginas: pages/<slug>.md (ex.: about.md → /about/).
"""
import html, os, re, shutil, sys
from datetime import datetime, timezone
from email.utils import format_datetime

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, 'docs')
SITE = {
    'title': 'Rafael Werlang',
    'tagline': 'Protocol & AI-agent security',
    'url': 'https://rafaelwerlang.com',
    'description': 'Notes on protocol design, MEV, zero-knowledge and the security of AI agents.',
    'author': 'Rafael Werlang',
    'github': 'https://github.com/rafajaw',
    'email': 'email@rafaelwerlang.com',
}


# ───────────────────────── markdown (subconjunto) ─────────────────────────

def slugify(s):
    s = re.sub(r'<[^>]+>', '', s).lower()
    s = re.sub(r'[^\w\s-]', '', s, flags=re.UNICODE)
    return re.sub(r'[\s_]+', '-', s).strip('-')


def inline(s):
    """Código inline primeiro (protegido), depois escape, imagens, links, negrito, itálico."""
    codes = []
    def keep(m):
        codes.append(f'<code>{html.escape(m.group(1))}</code>')
        return f'\x00{len(codes) - 1}\x00'
    s = re.sub(r'`([^`]+)`', keep, s)
    s = html.escape(s, quote=False)
    s = re.sub(r'!\[([^\]]*)\]\(([^)\s]+)\)', lambda m: f'<img src="{m.group(2)}" alt="{m.group(1)}" loading="lazy">', s)
    def link(m):
        text, url = m.group(1), m.group(2)
        ext = url.startswith('http') and not url.startswith(SITE['url'])
        attrs = ' rel="noopener" target="_blank"' if ext else ''
        return f'<a href="{url}"{attrs}>{text}</a>'
    s = re.sub(r'\[([^\]]+)\]\(([^)\s]+)\)', link, s)
    s = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', s)
    s = re.sub(r'(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])', r'<em>\1</em>', s)
    s = re.sub(r'(?<!\w)_(?!\s)(.+?)(?<!\s)_(?!\w)', r'<em>\1</em>', s)
    return re.sub(r'\x00(\d+)\x00', lambda m: codes[int(m.group(1))], s)


KEYWORDS = {
    'solidity': 'pragma contract interface library function modifier event error struct enum mapping returns return if else for while do break continue emit revert require assert using is new delete public private internal external pure view payable constant immutable memory storage calldata override virtual abstract constructor receive fallback unchecked assembly try catch import from as',
    'rust': 'fn let mut pub struct enum impl trait for in if else match loop while return use mod crate self Self super const static where async await move ref dyn type unsafe as true false',
    'ts': 'const let var function return if else for while do break continue switch case default new class extends implements interface type enum import export from as async await try catch finally throw typeof instanceof in of null undefined true false this',
    'py': 'def return if elif else for while in not and or is None True False import from as with try except finally raise class lambda yield pass break continue global async await',
    'bash': 'if then else elif fi for in do done while case esac function return export local echo cd',
}
KEYWORDS.update({'js': KEYWORDS['ts'], 'typescript': KEYWORDS['ts'], 'javascript': KEYWORDS['ts'], 'python': KEYWORDS['py'], 'sh': KEYWORDS['bash'], 'sol': KEYWORDS['solidity'], 'rs': KEYWORDS['rust']})
TYPES = r'\b(?:u?int\d*|bytes\d*|address|bool|string|u8|u16|u32|u64|u128|usize|i32|i64|String|Vec|Option|Result|number|boolean|void)\b'


def highlight(code, lang):
    kws = KEYWORDS.get(lang)
    if not kws:
        return html.escape(code)
    comment = r'#[^\n]*' if lang in ('py', 'python', 'bash', 'sh') else r'//[^\n]*|/\*[\s\S]*?\*/'
    tok = re.compile(rf'(?P<c>{comment})|(?P<s>"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'|`(?:\\.|[^`\\])*`)'
                     rf'|(?P<n>\b0x[0-9a-fA-F]+\b|\b\d[\d_]*(?:\.\d+)?\b)|(?P<t>{TYPES})'
                     rf'|(?P<k>\b(?:{"|".join(map(re.escape, kws.split()))})\b)')
    out, pos = [], 0
    for m in tok.finditer(code):
        out.append(html.escape(code[pos:m.start()]))
        out.append(f'<span class="tk-{m.lastgroup}">{html.escape(m.group())}</span>')
        pos = m.end()
    out.append(html.escape(code[pos:]))
    return ''.join(out)


def markdown(text):
    lines = text.replace('\r\n', '\n').split('\n')
    out, i, toc = [], 0, []
    para = []

    def flush():
        if para:
            out.append(f'<p>{inline(" ".join(para))}</p>')
            para.clear()

    while i < len(lines):
        l = lines[i]
        if not l.strip():
            flush(); i += 1; continue
        m = re.match(r'^(`{3,}|~{3,})\s*(\w*)', l)
        if m:  # bloco de código
            flush(); fence, lang = m.group(1), m.group(2).lower()
            j = i + 1; buf = []
            while j < len(lines) and not lines[j].startswith(fence):
                buf.append(lines[j]); j += 1
            label = f'<span class="lang">{html.escape(lang)}</span>' if lang else ''
            out.append(f'<figure class="code">{label}<pre><code class="language-{lang or "text"}">{highlight(chr(10).join(buf), lang)}</code></pre></figure>')
            i = j + 1; continue
        m = re.match(r'^(#{1,4})\s+(.*)$', l)
        if m:
            flush(); n = len(m.group(1)); body = inline(m.group(2).strip()); sid = slugify(body)
            if n in (2, 3): toc.append((n, sid, body))
            out.append(f'<h{n} id="{sid}"><a class="anchor" href="#{sid}" aria-hidden="true">#</a>{body}</h{n}>')
            i += 1; continue
        if re.match(r'^\s*(-{3,}|\*{3,})\s*$', l):
            flush(); out.append('<hr>'); i += 1; continue
        if l.lstrip().startswith('<') and not para:  # HTML cru: passa direto até a linha em branco
            j = i; buf = []
            while j < len(lines) and lines[j].strip():
                buf.append(lines[j]); j += 1
            out.append('\n'.join(buf)); i = j; continue
        if l.startswith('>'):
            flush(); buf = []
            while i < len(lines) and lines[i].startswith('>'):
                buf.append(re.sub(r'^>\s?', '', lines[i])); i += 1
            out.append(f'<blockquote>{markdown(chr(10).join(buf))[0]}</blockquote>'); continue
        if '|' in l and i + 1 < len(lines) and re.match(r'^\s*\|?\s*:?-{2,}', lines[i + 1]):
            flush()
            cells = lambda r: [c.strip() for c in r.strip().strip('|').split('|')]
            aligns = ['right' if c.endswith(':') and not c.startswith(':') else 'center' if c.startswith(':') and c.endswith(':') else ''
                      for c in cells(lines[i + 1])]
            st = lambda k: f' style="text-align:{aligns[k]}"' if k < len(aligns) and aligns[k] else ''
            head = ''.join(f'<th{st(k)}>{inline(c)}</th>' for k, c in enumerate(cells(l)))
            rows, j = [], i + 2
            while j < len(lines) and '|' in lines[j] and lines[j].strip():
                rows.append('<tr>' + ''.join(f'<td{st(k)}>{inline(c)}</td>' for k, c in enumerate(cells(lines[j]))) + '</tr>'); j += 1
            out.append(f'<div class="table"><table><thead><tr>{head}</tr></thead><tbody>{"".join(rows)}</tbody></table></div>')
            i = j; continue
        m = re.match(r'^(\s*)([-*]|\d+[.)])\s+(.*)$', l)
        if m:
            flush(); ordered = m.group(2)[0].isdigit(); items = []
            while i < len(lines):
                m2 = re.match(r'^(\s*)([-*]|\d+[.)])\s+(.*)$', lines[i])
                if m2:
                    items.append(m2.group(3)); i += 1
                elif lines[i].startswith('  ') and lines[i].strip() and items:  # continuação do item
                    items[-1] += ' ' + lines[i].strip(); i += 1
                else:
                    break
            tag = 'ol' if ordered else 'ul'
            out.append(f'<{tag}>' + ''.join(f'<li>{inline(x)}</li>' for x in items) + f'</{tag}>'); continue
        para.append(l.strip()); i += 1
    flush()
    return '\n'.join(out), toc


def front_matter(text):
    meta = {}
    if text.startswith('---\n'):
        end = text.index('\n---', 4)
        for row in text[4:end].split('\n'):
            if ':' in row:
                k, v = row.split(':', 1); meta[k.strip()] = v.strip().strip('"')
        text = text[end + 4:].lstrip('\n')
    if 'tags' in meta:
        meta['tags'] = [t.strip() for t in meta['tags'].strip('[]').split(',') if t.strip()]
    meta['draft'] = meta.get('draft', '').lower() == 'true'
    return meta, text


# ───────────────────────── páginas ─────────────────────────

def tpl(name):
    return open(os.path.join(ROOT, 'templates', name), encoding='utf-8').read()


def render(template, **kw):
    return re.sub(r'\{\{\s*(\w+)\s*\}\}', lambda m: str(kw.get(m.group(1), '')), template)


def page(title, description, path, main, kind='page', og_type='website', env='home'):
    full = f'{title} — {SITE["title"]}' if title != SITE['title'] else SITE['title']
    return render(tpl('base.html'), title=html.escape(full), description=html.escape(description),
                  url=SITE['url'] + path, site=html.escape(SITE['title']), tagline=html.escape(SITE['tagline']),
                  github=SITE['github'], email=SITE['email'], main=main, kind=kind, og_type=og_type, env=env,
                  year=datetime.now().year)


def write(path, content):
    p = os.path.join(OUT, path.strip('/'), 'index.html') if not path.endswith(('.xml', '.html', '.txt')) else os.path.join(OUT, path.strip('/'))
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, 'w', encoding='utf-8').write(content)


def fmt_date(d):
    return datetime.strptime(d, '%Y-%m-%d').strftime('%b %d, %Y').replace(' 0', ' ')


def reading_time(text):
    return max(1, round(len(re.findall(r'\w+', text)) / 230))


def build(drafts=False):
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    shutil.copytree(os.path.join(ROOT, 'static'), OUT)

    posts = []
    dirs = [os.path.join(ROOT, 'posts')]
    if drafts and os.path.isdir(os.path.join(ROOT, '..', '_drafts')):  # rascunhos locais, fora do repo público
        dirs.append(os.path.join(ROOT, '..', '_drafts'))
    for d, f in sorted(((d, f) for d in dirs for f in os.listdir(d)), key=lambda x: x[1]):
        if not f.endswith('.md'):
            continue
        meta, body = front_matter(open(os.path.join(d, f), encoding='utf-8').read())
        if meta['draft'] and not drafts:
            continue
        m = re.match(r'(\d{4}-\d{2}-\d{2})-(.+)\.md$', f)
        date, slug = (meta.get('date') or m.group(1)), (meta.get('slug') or m.group(2))
        content, toc = markdown(body)
        posts.append(dict(meta, slug=slug, date=date, content=content, toc=toc, minutes=reading_time(body),
                          env=re.sub(r'[^a-z0-9-]', '', meta.get('env', 'paper').lower()) or 'paper'))
    posts.sort(key=lambda p: p['date'], reverse=True)

    for p in posts:
        tags = ''.join(f'<span class="tag">{html.escape(t)}</span>' for t in p.get('tags', []))
        toc = ''.join(f'<li class="l{n}"><a href="#{sid}">{body}</a></li>' for n, sid, body in p['toc'])
        main = render(tpl('post.html'), title=html.escape(p['title']), description=html.escape(p.get('description', '')), date=fmt_date(p['date']), iso=p['date'],
                      minutes=p['minutes'], tags=tags, content=p['content'], slug=p['slug'],
                      toc=f'<nav class="toc" aria-label="Contents"><ol>{toc}</ol></nav>' if len(p['toc']) > 2 else '',
                      draft='<p class="draft-badge">Draft — not published</p>' if p['draft'] else '', env=p['env'])
        write(f'/posts/{p["slug"]}/', page(p['title'], p.get('description', ''), f'/posts/{p["slug"]}/', main, 'post', 'article', p['env']))

    items = ''.join(render(tpl('card.html'), slug=p['slug'], title=html.escape(p['title']),
                           description=html.escape(p.get('description', '')), date=fmt_date(p['date']),
                           iso=p['date'], minutes=p['minutes'], n=k, num=f'{k + 1:02d}', env=p['env'])
                    for k, p in enumerate(posts))
    empty = '<p class="empty">Nothing here yet.</p>'
    write('/', page(SITE['title'], SITE['description'], '/', render(tpl('index.html'), posts=items or empty, count=len(posts),
                                                                    tagline=html.escape(SITE['tagline'])), 'home'))

    for f in sorted(os.listdir(os.path.join(ROOT, 'pages'))):
        if f.endswith('.md'):
            meta, body = front_matter(open(os.path.join(ROOT, 'pages', f), encoding='utf-8').read())
            slug = f[:-3]; content, _ = markdown(body)
            env = meta.get('env', 'paper')
            main = (f'<article class="post"><header class="post-hero"><p class="post-meta mono"><a href="/">← Index</a></p>'
                    f'<h1 class="post-title split">{html.escape(meta.get("title", slug))}</h1></header>'
                    f'<div class="prose">{content}</div></article>')
            write(f'/{slug}/', page(meta.get('title', slug), meta.get('description', ''), f'/{slug}/', main, 'page', 'website', env))

    write('/404.html', page('Not found', '', '/404.html',
                            '<section class="notfound"><h1 class="mega split">404</h1><p class="mono">Nothing here. <a href="/">Back to the index</a></p></section>'))

    now = format_datetime(datetime.now(timezone.utc))
    rss = ''.join(f'<item><title>{html.escape(p["title"])}</title><link>{SITE["url"]}/posts/{p["slug"]}/</link>'
                  f'<guid>{SITE["url"]}/posts/{p["slug"]}/</guid>'
                  f'<pubDate>{format_datetime(datetime.strptime(p["date"], "%Y-%m-%d").replace(tzinfo=timezone.utc))}</pubDate>'
                  f'<description>{html.escape(p.get("description", ""))}</description></item>' for p in posts if not p['draft'])
    write('/rss.xml', f'<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>{html.escape(SITE["title"])}</title>'
                      f'<link>{SITE["url"]}/</link><description>{html.escape(SITE["description"])}</description>'
                      f'<lastBuildDate>{now}</lastBuildDate>{rss}</channel></rss>')
    urls = ['/', '/about/'] + [f'/posts/{p["slug"]}/' for p in posts if not p['draft']]
    write('/sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
                          + ''.join(f'<url><loc>{SITE["url"]}{u}</loc></url>' for u in urls) + '</urlset>')
    write('/robots.txt', f'User-agent: *\nAllow: /\nSitemap: {SITE["url"]}/sitemap.xml\n')
    print(f'ok: {len(posts)} post(s) → {OUT}')


if __name__ == '__main__':
    build(drafts='--drafts' in sys.argv)
