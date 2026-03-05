# book-convert

A CLI tool that converts Markdown files into print-ready books for Amazon KDP. One command produces paperback PDFs, hardcover PDFs, and Kindle EPUBs with proper margins, typography, and scene breaks.

Built for self-publishers who want to write in plain Markdown and skip the formatting hell of Word or InDesign.

## What It Does

- Converts one or more `.md` files into KDP-compliant output
- Generates **paperback PDF**, **hardcover PDF**, and **Kindle EPUB** in a single run
- Handles KDP trim sizes (5x8, 5.25x8, 5.5x8.5, 6x9) with correct gutter margins
- Produces a title page, copyright page, and optional table of contents
- Converts `---` scene breaks into typeset `* * *` separators (print and EPUB)
- Uses EB Garamond (with Latin Modern Roman fallback) for professional interior typography
- Supports cover images for EPUB output

## Prerequisites

**Pandoc** (Markdown to PDF/EPUB conversion):

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

# Optional: EB Garamond font (falls back to Latin Modern Roman without it)
sudo apt install texlive-fonts-extra

# macOS
brew install --cask mactex
```

## Installation

```bash
git clone https://github.com/vpuna/markdown-to-book.git
cd markdown-to-book
npm install
```

The only Node dependency is [Commander.js](https://github.com/tj/commander.js) for CLI argument parsing. The heavy lifting is done by Pandoc and XeLaTeX.

## Usage

```bash
# All three formats (paperback + hardcover + EPUB)
node convert.js story.md -t "My Book" -a "Jane Smith"

# Paperback PDF only
node convert.js story.md -f pdf -t "My Book" -a "Jane Smith"

# Kindle EPUB with a cover image
node convert.js story.md -f epub -t "My Book" -a "Jane Smith" --cover cover.jpg

# Multiple files combined into one book (e.g., a short story collection)
node convert.js chapters/*.md -t "Collected Stories" -a "Jane Smith" --toc

# Custom trim size and font
node convert.js story.md -f pdf -t "My Book" --trim 6x9 --font-size 12pt
```

## Options

| Flag | Description | Default |
|------|-------------|---------|
| `-t, --title <title>` | Book title | None |
| `-a, --author <author>` | Author name | None |
| `-s, --subtitle <text>` | Subtitle (appears on title page) | None |
| `-f, --format <format>` | Output format: `pdf`, `epub`, or `all` | `all` |
| `-o, --output <name>` | Output filename (extension added automatically) | Derived from title or input filename |
| `--trim <size>` | Trim size: `5x8`, `5.25x8`, `5.5x8.5`, `6x9` | `5x8` |
| `--toc` | Include table of contents | Off |
| `--cover <path>` | Cover image for EPUB | None |
| `--font-size <pt>` | Font size: `10pt`, `11pt`, `12pt` | `11pt` |
| `--open-right` | Start chapters on right-hand (odd) pages (for hardcover) | Off |
| `--year <year>` | Copyright year | Current year |
| `--isbn <isbn>` | ISBN for copyright page | None |

## How It Works

The tool is a thin orchestration layer around Pandoc:

1. **Input**: One or more Markdown files, sorted by filename. Each `# Heading` becomes a chapter.
2. **Scene breaks**: A Lua filter (`filters/scene-break.lua`) intercepts `---` horizontal rules and replaces them with typeset `* * *` separators. In LaTeX output, this uses a custom `\scenebreak` command. In EPUB, it produces a styled `<p>` element.
3. **PDF output**: Pandoc renders through XeLaTeX using a custom template (`templates/kdp-print.tex`) that handles page geometry, margins, headers/footers, chapter titles, and widow/orphan protection. Hardcover builds use wider inner margins and `openright` page breaks.
4. **EPUB output**: Pandoc produces an EPUB3 file styled with `templates/epub.css`. Cover images are passed through Pandoc's `--epub-cover-image` flag.

## Project Structure

```
markdown-to-book/
├── convert.js              # CLI entry point
├── package.json
├── templates/
│   ├── kdp-print.tex       # LaTeX template for print PDFs
│   └── epub.css            # Stylesheet for Kindle EPUBs
└── filters/
    └── scene-break.lua     # Pandoc Lua filter for --- scene breaks
```

## KDP Trim Sizes and Margins

The tool includes margin presets that meet KDP's print requirements:

| Trim Size | Inner (PB) | Inner (HC) | Outer | Top | Bottom |
|-----------|-----------|-----------|-------|-----|--------|
| 5" x 8" | 0.70" | 0.85" | 0.50" | 0.70" | 0.70" |
| 5.25" x 8" | 0.75" | 0.90" | 0.50" | 0.70" | 0.70" |
| 5.5" x 8.5" | 0.80" | 0.95" | 0.55" | 0.75" | 0.75" |
| 6" x 9" | 0.85" | 1.00" | 0.60" | 0.80" | 0.80" |

Inner margins are wider for hardcover to account for the thicker binding. These values meet or exceed KDP's minimums for books up to ~400 pages.

## Writing Your Markdown

Write your book as a standard Markdown file. The tool expects:

- `# Title` for the book/chapter title (becomes a chapter heading)
- `---` for scene breaks (converted to `* * *` in output)
- Standard Markdown for emphasis (`*italics*`, `**bold**`), block quotes, and lists
- No front matter or metadata in the Markdown itself (title, author, etc. are passed as CLI flags)

Example:

```markdown
# Chapter One

The rain hadn't stopped in three days.

Marcus closed his laptop and looked out the window. The harbour was empty
except for a single trawler rocking against the jetty, its deck lights
casting yellow smears across the water.

---

He found the letter in the kitchen drawer, underneath a stack of takeaway
menus and a broken torch.
```

## License

MIT
