/**
 * DOM Renderer for z-edit Editor
 * Renders content model to DOM and handles DOM-to-model synchronization
 */

class DOMRenderer {
    constructor(editorElement) {
        this.editor = editorElement;
        this.contentModel = null;
        this.selectionManager = null;
    }

    /**
     * Set the content model to render
     */
    setContentModel(model) {
        this.contentModel = model;
        return this;
    }

    /**
     * Set the selection manager
     */
    setSelectionManager(manager) {
        this.selectionManager = manager;
        return this;
    }

    /**
     * Render the content model to DOM
     */
    render() {
        if (!this.contentModel) {
            this.editor.innerHTML = '';
            return;
        }

        const html = this.contentModel.toHTML();
        this.editor.innerHTML = html;
        
        // Restore selection if available
        if (this.selectionManager) {
            this.selectionManager.restore();
        }
    }

    /**
     * Update DOM incrementally (for performance)
     */
    update(changes) {
        // For now, do full re-render
        // TODO: Implement incremental updates
        this.render();
    }

    /**
     * Get current DOM content as HTML
     */
    getHTML() {
        return this.editor.innerHTML;
    }

    /**
     * Sync DOM changes back to content model
     */
    syncFromDOM() {
        if (!this.contentModel) return;

        const html = this.getHTML();
        this.contentModel.fromHTML(html);
    }

    /**
     * Insert text at cursor position
     */
    insertText(text) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        const { index } = this._getDOMPosition(range.startContainer, range.startOffset);
        
        this.contentModel.insert(index, text);
        this.render();
        
        // Move cursor after inserted text
        this._setCursorAt(index + text.length);
    }

    /**
     * Delete text at current selection
     */
    deleteSelection() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        const { index: startIndex } = this._getDOMPosition(range.startContainer, range.startOffset);
        const { index: endIndex } = this._getDOMPosition(range.endContainer, range.endOffset);
        
        const length = endIndex - startIndex;
        if (length > 0) {
            this.contentModel.delete(startIndex, length);
            this.render();
            this._setCursorAt(startIndex);
        }
    }

    /**
     * Format current selection
     */
    formatSelection(attributes) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        const { index: startIndex } = this._getDOMPosition(range.startContainer, range.startOffset);
        const { index: endIndex } = this._getDOMPosition(range.endContainer, range.endOffset);
        
        const length = endIndex - startIndex;
        if (length > 0) {
            this.contentModel.format(startIndex, length, attributes);
            this.render();
            this._restoreSelection(startIndex, endIndex);
        }
    }

    /**
     * Get DOM position as content model index
     */
    _getDOMPosition(node, offset) {
        // Walk through DOM to calculate position
        let index = 0;
        let current = this.editor.firstChild;

        while (current) {
            if (current === node) {
                return { index: index + offset };
            }

            if (current.nodeType === Node.TEXT_NODE) {
                index += current.textContent.length;
            } else if (current.nodeType === Node.ELEMENT_NODE) {
                // Handle block elements
                const tagName = current.tagName.toLowerCase();
                if (['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'pre'].includes(tagName)) {
                    index++; // Count as newline
                }
                
                // Recursively check children
                for (const child of current.childNodes) {
                    const result = this._findNodeInTree(child, node, offset, index);
                    if (result.found) {
                        return { index: result.index };
                    }
                    index = result.nextIndex;
                }
            }

            current = current.nextSibling;
        }

        return { index };
    }

    /**
     * Find node in tree and calculate index
     */
    _findNodeInTree(node, targetNode, targetOffset, currentIndex) {
        if (node === targetNode) {
            return { found: true, index: currentIndex + targetOffset };
        }

        if (node.nodeType === Node.TEXT_NODE) {
            return { found: false, nextIndex: currentIndex + node.textContent.length };
        }

        if (node.nodeType === Node.ELEMENT_NODE) {
            const tagName = node.tagName.toLowerCase();
            let nextIndex = currentIndex;

            if (['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'pre'].includes(tagName)) {
                nextIndex++;
            }

            for (const child of node.childNodes) {
                const result = this._findNodeInTree(child, targetNode, targetOffset, nextIndex);
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
     * Set cursor at content model index
     */
    _setCursorAt(index) {
        const { node, offset } = this._getDOMFromIndex(index);
        if (node) {
            const range = document.createRange();
            range.setStart(node, offset);
            range.collapse(true);
            
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }

    /**
     * Restore selection range
     */
    _restoreSelection(startIndex, endIndex) {
        const { node: startNode, offset: startOffset } = this._getDOMFromIndex(startIndex);
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
     * Get DOM node and offset from content model index
     */
    _getDOMFromIndex(index) {
        let currentIndex = 0;
        let current = this.editor.firstChild;

        while (current) {
            if (current.nodeType === Node.TEXT_NODE) {
                const textLength = current.textContent.length;
                if (currentIndex <= index && index < currentIndex + textLength) {
                    return { node: current, offset: index - currentIndex };
                }
                currentIndex += textLength;
            } else if (current.nodeType === Node.ELEMENT_NODE) {
                const tagName = current.tagName.toLowerCase();
                
                if (['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'pre'].includes(tagName)) {
                    if (currentIndex === index) {
                        return { node: current, offset: 0 };
                    }
                    currentIndex++;
                }

                // Check children
                for (const child of current.childNodes) {
                    const result = this._findIndexInTree(child, index, currentIndex);
                    if (result.found) {
                        return { node: result.node, offset: result.offset };
                    }
                    currentIndex = result.nextIndex;
                }
            }

            current = current.nextSibling;
        }

        // If index is at the end, return last position
        return { node: this.editor, offset: this.editor.childNodes.length };
    }

    /**
     * Find index in DOM tree
     */
    _findIndexInTree(node, targetIndex, currentIndex) {
        if (node.nodeType === Node.TEXT_NODE) {
            const textLength = node.textContent.length;
            if (currentIndex <= targetIndex && targetIndex < currentIndex + textLength) {
                return { found: true, node, offset: targetIndex - currentIndex };
            }
            return { found: false, nextIndex: currentIndex + textLength };
        }

        if (node.nodeType === Node.ELEMENT_NODE) {
            const tagName = node.tagName.toLowerCase();
            let nextIndex = currentIndex;

            if (['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'pre'].includes(tagName)) {
                if (nextIndex === targetIndex) {
                    return { found: true, node, offset: 0 };
                }
                nextIndex++;
            }

            for (const child of node.childNodes) {
                const result = this._findIndexInTree(child, targetIndex, nextIndex);
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
     * Clean up resources
     */
    destroy() {
        this.editor = null;
        this.contentModel = null;
        this.selectionManager = null;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DOMRenderer;
}
