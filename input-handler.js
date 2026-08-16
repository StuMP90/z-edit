/**
 * Input Handler for z-edit Editor
 * Handles keyboard events, text input, and user interactions
 */

class InputHandler {
    constructor(editorElement, contentModel, selectionManager, formattingEngine, domRenderer) {
        this.editor = editorElement;
        this.contentModel = contentModel;
        this.selectionManager = selectionManager;
        this.formattingEngine = formattingEngine;
        this.domRenderer = domRenderer;
        this.onChange = null;
        this.onKeyDown = null;
        this.onKeyUp = null;
        
        this._setupEventListeners();
    }

    /**
     * Set change callback
     */
    setOnChange(callback) {
        this.onChange = callback;
    }

    /**
     * Set key down callback
     */
    setOnKeyDown(callback) {
        this.onKeyDown = callback;
    }

    /**
     * Set key up callback
     */
    setOnKeyUp(callback) {
        this.onKeyUp = callback;
    }

    /**
     * Setup event listeners
     */
    _setupEventListeners() {
        this.editor.addEventListener('keydown', this._handleKeyDown.bind(this));
        this.editor.addEventListener('keyup', this._handleKeyUp.bind(this));
        this.editor.addEventListener('input', this._handleInput.bind(this));
        this.editor.addEventListener('beforeinput', this._handleBeforeInput.bind(this));
        this.editor.addEventListener('compositionstart', this._handleCompositionStart.bind(this));
        this.editor.addEventListener('compositionend', this._handleCompositionEnd.bind(this));
    }

    /**
     * Handle key down events
     */
    _handleKeyDown(e) {
        // Call custom callback if provided
        if (this.onKeyDown) {
            const result = this.onKeyDown(e);
            if (result === false) return;
        }

        // Handle special keys
        switch (e.key) {
            case 'Enter':
                // Let browser handle Enter naturally, sync from DOM after
                setTimeout(() => {
                    if (this.domRenderer) {
                        this.domRenderer.syncFromDOM();
                    }
                    this._triggerChange();
                }, 0);
                break;
            case 'Backspace':
                // Let browser handle Backspace naturally, sync from DOM after
                setTimeout(() => {
                    if (this.domRenderer) {
                        this.domRenderer.syncFromDOM();
                    }
                    this._triggerChange();
                }, 0);
                break;
            case 'Delete':
                // Let browser handle Delete naturally, sync from DOM after
                setTimeout(() => {
                    if (this.domRenderer) {
                        this.domRenderer.syncFromDOM();
                    }
                    this._triggerChange();
                }, 0);
                break;
            case 'Tab':
                e.preventDefault();
                this._handleTab(e);
                break;
            case 'ArrowLeft':
            case 'ArrowRight':
            case 'ArrowUp':
            case 'ArrowDown':
                this._handleArrowKeys(e);
                break;
            default:
                // Handle keyboard shortcuts
                if (e.ctrlKey || e.metaKey) {
                    this._handleKeyboardShortcuts(e);
                }
        }
    }

    /**
     * Handle key up events
     */
    _handleKeyUp(e) {
        if (this.onKeyUp) {
            this.onKeyUp(e);
        }
    }

    /**
     * Handle input events
     */
    _handleInput(e) {
        // This is called after the browser has processed the input
        // We need to sync the DOM changes back to our content model
        if (this.domRenderer) {
            this.domRenderer.syncFromDOM();
        }
        this._triggerChange();
    }

    /**
     * Handle before input events
     */
    _handleBeforeInput(e) {
        // Let the browser handle most input events for now
        // We'll sync from DOM after the input is processed
        // This is more reliable than preventing default
    }

    /**
     * Handle composition start (for IME input)
     */
    _handleCompositionStart(e) {
        this.isComposing = true;
    }

    /**
     * Handle composition end (for IME input)
     */
    _handleCompositionEnd(e) {
        this.isComposing = false;
        this._insertText(e.data);
    }

    /**
     * Handle Enter key
     */
    _handleEnter(e) {
        e.preventDefault();
        
        // Save current cursor position
        const { index } = this.selectionManager.getSelection();
        
        if (e.shiftKey) {
            this._insertLineBreak();
        } else {
            this._insertParagraph();
        }
        
        // Re-render to show the changes
        if (this.domRenderer) {
            this.domRenderer.render();
        }
        
        // Restore cursor position after rendering
        setTimeout(() => {
            this.selectionManager.setSelection(index + 1);
        }, 0);
    }

    /**
     * Handle Backspace key
     */
    _handleBackspace(e) {
        // Let the browser handle Backspace naturally
        // We'll sync from DOM after the browser processes it
        
        // Sync from DOM after a short delay to let browser process Backspace
        setTimeout(() => {
            if (this.domRenderer) {
                this.domRenderer.syncFromDOM();
            }
            this._triggerChange();
        }, 0);
    }

    /**
     * Handle Delete key
     */
    _handleDelete(e) {
        // Let the browser handle Delete naturally
        // We'll sync from DOM after the browser processes it
        
        // Sync from DOM after a short delay to let browser process Delete
        setTimeout(() => {
            if (this.domRenderer) {
                this.domRenderer.syncFromDOM();
            }
            this._triggerChange();
        }, 0);
    }

    /**
     * Handle Tab key
     */
    _handleTab(e) {
        e.preventDefault();
        
        if (e.shiftKey) {
            this.formattingEngine.outdent();
        } else {
            this.formattingEngine.indent();
        }
        
        this._triggerChange();
    }

    /**
     * Handle arrow keys
     */
    _handleArrowKeys(e) {
        // Let the browser handle arrow keys for navigation
        // We'll sync the selection after the event
    }

    /**
     * Handle keyboard shortcuts
     */
    _handleKeyboardShortcuts(e) {
        switch (e.key.toLowerCase()) {
            case 'b':
                e.preventDefault();
                this.formattingEngine.bold();
                this._triggerChange();
                break;
            case 'i':
                e.preventDefault();
                this.formattingEngine.italic();
                this._triggerChange();
                break;
            case 'u':
                e.preventDefault();
                this.formattingEngine.underline();
                this._triggerChange();
                break;
            case 'z':
                e.preventDefault();
                if (e.shiftKey) {
                    // Redo - to be implemented with history system
                } else {
                    // Undo - to be implemented with history system
                }
                break;
            case 'y':
                e.preventDefault();
                // Redo - to be implemented with history system
                break;
        }
    }

    /**
     * Insert text at cursor
     */
    _insertText(text) {
        if (!text) return;
        
        const { index, length } = this.selectionManager.getSelection();
        
        // Delete selected text first
        if (length > 0) {
            this.contentModel.delete(index, length);
        }
        
        // Apply cursor formatting if available
        const cursorFormat = this.formattingEngine.getCursorFormat();
        
        // Insert text with formatting
        this.contentModel.insert(index, text, cursorFormat);
        
        // Move cursor after inserted text
        this.selectionManager.setSelection(index + text.length);
        
        this._triggerChange();
    }

    /**
     * Insert paragraph (new block)
     */
    _insertParagraph() {
        const { index } = this.selectionManager.getSelection();
        
        // Get current block formatting
        const block = this.selectionManager.getCurrentBlock();
        const { start, end } = this.contentModel._findOps(block.start, block.length);
        
        let blockFormat = 'p';
        let listFormat = null;
        let indent = 0;
        
        for (let i = start; i <= end; i++) {
            if (this.contentModel.ops[i].insert === '\n' && this.contentModel.ops[i].attributes) {
                blockFormat = this.contentModel.ops[i].attributes.block || 'p';
                listFormat = this.contentModel.ops[i].attributes.list || null;
                indent = this.contentModel.ops[i].attributes.indent || 0;
                break;
            }
        }
        
        // Insert newline with current block formatting
        const attributes = { block: blockFormat };
        if (listFormat) {
            attributes.list = listFormat;
            attributes.indent = indent;
        }
        
        this.contentModel.insert(index, '\n', attributes);
        
        // Move cursor to new line
        this.selectionManager.setSelection(index + 1);
        
        this._triggerChange();
    }

    /**
     * Insert line break (soft return)
     */
    _insertLineBreak() {
        const { index } = this.selectionManager.getSelection();
        
        // Insert a simple line break without block formatting
        this.contentModel.insert(index, '\n', { soft: true });
        
        // Move cursor after line break
        this.selectionManager.setSelection(index + 1);
        
        this._triggerChange();
    }

    /**
     * Delete backward (Backspace)
     */
    _deleteBackward() {
        const { index, length } = this.selectionManager.getSelection();
        
        if (length > 0) {
            // Delete selection
            this.contentModel.delete(index, length);
            this.selectionManager.setSelection(index);
        } else if (index > 0) {
            // Delete character before cursor
            this.contentModel.delete(index - 1, 1);
            this.selectionManager.setSelection(index - 1);
        }
        
        this._triggerChange();
    }

    /**
     * Delete forward (Delete key)
     */
    _deleteForward() {
        const { index, length } = this.selectionManager.getSelection();
        
        if (length > 0) {
            // Delete selection
            this.contentModel.delete(index, length);
            this.selectionManager.setSelection(index);
        } else if (index < this.contentModel.length()) {
            // Delete character after cursor
            this.contentModel.delete(index, 1);
            this.selectionManager.setSelection(index);
        }
        
        this._triggerChange();
    }

    /**
     * Trigger change callback
     */
    _triggerChange() {
        if (this.onChange) {
            this.onChange(this.contentModel.toHTML());
        }
    }

    /**
     * Remove event listeners
     */
    destroy() {
        this.editor.removeEventListener('keydown', this._handleKeyDown.bind(this));
        this.editor.removeEventListener('keyup', this._handleKeyUp.bind(this));
        this.editor.removeEventListener('input', this._handleInput.bind(this));
        this.editor.removeEventListener('beforeinput', this._handleBeforeInput.bind(this));
        this.editor.removeEventListener('compositionstart', this._handleCompositionStart.bind(this));
        this.editor.removeEventListener('compositionend', this._handleCompositionEnd.bind(this));
        
        this.editor = null;
        this.contentModel = null;
        this.selectionManager = null;
        this.formattingEngine = null;
        this.onChange = null;
        this.onKeyDown = null;
        this.onKeyUp = null;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = InputHandler;
}
