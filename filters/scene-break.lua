-- Pandoc Lua filter: convert horizontal rules (---) into styled scene breaks
-- LaTeX output uses a custom \scenebreak command defined in the template
-- HTML/EPUB output uses a styled <p> element

function HorizontalRule()
  if FORMAT:match 'latex' or FORMAT:match 'pdf' then
    return pandoc.RawBlock('latex', '\\scenebreak')
  elseif FORMAT:match 'epub' or FORMAT:match 'html' then
    return pandoc.RawBlock('html',
      '<p class="scene-break">&ast;&emsp;&ast;&emsp;&ast;</p>')
  end
end
