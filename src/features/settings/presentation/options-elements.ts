/**
 * The two builders the sections of the options page share. Nodes are always
 * filled through `textContent`, never through `innerHTML`.
 */

const SECTION_TAG = 'section';
const HEADING_TAG = 'h2';
const PARAGRAPH_TAG = 'p';

const SECTION_CLASS = 'wme-section';
const SECTION_TITLE_CLASS = 'wme-section-title';

/** A section with the heading that names it, for a screen reader as for the eye. */
export function createSection(title: string): HTMLElement {
  const section = document.createElement(SECTION_TAG);
  section.className = SECTION_CLASS;

  const heading = document.createElement(HEADING_TAG);
  heading.className = SECTION_TITLE_CLASS;
  heading.textContent = title;
  section.appendChild(heading);

  return section;
}

export function createParagraph(className: string, text: string): HTMLParagraphElement {
  const paragraph = document.createElement(PARAGRAPH_TAG);
  paragraph.className = className;
  paragraph.textContent = text;
  return paragraph;
}
