#!/usr/bin/env node

const { program } = require('commander');
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const TRIM_SIZES = {
  '5x8':     { w: '5in',    h: '8in',    inner: '0.7in',   hcInner: '0.85in',  outer: '0.5in',  top: '0.7in',  bottom: '0.7in'  },
  '5.25x8':  { w: '5.25in', h: '8in',    inner: '0.75in',  hcInner: '0.9in',   outer: '0.5in',  top: '0.7in',  bottom: '0.7in'  },
  '5.5x8.5': { w: '5.5in',  h: '8.5in',  inner: '0.8in',   hcInner: '0.95in',  outer: '0.55in', top: '0.75in', bottom: '0.75in' },
  '6x9':     { w: '6in',    h: '9in',    inner: '0.85in',  hcInner: '1.0in',   outer: '0.6in',  top: '0.8in',  bottom: '0.8in'  },
};

const TEMPLATE_DIR = path.join(__dirname, 'templates');
const FILTER_DIR = path.join(__dirname, 'filters');

program
  .name('book-convert')
  .description('Convert markdown files to KDP-ready books (PDF/EPUB) via Pandoc + LaTeX')
  .argument('<files...>', 'One or more markdown files to convert')
  .option('-o, --output <name>',     'Output filename (extension added automatically)')
  .option('-t, --title <title>',     'Book title')
  .option('-a, --author <author>',   'Author name')
  .option('-s, --subtitle <text>',   'Book subtitle', 'Hard Science Fiction')
  .option('-f, --format <format>',   'Output format: pdf, epub, or all (paperback + hardcover + kindle)', 'all')
  .option('--trim <size>',           `Trim size: ${Object.keys(TRIM_SIZES).join(', ')}`, '5x8')
  .option('--toc',                   'Include table of contents')
  .option('--cover <path>',          'Cover image path (for EPUB)')
  .option('--font-size <pt>',        'Font size: 10pt, 11pt, 12pt', '11pt')
  .option('--open-right',            'Start chapters on right-hand (odd) pages')
  .option('--year <year>',           'Copyright year', new Date().getFullYear().toString())
  .option('--isbn <isbn>',           'ISBN for copyright page')
  .option('--back-matter <path>',     'JSON file with author info and book list for EPUB back matter')
  .addHelpText('after', `
Examples:
  All 3 formats (paperback PDF + hardcover PDF + Kindle EPUB):
    $ node convert.js chapters/*.md -t "My Book" -a "Jane Smith" --toc

  Paperback PDF only:
    $ node convert.js story.md -f pdf -t "My Story" -a "Jane Smith"

  Kindle EPUB only:
    $ node convert.js story.md -f epub -t "My Story" -a "Jane Smith" --cover cover.jpg

  Multiple files into one book:
    $ node convert.js part-01.md part-02.md -t "Collected Works" -a "Jane Smith" --toc

Prerequisites:
  - Pandoc:   https://pandoc.org/installing.html
  - TeX Live: apt install texlive-xetex texlive-fonts-recommended texlive-latex-extra
  - Optional: apt install texlive-fonts-extra  (for EB Garamond font)
  `)
  .parse();

const opts = program.opts();
const rawFiles = program.args;

const resolvedFiles = rawFiles
  .map(f => path.resolve(f))
  .sort((a, b) => path.basename(a).localeCompare(path.basename(b)));

for (const f of resolvedFiles) {
  if (!fs.existsSync(f)) {
    console.error(`Error: file not found — ${f}`);
    process.exit(1);
  }
  if (!f.endsWith('.md')) {
    console.error(`Warning: ${path.basename(f)} is not a .md file, including anyway`);
  }
}

const trim = TRIM_SIZES[opts.trim];
if (!trim) {
  console.error(`Error: invalid trim size "${opts.trim}". Options: ${Object.keys(TRIM_SIZES).join(', ')}`);
  process.exit(1);
}

const validFormats = ['pdf', 'epub', 'all'];
if (!validFormats.includes(opts.format)) {
  console.error(`Error: invalid format "${opts.format}". Options: ${validFormats.join(', ')}`);
  process.exit(1);
}

function commandExists(cmd) {
  try {
    execFileSync('which', [cmd], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

if (!commandExists('pandoc')) {
  console.error('Error: pandoc is not installed.');
  console.error('  Install: https://pandoc.org/installing.html');
  console.error('  Or:      apt install pandoc');
  process.exit(1);
}

function baseName() {
  if (opts.output) return opts.output.replace(/\.\w+$/, '');
  if (resolvedFiles.length === 1) return path.basename(resolvedFiles[0], '.md');
  return (opts.title || 'book')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function buildFrontMatterHtml() {
  const title = opts.title || '';
  const author = opts.author || '';
  const subtitle = opts.subtitle || '';
  const year = opts.year || new Date().getFullYear();
  const isbn = opts.isbn || '';

  let html = '';

  html += '<div class="title-page">\n';
  html += '<div class="title-page-block">\n';
  if (title) html += `<p class="tp-title">${title.toUpperCase()}</p>\n`;
  html += '<hr class="tp-rule"/>\n';
  if (subtitle) html += `<p class="tp-subtitle">${subtitle.toUpperCase()}</p>\n`;
  if (author) html += `<p class="tp-author">${author.toUpperCase()}</p>\n`;
  html += '</div>\n';
  html += '</div>\n';

  html += '<div class="copyright-page">\n';
  if (title)  html += `<p><em>${title}</em></p>\n`;
  if (author) html += `<p>Copyright \u00A9 ${year} ${author}</p>\n`;
  html += '<p>All rights reserved.</p>\n';
  html += '<p>No part of this publication may be reproduced, distributed,<br/>\n';
  html += 'or transmitted in any form or by any means without the prior<br/>\n';
  html += 'written permission of the author.</p>\n';
  if (isbn) html += `<p class="isbn">ISBN: ${isbn}</p>\n`;
  html += '</div>\n';

  return html;
}

function loadAlsoBy() {
  if (!opts.backMatter) return null;
  const filePath = path.resolve(opts.backMatter);
  if (!fs.existsSync(filePath)) {
    console.error(`Error: --back-matter file not found — ${filePath}`);
    process.exit(1);
  }
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!data.amazonBaseUrls || !data.amazonBaseUrls.bookUrl || !data.amazonBaseUrls.reviewUrl) {
      throw new Error('Missing amazonBaseUrls.bookUrl or amazonBaseUrls.reviewUrl');
    }
    if (!Array.isArray(data.books)) throw new Error('Missing "books" array');
    for (const b of data.books) {
      if (!b.title || !b.asin) throw new Error('Each book needs "title" and "asin"');
    }
    return data;
  } catch (err) {
    console.error(`Error: invalid --back-matter JSON — ${err.message}`);
    process.exit(1);
  }
}

function buildBackMatterHtml() {
  const data = loadAlsoBy();
  if (!data) return null;

  const title = opts.title || '';
  const author = (data.author && data.author.name) || opts.author || '';
  const authorUrl = (data.author && data.author.url) || '';
  const bookUrl = data.amazonBaseUrls.bookUrl;
  const reviewBase = data.amazonBaseUrls.reviewUrl;

  const currentBook = data.books.find(b => b.title.toLowerCase() === title.toLowerCase());
  const reviewUrl = currentBook ? `${reviewBase}${currentBook.asin}` : '';
  const otherBooks = data.books.filter(b => b.title.toLowerCase() !== title.toLowerCase());

  if (!reviewUrl && otherBooks.length === 0) return null;

  let html = '<div class="back-matter">\n';

  if (title) {
    html += `<p class="bm-title">${title.toUpperCase()}</p>\n`;
    html += '<hr class="bm-rule"/>\n';
  }

  if (reviewUrl) {
    html += '<p class="bm-heading">Did You Enjoy This Book?</p>\n';
    html += '<p class="bm-body">Thank you for reading. If you enjoyed this story, ';
    html += 'please consider leaving a ';
    html += `<a href="${reviewUrl}">review on Amazon</a>. `;
    html += 'Reviews help other readers discover new books ';
    html += 'and mean a great deal to the author.</p>\n';
  }

  if (otherBooks.length > 0) {
    const heading = author ? `More from ${author}` : 'More from This Author';
    html += `<p class="bm-heading">${heading}</p>\n`;
    html += '<ul class="bm-book-list">\n';
    for (const book of otherBooks) {
      html += `<li><a href="${bookUrl}${book.asin}">${book.title}</a></li>\n`;
    }
    html += '</ul>\n';
    if (authorUrl) {
      html += '<p class="bm-author-link">Visit the ';
      html += `<a href="${authorUrl}">author's page on Amazon</a> `;
      html += 'for the complete catalogue.</p>\n';
    }
  }

  html += '</div>\n';
  return html;
}

function buildPandocArgs(target) {
  const args = [...resolvedFiles];

  const out = `${baseName()}${target.suffix}.${target.ext}`;
  args.push('-o', out);
  args.push('--from', 'markdown');
  args.push('--top-level-division=chapter');

  args.push('-M', 'lang=en');
  if (opts.title)    args.push('-M', `title=${opts.title}`);
  if (opts.author)   args.push('-M', `author=${opts.author}`);
  if (opts.subtitle) args.push('-V', `subtitle=${opts.subtitle}`);
  if (opts.year)     args.push('-V', `year=${opts.year}`);
  if (opts.isbn)     args.push('-V', `isbn=${opts.isbn}`);

  const sceneFilter = path.join(FILTER_DIR, 'scene-break.lua');
  if (fs.existsSync(sceneFilter)) {
    args.push('--lua-filter', sceneFilter);
  }

  const headingFilter = path.join(FILTER_DIR, 'heading-promote.lua');
  if (fs.existsSync(headingFilter)) {
    args.push('--lua-filter', headingFilter);
  }

  if (opts.toc) args.push('--toc', '--toc-depth=1');

  if (target.ext === 'pdf') {
    const template = path.join(TEMPLATE_DIR, 'kdp-print.tex');
    args.push('--template', template);
    args.push('--pdf-engine=xelatex');
    args.push('-V', `fontsize=${opts.fontSize}`);
    args.push('-V', `paperwidth=${trim.w}`);
    args.push('-V', `paperheight=${trim.h}`);
    args.push('-V', `inner-margin=${target.innerMargin}`);
    args.push('-V', `outer-margin=${trim.outer}`);
    args.push('-V', `top-margin=${trim.top}`);
    args.push('-V', `bottom-margin=${trim.bottom}`);
    if (target.openRight) args.push('-V', 'open-right=true');
  }

  if (target.ext === 'epub') {
    args.push('--epub-title-page=false');
    const css = path.join(TEMPLATE_DIR, 'epub.css');
    if (fs.existsSync(css)) args.push('--css', css);

    const frontMatterHtml = buildFrontMatterHtml();
    const frontMatterFile = path.join(os.tmpdir(), 'epub-front-matter.html');
    fs.writeFileSync(frontMatterFile, frontMatterHtml);
    args.push('--include-before-body', frontMatterFile);

    if (opts.cover) {
      const coverSrc = path.resolve(opts.cover);
      const coverExt = path.extname(coverSrc);
      const safeCover = path.join(os.tmpdir(), `cover${coverExt}`);
      fs.copyFileSync(coverSrc, safeCover);
      args.push('--epub-cover-image', safeCover);
    }

    const backMatterHtml = buildBackMatterHtml();
    if (backMatterHtml) {
      const backMatterFile = path.join(os.tmpdir(), 'epub-back-matter.html');
      fs.writeFileSync(backMatterFile, backMatterHtml);
      args.push('--include-after-body', backMatterFile);
    }
  }

  return { args, output: out };
}

function cleanupEpub(epubPath) {
  const frontMatter = buildFrontMatterHtml();
  const backMatter = buildBackMatterHtml();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'epub-fix-'));

  try {
    execFileSync('unzip', ['-q', '-o', epubPath, '-d', tmpDir], { stdio: 'pipe' });

    const textDir = path.join(tmpDir, 'EPUB', 'text');
    if (!fs.existsSync(textDir)) return;

    const chapterFiles = fs.readdirSync(textDir)
      .filter(f => /^ch\d+\.xhtml$/.test(f))
      .sort();
    const lastChapter = chapterFiles[chapterFiles.length - 1];

    for (const file of chapterFiles) {
      const filePath = path.join(textDir, file);
      let content = fs.readFileSync(filePath, 'utf8');
      const originalLen = content.length;

      content = content.replace(frontMatter, '');
      if (backMatter && file !== lastChapter) {
        content = content.replace(backMatter, '');
      }

      if (content.length !== originalLen) {
        fs.writeFileSync(filePath, content);
      }
    }

    const navPath = path.join(tmpDir, 'EPUB', 'nav.xhtml');
    if (fs.existsSync(navPath)) {
      let nav = fs.readFileSync(navPath, 'utf8');
      const navLen = nav.length;
      if (backMatter) nav = nav.replace(backMatter, '');
      if (nav.length !== navLen) {
        fs.writeFileSync(navPath, nav);
      }
    }

    const absEpub = path.resolve(epubPath);
    fs.unlinkSync(absEpub);
    execFileSync('zip', ['-0', '-X', absEpub, 'mimetype'], { cwd: tmpDir, stdio: 'pipe' });
    execFileSync('zip', ['-r', '-X', absEpub, 'META-INF', 'EPUB'], { cwd: tmpDir, stdio: 'pipe' });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function run(target) {
  const { args, output } = buildPandocArgs(target);

  console.log(`\n  ${target.label}`);
  console.log(`  Input:  ${resolvedFiles.length} file(s)`);
  if (opts.title) console.log(`  Title:  ${opts.title}`);
  if (opts.author) console.log(`  Author: ${opts.author}`);
  if (target.ext === 'pdf') console.log(`  Trim:   ${opts.trim} (${trim.w} × ${trim.h})`);
  console.log(`  Output: ${output}`);

  try {
    execFileSync('pandoc', args, { stdio: 'pipe' });

    if (target.ext === 'epub') {
      cleanupEpub(output);
    }

    const stat = fs.statSync(output);
    const sizeMB = (stat.size / (1024 * 1024)).toFixed(1);
    console.log(`  Done    ${output} (${sizeMB} MB)`);
  } catch (err) {
    console.error(`\n  Failed: ${target.label}`);
    if (err.stderr) {
      const msg = err.stderr.toString().trim();
      if (msg) console.error(`\n${msg}\n`);
    }
    if (target.ext === 'pdf' && !commandExists('xelatex')) {
      console.error('  xelatex not found. Install a TeX distribution:');
      console.error('    apt install texlive-xetex texlive-fonts-recommended texlive-latex-extra');
    }
    process.exit(1);
  }
}

const PAPERBACK = { label: 'Paperback PDF',  ext: 'pdf',  suffix: '-paperback', innerMargin: trim.inner,   openRight: false };
const HARDCOVER = { label: 'Hardcover PDF',  ext: 'pdf',  suffix: '-hardcover', innerMargin: trim.hcInner, openRight: true  };
const KINDLE    = { label: 'Kindle EPUB',    ext: 'epub', suffix: '',           innerMargin: null,         openRight: false };

let targets;
switch (opts.format) {
  case 'all':  targets = [PAPERBACK, HARDCOVER, KINDLE]; break;
  case 'pdf':  targets = [{ ...PAPERBACK, suffix: '' }]; break;
  case 'epub': targets = [KINDLE]; break;
}

console.log('\n  book-convert');
console.log('  ───────────');

for (const target of targets) {
  run(target);
}

console.log('\n  All done.\n');
