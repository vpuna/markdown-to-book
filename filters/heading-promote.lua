-- Pandoc Lua filter: promote chapter headings for single-story books
--
-- Stories use # Title (H1) for the book title and ## Chapter Name (H2)
-- for chapters. The book title is redundant because it is already passed
-- via --metadata title and rendered on the title page by the template.
--
-- This filter:
--   1. Removes the first H1 heading (the book title)
--   2. Promotes all remaining headings by one level (H2 → H1, H3 → H2)
--   3. For EPUB/HTML: converts promoted H2 subsections into bold paragraphs
--      so Pandoc does not wrap them in <section> tags (which cause unwanted
--      page breaks in EPUB readers)
--
-- After promotion, Pandoc maps H1 to \chapter (LaTeX) or EPUB chapters,
-- giving each ## heading proper chapter treatment in both print and ebook.

local removed_first_h1 = false
local is_html = FORMAT:match('html') or FORMAT:match('epub')

function Header(el)
  if el.level == 1 and not removed_first_h1 then
    removed_first_h1 = true
    return {}
  end

  if el.level > 1 then
    el.level = el.level - 1
  end

  if is_html and el.level == 2 then
    return pandoc.Div(
      {pandoc.Para({pandoc.Strong(el.content)})},
      pandoc.Attr(el.identifier, {"section-heading"})
    )
  end

  return el
end
