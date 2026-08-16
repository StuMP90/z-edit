/**
 * Selection Manager for z-edit Editor
 * Handles cursor positioning, text selection, and coordinate between DOM and content model
 */

class SelectionManager {
    constructor(editorElement, contentModel) {
        this.editor = editorElement;
        this.contentModel = contentModel;
        this.savedRange = null;
        this.savedIndex = null;
        this.savedLength = null;
    }

    /**
     * Get current selection as content model indices
     */
    getSelection() {
        // If no editor element (for testing), return default selection covering all content
        if (!this.editor) {
            return { index: 0, length: this.contentModel.length() };
        }

        const selection = window.getSelection();
        if (!selection.rangeCount) {
            return { index: 0, length: 0 };
        }

        const range = selection.getRangeAt(0);
        const { index: startIndex } = this._getDOMPosition(range.startContainer, range.startOffset);
        const { index: endIndex } = this._getDOMPosition(range.endContainer, range.endOffset);

        return {
            index: startIndex,
            length: endIndex - startIndex
        };
    }

    /**
     * Set selection using content model indices
     */
    setSelection(index, length = 0) {
        const endIndex = index + length;
        const { node: startNode, offset: startOffset } = this._getDOMFromIndex(index);
        const { node: endNode, offset: endOffset } = this._getDOMFromIndex(endIndex);

        if (startNode && endNode) {
            const range = document.createRange();
            range.setStart(startNode, startOffset);
            range.setEnd(endNode, endOffset);

            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }

    /**
     * Save current selection state
     */
    save() {
        const selection = window.getSelection();
        if (selection.rangeCount) {
            this.savedRange = selection.getRangeAt(0).cloneRange();
            const { index, length } = this.getSelection();
            this.savedIndex = index;
            this.savedLength = length;
        }
    }

    /**
     * Restore saved selection
     */
    restore() {
        if (this.savedIndex !== null) {
            this.setSelection(this.savedIndex, this.savedLength || 0);
        } else if (this.savedRange) {
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(this.savedRange);
        }
        if (this.editor && this.editor.focus) {
            this.editor.focus();
        }
    }

    /**
     * Clear saved selection
     */
    clearSaved() {
        this.savedRange = null;
        this.savedIndex = null;
        this.savedLength = null;
    }

    /**
     * Get selected text
     */
    getSelectedText() {
        const selection = window.getSelection();
        return selection.toString();
    }

    /**
     * Check if selection is collapsed (cursor)
     */
    isCollapsed() {
        const selection = window.getSelection();
        return selection.isCollapsed;
    }

    /**
     * Get DOM position as content model index
     */
    _getDOMPosition(node, offset) {
        let index = 0;
        const result = this._walkDOM(this.editor, node, offset, 0);
        return { index: result.index };
    }

    /**
     * Walk DOM to find position
     */
    _walkDOM(current, targetNode, targetOffset, currentIndex) {
        if (current === targetNode) {
            if (current.nodeType === Node.TEXT_NODE) {
                return { found: true, index: currentIndex + targetOffset };
            } else {
                return { found: true, index: currentIndex };
            }
        }

        if (current.nodeType === Node.TEXT_NODE) {
            return { found: false, nextIndex: currentIndex + current.textContent.length };
        }

        if (current.nodeType === Node.ELEMENT_NODE) {
            const tagName = current.tagName.toLowerCase();
            let nextIndex = currentIndex;

            // Count block elements as newlines
            if (['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'pre'].includes(tagName)) {
                nextIndex++;
            }

            // Recursively check children
            for (const child of current.childNodes) {
                const result = this._walkDOM(child, targetNode, targetOffset, nextIndex);
                if (result.found) {
                    return result;
                }
                nextIndex = result.nextIndex;
            }

            return { found: false, nextIndex };
        }

        return { found: false, nextIndex: currentIndex };
    }

    /**
     * Get DOM node and offset from content model index
     */
    _getDOMFromIndex(index) {
        let currentIndex = 0;
        const result = this._findDOMPosition(this.editor, index, currentIndex);
        
        if (result.found) {
            return { node: result.node, offset: result.offset };
        }

        // Return end of editor if not found
        return { node: this.editor, offset: this.editor.childNodes.length };
    }

    /**
     * Find DOM position from index
     */
    _findDOMPosition(current, targetIndex, currentIndex) {
        if (current.nodeType === Node.TEXT_NODE) {
            const textLength = current.textContent.length;
            if (currentIndex <= targetIndex && targetIndex < currentIndex + textLength) {
                return { found: true, node: current, offset: targetIndex - currentIndex };
            }
            return { found: false, nextIndex: currentIndex + textLength };
        }

        if (current.nodeType === Node.ELEMENT_NODE) {
            const tagName = current.tagName.toLowerCase();
            let nextIndex = currentIndex;

            // Handle block elements
            if (['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'pre'].includes(tagName)) {
                if (nextIndex === targetIndex) {
                    return { found: true, node: current, offset: 0 };
                }
                nextIndex++;
            }

            // Check children
            for (const child of current.childNodes) {
                const result = this._findDOMPosition(child, targetIndex, nextIndex);
                if (result.found) {
                    return result;
                }
                nextIndex = result.nextIndex;
            }

            return { found: false, nextIndex };
        }

        return { found: false, nextIndex: currentIndex };
    }

    /**
     * Get text at cursor position (for word boundaries, etc.)
     */
    getTextBeforeCursor(length = 10) {
        const { index } = this.getSelection();
        const op = this.contentModel.getOpAt(index);
        
        if (op && op.op.insert && typeof op.op.insert === 'string') {
            const text = op.op.insert;
            const start = Math.max(0, op.offset - length);
            return text.substring(start, op.offset);
        }
        
        return '';
    }

    /**
     * Get text after cursor position
     */
    getTextAfterCursor(length = 10) {
        const { index } = this.getSelection();
        const op = this.contentModel.getOpAt(index);
        
        if (op && op.op.insert && typeof op.op.insert === 'string') {
            const text = op.op.insert;
            const end = Math.min(text.length, op.offset + length);
            return text.substring(op.offset, end);
        }
        
        return '';
    }

    /**
     * Move cursor by character offset
     */
    moveCursor(offset) {
        const { index } = this.getSelection();
        const newIndex = Math.max(0, Math.min(this.contentModel.length(), index + offset));
        this.setSelection(newIndex);
    }

    /**
     * Select word at cursor
     */
    selectWord() {
        const { index } = this.getSelection();
        const op = this.contentModel.getOpAt(index);
        
        if (op && op.op.insert && typeof op.op.insert === 'string') {
            const text = op.op.insert;
            const offset = op.offset;
            
            // Find word boundaries
            let start = offset;
            let end = offset;
            
            // Find start of word
            while (start > 0 && /\w/.test(text[start - 1])) {
                start--;
            }
            
            // Find end of word
            while (end < text.length && /\w/.test(text[end])) {
                end++;
            }
            
            const wordStart = index - offset + start;
            const wordLength = end - start;
            this.setSelection(wordStart, wordLength);
        }
    }

    /**
     * Select line at cursor
     */
    selectLine() {
        const { index } = this.getSelection();
        
        // Find previous newline
        let lineStart = index;
        while (lineStart > 0) {
            const op = this.contentModel.getOpAt(lineStart - 1);
            if (op && op.op.insert === '\n') {
                break;
            }
            lineStart--;
        }
        
        // Find next newline
        let lineEnd = index;
        const totalLength = this.contentModel.length();
        while (lineEnd < totalLength) {
            const op = this.contentModel.getOpAt(lineEnd);
            if (op && op.op.insert === '\n') {
                break;
            }
            lineEnd++;
        }
        
        this.setSelection(lineStart, lineEnd - lineStart);
    }

    /**
     * Select all content
     */
    selectAll() {
        this.setSelection(0, this.contentModel.length());
    }

    /**
     * Delete selection
     */
    deleteSelection() {
        const { index, length } = this.getSelection();
        if (length > 0) {
            this.contentModel.delete(index, length);
            this.setSelection(index);
        }
    }

    /**
     * Check if selection spans multiple blocks
     */
    isMultiBlockSelection() {
        const { index, length } = this.getSelection();
        if (length === 0) return false;

        for (let i = index; i < index + length; i++) {
            const op = this.contentModel.getOpAt(i);
            if (op && op.op.insert === '\n') {
                return true;
            }
        }
        return false;
    }

    /**
     * Get block containing cursor
     */
    getCurrentBlock() {
        // Prefer saved selection, fall back to live selection
        let index = this.savedIndex !== null ? this.savedIndex : this.getSelection().index;
        
        // Find previous newline
        let blockStart = index;
        while (blockStart > 0) {
            const op = this.contentModel.getOpAt(blockStart - 1);
            if (op && op.op && op.op.insert === '\n') {
                break;
            }
            blockStart--;
        }
        
        // Find next newline
        let blockEnd = index;
        const totalLength = this.contentModel.length();
        while (blockEnd < totalLength) {
            const op = this.contentModel.getOpAt(blockEnd);
            if (op && op.op && op.op.insert === '\n') {
                break;
            }
            blockEnd++;
        }
        
        return {
            start: blockStart,
            end: blockEnd,
            length: blockEnd - blockStart
        };
    }

    /**
     * Clean up resources
     */
    destroy() {
        this.editor = null;
        this.contentModel = null;
        this.savedRange = null;
        this.savedIndex = null;
        this.savedLength = null;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SelectionManager;
}
