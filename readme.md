# markdown-to-book

A CLI tool that converts Markdown files into print-ready books for Amazon KDP. One command can produce paperback PDF, hardcover PDF, and Kindle EPUB with margins, typography, front matter, and an optional table of contents.

Built for self-publishers who want to write in plain Markdown and skip the formatting hell of Word or InDesign.

## What It Does

- Converts one or more `.md` files into KDP-oriented output (files are sorted by **basename**)
- With `-f all` (default): **paperback PDF**, **hardcover PDF** (wider inner margin, chapters start on recto), and **Kindle EPUB** in one run
- With `-f pdf`: a **single** paperback-style PDF only (same inner margin as paperback; no hardcover variant)
- With `-f epub`: Kindle EPUB only
- KDP trim sizes (`5x8`, `5.25x8`, `5.5x8.5`, `6x9`) with gutter-aware inner margins
- **Print**: title page, copyright page, and optional **table of contents** (`--toc`) listing **chapters only** (`--toc-depth=1`); LaTeX template uses `tocdepth` so the visible TOC matches chapter-level divisions
- **EPUB**: Pandoc’s default title page is turned off; **custom HTML** title and copyright blocks are injected before the body (`templates/epub.css` styles them). With `--toc`, the EPUB gets a **navigation / contents index** at chapter depth only
- After each EPUB build, the tool **repacks** the EPUB and strips duplicate copies of that front-matter HTML from split chapter files (`ch*.xhtml`) so title and copyright do not repeat inside every chapter (requires `unzip` and `zip` on `PATH`)
- `---` scene breaks become centered `* * *` (print via `\scenebreak` in `kdp-print.tex`; EPUB via a styled paragraph)
- Print PDFs use **EB Garamond** when TeX Live’s EB Garamond OTF is present, otherwise **Latin Modern Roman**
- Optional **cover image** for EPUB via `--epub-cover-image` (Pandoc)

## Prerequisites

**Pandoc** (Markdown to PDF/EPUB):

```bash
# Ubuntu / Debian
sudo apt install pandoc

# macOS
brew install pandoc
```

**TeX Live** (PDF generation via XeLaTeX):

```bash
# Ubuntu / Debian
sudo apt install texlive-xetex texlive-fonts-recommended texlive-latex-extra

# Optional: EB Garamond (falls back to Latin Modern Roman without it)
sudo apt install texlive-fonts-extra

# macOS
brew install --cask mactex
```

**ZIP tools** (EPUB post-processing; usually already installed):

```bash
# Ubuntu / Debian
sudo apt install zip unzip
```

## Installation

From the repository root:

```bash
cd app
npm install
```

The only Node dependency is [Commander.js](https://github.com/tj/commander.js) for CLI parsing. Conversion is done by Pandoc and XeLaTeX (and `unzip`/`zip` for EPUB cleanup).

You can run `node convert.js`, `npm run convert --`, or use the `book-convert` bin from `package.json` if linked globally.

## Usage

```bash
# All three outputs (paperback + hardcover + EPUB), with a contents index
node convert.js story.md -t "My Book" -a "Jane Smith" --toc

# Paperback-style PDF only (one file: <basename>.pdf)
node convert.js story.md -f pdf -t "My Book" -a "Jane Smith"

# Kindle EPUB with cover
node convert.js story.md -f epub -t "My Book" -a "Jane Smith" --cover cover.jpg --toc

# Several files, one book (sorted by filename)
node convert.js chapters/*.md -t "Collected Stories" -a "Jane Smith" --toc

# Trim and body size
node convert.js story.md -f pdf -t "My Book" --trim 6x9 --font-size 12pt
```

## Output filenames

Base name comes from `-o`/`--output` (extension stripped), else from the single input file’s basename, else a slug derived from `--title`, else `book`.

| Mode | Files written |
|------|----------------|
| `-f all` | `<base>-paperback.pdf`, `<base>-hardcover.pdf`, `<base>.epub` |
| `-f pdf` | `<base>.pdf` |
| `-f epub` | `<base>.epub` |

## Options

| Flag | Description | Default |
|------|-------------|---------|
| `-t, --title <title>` | Book title | None |
| `-a, --author <author>` | Author name | None |
| `-s, --subtitle <text>` | Subtitle on title page (HTML + LaTeX) | `Hard Science Fiction` |
| `-f, --format <format>` | `pdf`, `epub`, or `all` | `all` |
| `-o, --output <name>` | Output basename (extension added automatically) | See above |
| `--trim <size>` | `5x8`, `5.25x8`, `5.5x8.5`, `6x9` | `5x8` |
| `--toc` | Table of contents / EPUB nav (chapters only) | Off |
| `--cover <path>` | Cover image for EPUB | None |
| `--font-size <pt>` | `10pt`, `11pt`, `12pt` | `11pt` |
| `--year <year>` | Copyright year | Current year |
| `--isbn <isbn>` | ISBN on copyright page | None |
| `--back-matter <path>` | JSON file with author info and book list for EPUB back matter | None |

Omit the subtitle line on the title page by passing an empty subtitle if your Commander version allows it, e.g. `-s ""`.

**Chapter start (recto):** the hardcover PDF build always passes LaTeX `openright` so chapters begin on odd pages; the paperback PDF build uses `openany`. The script defines a `--open-right` flag in the CLI help, but it is **not** wired into the Pandoc call yet, so it has no effect.

## EPUB Back Matter

When `--back-matter` is provided, the EPUB gets a back matter page after the final chapter. It is **not** added to print PDFs.

The page contains (in order):

1. The book title and a horizontal rule (mirrors the title page)
2. A "Did You Enjoy This Book?" section with a review call to action. The review URL is built automatically from `amazonBaseUrls.reviewUrl` + the current book's ASIN (matched by the `--title` flag). If the current book is not in the list, the review section is omitted.
3. A "More from [Author]" section listing all other books from the JSON (the current book is automatically excluded). Each title links to `amazonBaseUrls.bookUrl` + the book's ASIN.
4. A link to the author's Amazon page (from `author.url`)

If the JSON is provided but the current book has no ASIN match and there are no other books, no back matter is generated.

**`--back-matter` JSON format:**

```json
{
  "amazonBaseUrls": {
    "bookUrl": "https://www.amazon.com/dp/",
    "reviewUrl": "https://www.amazon.com/review/create-review?asin="
  },
  "author": {
    "name": "Author Name",
    "url": "https://www.amazon.com/stores/author/[Author ID]"
  },
  "books": [
    { "title": "Book Name 1", "asin": "ASIN 1" },
    { "title": "Book Name 2", "asin": "ASIN 2" }
  ]
}
```

Required fields: `amazonBaseUrls.bookUrl`, `amazonBaseUrls.reviewUrl`, and each book entry needs `title` and `asin`. The `author` object is optional but recommended. The tool validates the file on startup and exits with an error if the format is wrong.

**Example with back matter:**

```bash
node convert.js story.md -f epub \
  -t "Book Name 2" -a "Author Name" \
  --cover cover.jpg --toc \
  --back-matter back-matter-sample.json
```

## How It Works

1. **Input**: One or more Markdown paths; resolved and sorted by **basename**. Non-`.md` paths print a warning but are still passed to Pandoc.
2. **Pandoc**: `markdown` input, `--top-level-division=chapter`, `lang=en`, metadata from CLI.
3. **`filters/scene-break.lua`**: Replaces `---` with `\scenebreak` (LaTeX) or a centered `* * *` paragraph (EPUB/HTML).
4. **`filters/heading-promote.lua`**: Drops the **first** `#` heading (book title; title page already shows it). Shifts all remaining headings up one level (`##` → chapter, `###` → section). For **HTML/EPUB only**, promoted level-2 headings (originally `###` in the source) become **bold paragraphs** inside a `section-heading` div so Pandoc does not emit extra `<section>` wrappers that force awkward page breaks in readers. Print keeps real `\section` styling for those blocks.
5. **`--toc`**: Adds `--toc --toc-depth=1` so only top-level divisions (chapters after promotion) appear in the print TOC and in the EPUB contents / navigation.
6. **PDF**: Custom template `templates/kdp-print.tex` (geometry, headers, chapter and section titles, widow/orphan tuning, `microtype`, emergency stretch for narrow trims). Hardcover targets pass wider **inner** margin and `-V open-right=true`.
7. **EPUB**: `--epub-title-page=false`, `templates/epub.css`, and `--include-before-body` with generated title + copyright HTML. Optional `--epub-cover-image`. If `--back-matter` is set, back matter HTML (review CTA, book list, author link) is injected via `--include-after-body`. Then **`cleanupEpub`**: unpack, remove duplicated front-matter HTML from `EPUB/text/ch*.xhtml`, remove duplicated back-matter HTML from `nav.xhtml`, repack with `mimetype` stored uncompressed first (EPUB convention).

## Project Structure

```
app/
├── convert.js              # CLI entry point
├── package.json
├── templates/
│   ├── kdp-print.tex       # LaTeX template for print PDFs
│   └── epub.css            # EPUB body, front-matter, and back-matter styles
└── filters/
    ├── scene-break.lua     # --- → scene break
    └── heading-promote.lua # Strip first H1, promote headings, EPUB ### handling
```

## KDP Trim Sizes and Margins

Presets aim to meet KDP interior minimums:

| Trim Size | Inner (PB) | Inner (HC) | Outer | Top | Bottom |
|-----------|------------|------------|-------|-----|--------|
| 5" x 8" | 0.70" | 0.85" | 0.50" | 0.70" | 0.70" |
| 5.25" x 8" | 0.75" | 0.90" | 0.50" | 0.70" | 0.70" |
| 5.5" x 8.5" | 0.80" | 0.95" | 0.55" | 0.75" | 0.75" |
| 6" x 9" | 0.85" | 1.00" | 0.60" | 0.80" | 0.80" |

Inner margins are wider for the hardcover PDF so the thicker binding has enough gutter.

## Writing Your Markdown

- `# Title` for the in-file book title (stripped from the body after the title page is built; still pass `-t` for metadata and consistency)
- `## Chapter Name` for chapters (after the filter, these are top-level chapters in PDF and EPUB)
- `### Subsection` for subsections; in **EPUB** these render as styled bold paragraphs, not nested chapter sections, to avoid bad page breaks
- `---` for scene breaks
- Normal Markdown for emphasis, quotes, lists
- Title, author, subtitle, year, ISBN come from CLI flags, not from YAML in the `.md` files

Example:

```markdown
# My Book

## Chapter One

The rain hadn't stopped in three days.

Marcus closed his laptop and looked out the window.

---

He found the letter in the kitchen drawer.

## Chapter Two

The harbour master's office smelled like diesel and old paper.
```

## License

MIT
