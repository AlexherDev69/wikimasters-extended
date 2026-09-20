import { fillTagField, type FillTagFieldDeps } from '../data/fill-tag-field';
import type { TagSection } from '../data/find-tag-section';
import {
  TAG_ATTRIBUTE,
  TAG_PROPOSAL_BUTTON_ATTRIBUTE,
  TAG_PROPOSALS_ATTRIBUTE,
  TAG_PROPOSALS_KEY_ATTRIBUTE,
  TAG_PROPOSALS_SELECTOR,
} from '../data/tag-selectors';

const NODE_TAG = 'div';
const LABEL_TAG = 'span';
const BUTTON_TAG = 'button';
const BUTTON_TYPE = 'button';

const NODE_CLASS = 'wme-tag-suggestions';
const LABEL_CLASS = 'wme-tag-suggestions-label';
const BUTTON_CLASS = 'wme-tag-suggestion';
const PENDING_CLASS = 'wme-tag-suggestions-pending';

const NODE_LABEL_TEXT = 'Étiquettes suggérées';
/**
 * Shown while the facts of the card have not come back yet. Written out
 * rather than drawn as three dots: the section is otherwise empty, and an
 * empty section reads as "this card has nothing to propose" when it only
 * means "not yet".
 */
const PENDING_TEXT = 'recherche…';

const ARIA_LABEL_ATTRIBUTE = 'aria-label';
const ROLE_ATTRIBUTE = 'role';
const STATUS_ROLE = 'status';

/** Which of the two things the node shows, so one key can never read as the other. */
type ProposalsState = 'pending' | 'ready';

export type TagProposalsCallbacks = FillTagFieldDeps;

/** Where our proposals go in the tag section, and what is already there. */
export interface TagProposalsTarget {
  /**
   * Title of the card shown in the modal. Null while it cannot be read, so a
   * previous card's proposals go away instead of describing the wrong one.
   */
  title: string | null;
  section: TagSection;
  /** The node added by a previous sync, null when there is none yet. */
  ourNode: HTMLElement | null;
}

/** Locates the insertion point in an already found tag section. */
export function findTagProposalsTarget(title: string | null, section: TagSection): TagProposalsTarget {
  return {
    title,
    section,
    ourNode: section.root.querySelector<HTMLElement>(TAG_PROPOSALS_SELECTOR),
  };
}

/**
 * The input each drawn node's buttons captured. The key below cannot see a
 * re-render that swaps the input while the title and the proposals stay the
 * same: the buttons would then keep writing into a node the site has taken
 * off the page. Holding the element itself is the only exact comparison, and
 * a WeakMap keeps nothing alive once the node is gone.
 */
const inputByNode = new WeakMap<HTMLElement, HTMLInputElement>();

/**
 * The comparison key of the whole node: the card title and the state,
 * together with the proposals, so a sync writes nothing when the section
 * already shows this very list for this very card, and rebuilds when any of
 * them changes. The state is part of the key and not a tag among the others:
 * a card whose only proposal was the word below would otherwise keep the
 * waiting node once its facts arrived.
 */
function proposalsKey(
  title: string | null,
  state: ProposalsState,
  tags: readonly string[],
): string {
  return JSON.stringify([title, state, ...tags]);
}

function ariaLabelFor(tag: string): string {
  return `Ajouter l'étiquette ${tag}`;
}

/**
 * Selects the text of `button` alone, so the user can copy it. Only our own
 * node is ever the target of the selection: no node of the site is read from
 * or written to by this.
 */
function selectProposalText(button: HTMLButtonElement): void {
  const selection = button.ownerDocument.defaultView?.getSelection() ?? null;
  if (selection === null) {
    return;
  }
  const range = button.ownerDocument.createRange();
  range.selectNodeContents(button);
  selection.removeAllRanges();
  selection.addRange(range);
}

function buildButton(
  document: Document,
  tag: string,
  input: HTMLInputElement,
  callbacks: TagProposalsCallbacks,
): HTMLButtonElement {
  const button = document.createElement(BUTTON_TAG);
  button.type = BUTTON_TYPE;
  button.className = BUTTON_CLASS;
  button.setAttribute(TAG_PROPOSAL_BUTTON_ATTRIBUTE, '');
  button.setAttribute(TAG_ATTRIBUTE, tag);
  button.setAttribute(ARIA_LABEL_ATTRIBUTE, ariaLabelFor(tag));
  button.textContent = tag;

  button.addEventListener('click', (event) => {
    // Guards against a script dispatching a synthetic click on our own node:
    // only a click the user actually made may act on the page.
    if (!event.isTrusted) {
      return;
    }
    // Asked again here, at click time: the setting may have changed since
    // this button was built, and this decides between two very different
    // things, one of which writes on the site.
    if (callbacks.isAutoFillEnabled()) {
      fillTagField(event, input, tag, callbacks);
      return;
    }
    selectProposalText(button);
  });

  return button;
}

/** The node and its label, all a waiting node ever needs. */
function buildShell(document: Document, key: string): HTMLElement {
  const node = document.createElement(NODE_TAG);
  node.className = NODE_CLASS;
  node.setAttribute(TAG_PROPOSALS_ATTRIBUTE, '');
  node.setAttribute(TAG_PROPOSALS_KEY_ATTRIBUTE, key);

  const label = document.createElement(LABEL_TAG);
  label.className = LABEL_CLASS;
  label.textContent = NODE_LABEL_TEXT;
  node.appendChild(label);

  return node;
}

function buildNode(
  document: Document,
  tags: readonly string[],
  key: string,
  input: HTMLInputElement,
  callbacks: TagProposalsCallbacks,
): HTMLElement {
  const node = buildShell(document, key);

  for (const tag of tags) {
    node.appendChild(buildButton(document, tag, input, callbacks));
  }
  return node;
}

function buildPendingNode(document: Document, key: string): HTMLElement {
  const node = buildShell(document, key);

  const pending = document.createElement(LABEL_TAG);
  pending.className = PENDING_CLASS;
  // Announced when it appears and when it is replaced by the proposals, which
  // is exactly the change a reader who cannot see the section would miss.
  pending.setAttribute(ROLE_ATTRIBUTE, STATUS_ROLE);
  pending.textContent = PENDING_TEXT;
  node.appendChild(pending);

  return node;
}

/**
 * Brings the proposals node of the tag section in line with `tags`, and
 * writes NOTHING when it already shows this very list for this very card:
 * the content script observes document.body, so a sync that always wrote
 * would schedule another scan, which syncs again, forever. Removed entirely
 * once there is nothing left to propose, rather than left empty.
 *
 * The only node touched is ours, built from `div`, `span` and `button` only,
 * inserted once right after the input wrapper and never moved again. The
 * nodes of the site making up the section are read, never modified.
 */
export function applyTagProposals(
  target: TagProposalsTarget,
  tags: readonly string[],
  callbacks: TagProposalsCallbacks,
): void {
  const { ourNode } = target;

  if (tags.length === 0) {
    ourNode?.remove();
    return;
  }

  const key = proposalsKey(target.title, 'ready', tags);
  if (
    ourNode !== null &&
    ourNode.getAttribute(TAG_PROPOSALS_KEY_ATTRIBUTE) === key &&
    inputByNode.get(ourNode) === target.section.input
  ) {
    return;
  }

  ourNode?.remove();
  const document = target.section.inputWrapper.ownerDocument;
  const node = buildNode(document, tags, key, target.section.input, callbacks);
  inputByNode.set(node, target.section.input);
  target.section.inputWrapper.insertAdjacentElement('afterend', node);
}

/**
 * Says that the facts of the card are on their way, in the very place the
 * proposals will take. Without it the section stays empty for as long as the
 * request lasts, which reads as a card with nothing to propose rather than as
 * a card still being looked up.
 *
 * Idempotent like the call above, and through the same key: a card left
 * waiting across several syncs is written once.
 */
export function applyPendingProposals(target: TagProposalsTarget): void {
  const { ourNode } = target;
  const key = proposalsKey(target.title, 'pending', []);

  if (ourNode !== null && ourNode.getAttribute(TAG_PROPOSALS_KEY_ATTRIBUTE) === key) {
    return;
  }

  ourNode?.remove();
  const node = buildPendingNode(target.section.inputWrapper.ownerDocument, key);
  target.section.inputWrapper.insertAdjacentElement('afterend', node);
}

/**
 * Takes back every proposals node under `root`. Called when the setting is
 * switched off and when the content script context is invalidated, so
 * reloading the extension does not leave a node behind that nothing keeps in
 * line with the card on screen any more.
 */
export function removeTagProposals(root: ParentNode): void {
  for (const node of root.querySelectorAll(TAG_PROPOSALS_SELECTOR)) {
    node.remove();
  }
}
