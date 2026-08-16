# WYSIWYG HTML Editor v2.0

A pure JavaScript WYSIWYG editor built around a custom Delta-like content model. The v2.0 implementation performs all formatting through direct DOM manipulation and does **not** use `document.execCommand`.

## Features

- ✅ **Pure JavaScript** - No external dependencies
- ✅ **No `document.execCommand`** - All formatting is applied via direct DOM manipulation
- ✅ **Custom content model** - Delta-like operations for content and formatting
- ✅ **DOM-based formatting** - Bold, italic, underline, strikethrough, headings, paragraphs, lists, code, links, images, alignment
- ✅ **Block formatting** - H1, H2, H3, paragraph, unordered/ordered lists, code blocks
- ✅ **Inline formatting** - Bold, italic, underline, strikethrough, inline code
- ✅ **Lists with live CSS** - Proper disc/decimal bullets and numbering
- ✅ **Clear formatting** - Removes inline formatting while preserving line breaks
- ✅ **Code view** - Edit raw HTML directly, including `<table>` and other raw HTML blocks
- ✅ **Split view** - WYSIWYG editor and HTML source side-by-side
- ✅ **Table support** - Paste raw `<table>` HTML in the code view and it is preserved
- ✅ **History support** - State snapshots for undo/redo (currently not exposed in toolbar)

## Files

- `wysiwyg-editor-v2.js` - Main editor component
- `content-model.js` - Custom Delta-like content model
- `selection-manager.js` - Selection mapping between DOM and content model
- `formatting-engine.js` - Formatting operations on the content model
- `dom-renderer.js` - Renders the content model to the DOM
- `input-handler.js` - Typing, Enter, Delete, Backspace handling
- `clipboard-handler.js` - Copy/cut/paste support
- `history-manager.js` - Undo/redo state management
- `browser-compat.js` - Cross-browser compatibility helpers
- `demo-v2.html` - Demo page

## Quick Start

```html
<textarea id="my-editor"></textarea>
<script src="content-model.js"></script>
<script src="dom-renderer.js"></script>
<script src="selection-manager.js"></script>
<script src="formatting-engine.js"></script>
<script src="input-handler.js"></script>
<script src="clipboard-handler.js"></script>
<script src="history-manager.js"></script>
<script src="browser-compat.js"></script>
<script src="wysiwyg-editor-v2.js"></script>
<script>
    const editor = new WYSIWYGEditor({
        target: '#my-editor',
        placeholder: 'Start typing...'
    });
</script>
```

## Configuration

```javascript
const editor = new WYSIWYGEditor({
    target: '#editor',
    placeholder: 'Type something...',
    onChange: (html) => console.log('HTML:', html)
});
```

## API

- `editor.getHTML()` - Get the current HTML
- `editor.getText()` - Get the current plain text
- `editor.setHTML(html)` - Set the editor content from HTML
- `editor.focus()` - Focus the editor
- `editor.destroy()` - Remove the editor and restore the original element

## Notes

- The toolbar does not currently show **Undo**, **Redo**, **Indent**, or **Outdent** buttons.
- `<table>` HTML pasted in the code view is preserved as a raw HTML block.
- Formatting is applied to the current selection or the block containing the cursor.
