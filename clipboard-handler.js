/**
 * Clipboard Handler for z-edit Editor
 * Handles copy, cut, and paste operations with custom content processing
 */

class ClipboardHandler {
    constructor(editorElement, contentModel, selectionManager, domRenderer) {
        this.editor = editorElement;
        this.contentModel = contentModel;
        this.selectionManager = selectionManager;
        this.domRenderer = domRenderer;
        this.onPaste = null;
        
        this._setupEventListeners();
    }

    /**
     * Set paste callback
     */
    setOnPaste(callback) {
        this.onPaste = callback;
    }

    /**
     * Setup event listeners
     */
    _setupEventListeners() {
        this.editor.addEventListener('copy', this._handleCopy.bind(this));
        this.editor.addEventListener('cut', this._handleCut.bind(this));
        this.editor.addEventListener('paste', this._handlePaste.bind(this));
    }

    /**
     * Handle copy operation
     */
    _handleCopy(e) {
        const { index, length } = this.selectionManager.getSelection();
        
        if (length === 0) return;
        
        // Extract selected content from content model
        const selectedContent = this._extractContent(index, length);
        
        // Create clipboard data
        const clipboardData = e.clipboardData;
        if (clipboardData) {
            // Set as HTML
            const html = this._contentToHTML(selectedContent);
            clipboardData.setData('text/html', html);
            
            // Set as plain text
            const text = this._contentToText(selectedContent);
            clipboardData.setData('text/plain', text);
            
            // Set as custom format (for internal use)
            const customData = JSON.stringify(selectedContent);
            clipboardData.setData('application/x-z-edit', customData);
        }
        
        e.preventDefault();
    }

    /**
     * Handle cut operation
     */
    _handleCut(e) {
        this._handleCopy(e);
        
        // Delete the selected content after copying
        const { index, length } = this.selectionManager.getSelection();
        if (length > 0) {
            this.contentModel.delete(index, length);
            this.selectionManager.setSelection(index);
        }
    }

    /**
     * Handle paste operation
     */
    _handlePaste(e) {
        // Let the browser handle paste normally
        // We'll sync from DOM after the paste is processed
        // This is more reliable than manual paste handling
        
        // Sync from DOM after a short delay to let browser process paste
        setTimeout(() => {
            if (this.domRenderer) {
                this.domRenderer.syncFromDOM();
            }
            if (this.onPaste) {
                this.onPaste(this.editor.innerHTML);
            }
        }, 0);
    }

    /**
     * Extract content from content model
     */
    _extractContent(index, length) {
        const { start, end } = this.contentModel._findOps(index, length);
        const extracted = [];
        
        for (let i = start; i <= end; i++) {
            const op = this.contentModel.ops[i];
            extracted.push({ ...op });
        }
        
        return extracted;
    }

    /**
     * Convert content to HTML
     */
    _contentToHTML(content) {
        let html = '';
        
        for (const op of content) {
            if (op.insert === '\n') {
                const block = op.attributes?.block || 'p';
                const list = op.attributes?.list;
                
                if (list === 'ul') {
                    html += '</li></ul>';
                } else if (list === 'ol') {
                    html += '</li></ol>';
                } else {
                    html += `</${block}>`;
                }
            } else if (op.attributes?.image) {
                html += `<img src="${this._escapeHTML(op.attributes.image)}" alt="${this._escapeHTML(op.attributes.alt || '')}">`;
            } else {
                const text = this._escapeHTML(op.insert);
                const formatted = this._applyFormatting(text, op.attributes);
                html += formatted;
            }
        }
        
        return html;
    }

    /**
     * Convert content to plain text
     */
    _contentToText(content) {
        let text = '';
        
        for (const op of content) {
            if (op.insert === '\n') {
                text += '\n';
            } else if (op.attributes?.image) {
                text += `[Image: ${op.attributes.alt || 'image'}]`;
            } else {
                text += op.insert;
            }
        }
        
        return text;
    }

    /**
     * Convert HTML to content
     */
    _htmlToContent(html) {
        const content = [];
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        this._parseNode(doc.body, content, {});
        
        return content;
    }

    /**
     * Parse DOM node to content
     */
    _parseNode(node, content, attributes) {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent;
            if (text) {
                content.push({ insert: text, attributes: { ...attributes } });
            }
            return;
        }

        if (node.nodeType === Node.ELEMENT_NODE) {
            const tagName = node.tagName.toLowerCase();
            const newAttributes = this._getElementAttributes(node, attributes);

            // Handle block elements
            if (['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre'].includes(tagName)) {
                for (const child of node.childNodes) {
                    this._parseNode(child, content, newAttributes);
                }
                content.push({ insert: '\n', attributes: { ...newAttributes, block: tagName } });
                return;
            }

            // Handle lists
            if (tagName === 'ul' || tagName === 'ol') {
                for (const child of node.childNodes) {
                    if (child.tagName === 'li') {
                        this._parseNode(child, content, { ...newAttributes, list: tagName });
                    }
                }
                return;
            }

            // Handle list items
            if (tagName === 'li') {
                for (const child of node.childNodes) {
                    this._parseNode(child, content, attributes);
                }
                content.push({ insert: '\n' });
                return;
            }

            // Handle inline elements
            for (const child of node.childNodes) {
                this._parseNode(child, content, newAttributes);
            }
        }
    }

    /**
     * Get attributes from DOM element
     */
    _getElementAttributes(node, baseAttributes) {
        const attributes = { ...baseAttributes };
        const tagName = node.tagName.toLowerCase();

        // Text formatting
        if (tagName === 'strong' || tagName === 'b') attributes.bold = true;
        if (tagName === 'em' || tagName === 'i') attributes.italic = true;
        if (tagName === 'u') attributes.underline = true;
        if (tagName === 's' || tagName === 'strike') attributes.strikethrough = true;
        if (tagName === 'code') attributes.code = true;

        // Links
        if (tagName === 'a') {
            attributes.link = node.getAttribute('href');
        }

        // Images
        if (tagName === 'img') {
            attributes.image = node.getAttribute('src');
            attributes.alt = node.getAttribute('alt') || '';
        }

        return attributes;
    }

    /**
     * Apply formatting to text
     */
    _applyFormatting(text, attributes) {
        if (!attributes) return text;

        let formatted = text;

        if (attributes.link) {
            formatted = `<a href="${this._escapeHTML(attributes.link)}">${formatted}</a>`;
        }
        if (attributes.bold) {
            formatted = `<strong>${formatted}</strong>`;
        }
        if (attributes.italic) {
            formatted = `<em>${formatted}</em>`;
        }
        if (attributes.underline) {
            formatted = `<u>${formatted}</u>`;
        }
        if (attributes.strikethrough) {
            formatted = `<s>${formatted}</s>`;
        }
        if (attributes.code) {
            formatted = `<code>${formatted}</code>`;
        }

        return formatted;
    }

    /**
     * Insert content at cursor
     */
    _insertContent(content) {
        const { index, length } = this.selectionManager.getSelection();
        
        // Delete selected content first
        if (length > 0) {
            this.contentModel.delete(index, length);
        }
        
        // Insert the content
        for (const op of content) {
            this.contentModel.insert(index, op.insert, op.attributes);
        }
        
        // Move cursor after inserted content
        const contentLength = content.reduce((total, op) => {
            return total + (typeof op.insert === 'string' ? op.insert.length : 1);
        }, 0);
        
        this.selectionManager.setSelection(index + contentLength);
        
        // Trigger callback
        if (this.onPaste) {
            this.onPaste(this.contentModel.toHTML());
        }
    }

    /**
     * Insert plain text
     */
    _insertPlainText(text) {
        const { index, length } = this.selectionManager.getSelection();
        
        // Delete selected content first
        if (length > 0) {
            this.contentModel.delete(index, length);
        }
        
        // Check if text contains newlines for code block formatting
        if (text.includes('\n')) {
            // Insert as code block
            const attributes = { block: 'pre' };
            this.contentModel.insert(index, text, attributes);
        } else {
            // Insert as plain text
            this.contentModel.insert(index, text);
        }
        
        // Move cursor after inserted text
        this.selectionManager.setSelection(index + text.length);
        
        // Trigger callback
        if (this.onPaste) {
            this.onPaste(this.contentModel.toHTML());
        }
    }

    /**
     * Escape HTML entities
     */
    _escapeHTML(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Remove event listeners
     */
    destroy() {
        this.editor.removeEventListener('copy', this._handleCopy.bind(this));
        this.editor.removeEventListener('cut', this._handleCut.bind(this));
        this.editor.removeEventListener('paste', this._handlePaste.bind(this));
        
        this.editor = null;
        this.contentModel = null;
        this.selectionManager = null;
        this.onPaste = null;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ClipboardHandler;
}
