import { describe, it, expect, vi } from 'vitest';
import { createBlock, createButton, createText } from './create-elements';

describe('createBlock', () => {
  it('should create a div carrying the class it was given', () => {
    const block = createBlock('wme-row');

    expect(block.tagName).toBe('DIV');
    expect(block.className).toBe('wme-row');
  });
});

describe('createText', () => {
  it('should put the text in the node without interpreting it as markup', () => {
    const text = createText('wme-label', '<b>Saint-Malo</b>');

    expect(text.tagName).toBe('SPAN');
    expect(text.textContent).toBe('<b>Saint-Malo</b>');
    expect(text.querySelector('b')).toBeNull();
  });
});

describe('createButton', () => {
  it('should call the handler when the button is clicked', () => {
    const onClick = vi.fn();

    createButton('wme-reset', onClick).click();

    expect(onClick).toHaveBeenCalledOnce();
  });

  it('should never submit a surrounding form', () => {
    expect(createButton('wme-reset', vi.fn()).type).toBe('button');
  });
});
