/**
 * Formatting Engine for z-edit Editor
 * Handles text and block formatting without using document.execCommand
 */

class FormattingEngine {
    constructor(contentModel, selectionManager) {
        this.contentModel = contentModel;
        this.selectionManager = selectionManager;
    }

    /**
     * Apply inline formatting
     */
    applyInlineFormat(format, value = true, selection = null) {
        const { index, length } = selection || this.selectionManager.getSelection();
        
        if (length === 0) {
            // No selection, apply format to current position for future typing
            this._setCursorFormat(format, value);
        } else {
            // Apply format to selection
            const attributes = {};
            attributes[format] = value;
            this.contentModel.format(index, length, attributes);
        }
        
        return this;
    }

    /**
     * Remove inline formatting from selection
     */
    removeInlineFormat(format, selection = null) {
        const { index, length } = selection || this.selectionManager.getSelection();
        
        if (length === 0) return;
        
        const { start, end } = this.contentModel._findOps(index, length);
        
        for (let i = start; i <= end; i++) {
            if (this.contentModel.ops[i].attributes) {
                delete this.contentModel.ops[i].attributes[format];
            }
        }
        
        return this;
    }

    /**
     * Toggle inline formatting
     */
    toggleInlineFormat(format, value = true, selection = null) {
        const { index, length } = selection || this.selectionManager.getSelection();
        
        if (length === 0) {
            // Toggle cursor format
            const currentFormat = this._getCursorFormat(format);
            this._setCursorFormat(format, !currentFormat);
        } else {
            // Check if format is already applied
            const hasFormat = this._hasFormatInSelection(format, selection);
            if (hasFormat) {
                this.removeInlineFormat(format, selection);
            } else {
                this.applyInlineFormat(format, value, selection);
            }
        }
        
        return this;
    }

    /**
     * Apply bold formatting
     */
    bold(selection = null) {
        return this.toggleInlineFormat('bold', true, selection);
    }

    /**
     * Apply italic formatting
     */
    italic(selection = null) {
        return this.toggleInlineFormat('italic', true, selection);
    }

    /**
     * Apply underline formatting
     */
    underline(selection = null) {
        return this.toggleInlineFormat('underline', true, selection);
    }

    /**
     * Apply strikethrough formatting
     */
    strikethrough(selection = null) {
        return this.toggleInlineFormat('strikethrough', true, selection);
    }

    /**
     * Apply inline code formatting
     */
    code(selection = null) {
        return this.toggleInlineFormat('code', true, selection);
    }

    /**
     * Apply link formatting
     */
    link(url, selection = null) {
        if (!url) {
            this.removeInlineFormat('link', selection);
        } else {
            this.applyInlineFormat('link', url, selection);
        }
        return this;
    }

    /**
     * Apply block formatting
     */
    applyBlockFormat(blockType, selection = null) {
        const { index } = selection || this.selectionManager.getSelection();
        let currentPos = 0;
        
        // Find the first newline at or after the selection index
        for (const op of this.contentModel.ops) {
            const opLength = typeof op.insert === 'string' ? op.insert.length : 1;
            if (currentPos >= index && op.insert === '\n') {
                if (!op.attributes) {
                    op.attributes = {};
                }
                // Clear list attribute when applying a block type
                delete op.attributes.list;
                op.attributes.block = blockType;
                break;
            }
            currentPos += opLength;
        }
        
        return this;
    }

    /**
     * Apply heading formatting
     */
    heading(level, selection = null) {
        const headingType = `h${level}`;
        return this.applyBlockFormat(headingType, selection);
    }

    /**
     * Apply paragraph formatting
     */
    paragraph(selection = null) {
        return this.applyBlockFormat('p', selection);
    }

    /**
     * Apply blockquote formatting
     */
    blockquote(selection = null) {
        return this.applyBlockFormat('blockquote', selection);
    }

    /**
     * Apply code block formatting
     */
    codeBlock(selection = null) {
        return this.applyBlockFormat('pre', selection);
    }

    /**
     * Create unordered list
     */
    unorderedList(selection = null) {
        const { index } = selection || this.selectionManager.getSelection();
        let currentPos = 0;
        let found = false;
        
        for (const op of this.contentModel.ops) {
            const opLength = typeof op.insert === 'string' ? op.insert.length : 1;
            if (currentPos >= index && op.insert === '\n') {
                if (!op.attributes) {
                    op.attributes = {};
                }
                op.attributes.list = 'ul';
                delete op.attributes.block;
                found = true;
                break;
            }
            currentPos += opLength;
        }
        
        return this;
    }

    /**
     * Create ordered list
     */
    orderedList(selection = null) {
        const { index } = selection || this.selectionManager.getSelection();
        let currentPos = 0;
        
        for (const op of this.contentModel.ops) {
            const opLength = typeof op.insert === 'string' ? op.insert.length : 1;
            if (currentPos >= index && op.insert === '\n') {
                if (!op.attributes) {
                    op.attributes = {};
                }
                op.attributes.list = 'ol';
                delete op.attributes.block;
                break;
            }
            currentPos += opLength;
        }
        
        return this;
    }

    /**
     * Remove list formatting
     */
    removeList(selection = null) {
        const { index } = selection || this.selectionManager.getSelection();
        let currentPos = 0;
        
        for (const op of this.contentModel.ops) {
            const opLength = typeof op.insert === 'string' ? op.insert.length : 1;
            if (currentPos >= index && op.insert === '\n') {
                if (!op.attributes) {
                    op.attributes = {};
                }
                delete op.attributes.list;
                op.attributes.block = 'p';
                break;
            }
            currentPos += opLength;
        }
        
        return this;
    }

    /**
     * Indent list item
     */
    indent(selection = null) {
        const { index } = selection || this.selectionManager.getSelection();
        let currentPos = 0;
        
        for (const op of this.contentModel.ops) {
            const opLength = typeof op.insert === 'string' ? op.insert.length : 1;
            if (currentPos >= index && op.insert === '\n') {
                if (!op.attributes) {
                    op.attributes = {};
                }
                const currentIndent = op.attributes.indent || 0;
                op.attributes.indent = currentIndent + 1;
                break;
            }
            currentPos += opLength;
        }
        
        return this;
    }

    /**
     * Outdent list item
     */
    outdent(selection = null) {
        const { index } = selection || this.selectionManager.getSelection();
        let currentPos = 0;
        
        for (const op of this.contentModel.ops) {
            const opLength = typeof op.insert === 'string' ? op.insert.length : 1;
            if (currentPos >= index && op.insert === '\n') {
                if (!op.attributes) {
                    op.attributes = {};
                }
                const currentIndent = op.attributes.indent || 0;
                if (currentIndent > 0) {
                    op.attributes.indent = currentIndent - 1;
                }
                break;
            }
            currentPos += opLength;
        }
        
        return this;
    }

    /**
     * Insert image
     */
    insertImage(src, alt = '') {
        const { index } = this.selectionManager.getSelection();
        const attributes = { image: src, alt };
        this.contentModel.insert(index, '', attributes);
        return this;
    }

    /**
     * Clear all formatting from selection
     */
    clearFormatting(selection = null) {
        const { index, length } = selection || this.selectionManager.getSelection();
        
        if (length === 0) return;
        
        const { start, end } = this.contentModel._findOps(index, length);
        
        for (let i = start; i <= end; i++) {
            if (this.contentModel.ops[i]) {
                this.contentModel.ops[i].attributes = {};
            }
        }
        
        return this;
    }

    /**
     * Get current formatting at cursor
     */
    getCurrentFormatting() {
        const { index } = this.selectionManager.getSelection();
        const op = this.contentModel.getOpAt(index);
        
        if (op && op.op.attributes) {
            return { ...op.op.attributes };
        }
        
        return {};
    }

    /**
     * Check if format is active at cursor
     */
    isFormatActive(format) {
        const formatting = this.getCurrentFormatting();
        return !!formatting[format];
    }

    /**
     * Check if format is applied in selection
     */
    _hasFormatInSelection(format, selection = null) {
        const { index, length } = selection || this.selectionManager.getSelection();
        const { start, end } = this.contentModel._findOps(index, length);
        
        for (let i = start; i <= end; i++) {
            if (this.contentModel.ops[i] && this.contentModel.ops[i].attributes && this.contentModel.ops[i].attributes[format]) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Set cursor format for future typing
     */
    _setCursorFormat(format, value) {
        // This would be implemented with a cursor format tracker
        // For now, we'll store it in a temporary state
        if (!this.cursorFormat) {
            this.cursorFormat = {};
        }
        this.cursorFormat[format] = value;
    }

    /**
     * Get cursor format
     */
    _getCursorFormat(format) {
        if (this.cursorFormat && this.cursorFormat[format] !== undefined) {
            return this.cursorFormat[format];
        }
        return this.isFormatActive(format);
    }

    /**
     * Get cursor format state
     */
    getCursorFormat() {
        return this.cursorFormat || {};
    }

    /**
     * Clear cursor format
     */
    clearCursorFormat() {
        this.cursorFormat = {};
    }

    /**
     * Apply text alignment
     */
    alignText(alignment, selection = null) {
        const { index } = selection || this.selectionManager.getSelection();
        let currentPos = 0;
        
        for (const op of this.contentModel.ops) {
            const opLength = typeof op.insert === 'string' ? op.insert.length : 1;
            if (currentPos >= index && op.insert === '\n') {
                if (!op.attributes) {
                    op.attributes = {};
                }
                op.attributes.align = alignment;
                break;
            }
            currentPos += opLength;
        }
        
        return this;
    }

    /**
     * Get text alignment of current block
     */
    getTextAlignment() {
        const block = this.selectionManager.getCurrentBlock();
        const { start, end } = this.contentModel._findOps(block.start, block.length);
        
        for (let i = start; i <= end; i++) {
            if (this.contentModel.ops[i].insert === '\n' && this.contentModel.ops[i].attributes) {
                return this.contentModel.ops[i].attributes.align || 'left';
            }
        }
        
        return 'left';
    }

    /**
     * Apply font size
     */
    fontSize(size) {
        const { index, length } = this.selectionManager.getSelection();
        const attributes = { size };
        this.contentModel.format(index, length, attributes);
        return this;
    }

    /**
     * Apply font family
     */
    fontFamily(family) {
        const { index, length } = this.selectionManager.getSelection();
        const attributes = { font: family };
        this.contentModel.format(index, length, attributes);
        return this;
    }

    /**
     * Apply text color
     */
    textColor(color) {
        const { index, length } = this.selectionManager.getSelection();
        const attributes = { color };
        this.contentModel.format(index, length, attributes);
        return this;
    }

    /**
     * Apply background color
     */
    backgroundColor(color) {
        const { index, length } = this.selectionManager.getSelection();
        const attributes = { background: color };
        this.contentModel.format(index, length, attributes);
        return this;
    }

    /**
     * Clean up resources
     */
    destroy() {
        this.contentModel = null;
        this.selectionManager = null;
        this.cursorFormat = null;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = FormattingEngine;
}
