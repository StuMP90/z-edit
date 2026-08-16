/**
 * Content Model for z-edit Editor
 * A Delta-like format for representing rich text content
 */

class ContentModel {
    constructor() {
        this.ops = [];
    }

    /**
     * Initialize with plain text
     */
    fromText(text) {
        this.ops = text ? [{ insert: text }] : [];
        return this;
    }

    /**
     * Initialize from HTML
     */
    fromHTML(html) {
        this.ops = this._parseHTML(html);
        return this;
    }

    /**
     * Convert to HTML
     */
    toHTML() {
        return this._renderOps();
    }

    /**
     * Insert text at position
     */
    insert(index, text, attributes = {}) {
        const newOp = { insert: text, attributes };
        this._spliceOps(index, 0, [newOp]);
        return this;
    }

    /**
     * Delete content at position
     */
    delete(index, length) {
        this._spliceOps(index, length, []);
        return this;
    }

    /**
     * Format text at position
     */
    format(index, length, attributes) {
        if (length <= 0) return this;
        
        const endIndex = index + length;
        let currentPos = 0;
        let startOp = -1;
        let endOp = -1;
        let startOffset = 0;
        let endOffset = 0;
        
        for (let i = 0; i < this.ops.length; i++) {
            const op = this.ops[i];
            const opLength = typeof op.insert === 'string' ? op.insert.length : 1;
            
            if (startOp === -1 && currentPos <= index && index < currentPos + opLength) {
                startOp = i;
                startOffset = index - currentPos;
            }
            if (currentPos < endIndex && endIndex <= currentPos + opLength) {
                endOp = i;
                endOffset = endIndex - currentPos;
                break;
            }
            currentPos += opLength;
        }
        
        // No valid range found
        if (startOp === -1 || endOp === -1) {
            return this;
        }
        
        // Split the start operation if needed
        if (typeof this.ops[startOp].insert === 'string' && startOffset > 0) {
            const before = this.ops[startOp].insert.substring(0, startOffset);
            const after = this.ops[startOp].insert.substring(startOffset);
            const attrs = this.ops[startOp].attributes || null;
            this.ops.splice(startOp, 1, 
                { insert: before, attributes: attrs },
                { insert: after, attributes: attrs ? { ...attrs } : null }
            );
            startOp++;
            endOp++;
            endOffset -= startOffset;
        }
        
        // Split the end operation if needed
        const endOpData = this.ops[endOp];
        if (typeof endOpData.insert === 'string' && endOffset < endOpData.insert.length) {
            const before = endOpData.insert.substring(0, endOffset);
            const after = endOpData.insert.substring(endOffset);
            const attrs = endOpData.attributes || null;
            this.ops.splice(endOp, 1,
                { insert: before, attributes: attrs ? { ...attrs } : null },
                { insert: after, attributes: attrs ? { ...attrs } : null }
            );
            // endOp stays the same (first part)
        }
        
        // Apply attributes to all operations in the selected range
        for (let i = startOp; i <= endOp; i++) {
            if (this.ops[i]) {
                if (!this.ops[i].attributes) {
                    this.ops[i].attributes = {};
                }
                Object.assign(this.ops[i].attributes, attributes);
            }
        }
        
        return this;
    }

    /**
     * Get length of content
     */
    length() {
        return this.ops.reduce((total, op) => total + (typeof op.insert === 'string' ? op.insert.length : 1), 0);
    }

    /**
     * Get plain text content
     */
    getText() {
        return this.ops.map(op => typeof op.insert === 'string' ? op.insert : '\uFFFC').join('');
    }

    /**
     * Get operation at index
     */
    getOpAt(index) {
        let currentPos = 0;
        for (const op of this.ops) {
            const opLength = typeof op.insert === 'string' ? op.insert.length : 1;
            if (currentPos <= index && index < currentPos + opLength) {
                return { op, offset: index - currentPos };
            }
            currentPos += opLength;
        }
        return null;
    }

    /**
     * Find operations covering a range
     */
    _findOps(index, length) {
        let currentPos = 0;
        let start = -1;
        let end = -1;
        const endIndex = index + length;

        // Handle empty ops
        if (this.ops.length === 0) {
            return { start: 0, end: -1 };
        }

        for (let i = 0; i < this.ops.length; i++) {
            const op = this.ops[i];
            const opLength = typeof op.insert === 'string' ? op.insert.length : 1;

            if (start === -1 && currentPos + opLength > index) {
                start = i;
            }
            if (currentPos >= endIndex) {
                end = i - 1;
                break;
            }
            currentPos += opLength;
        }

        if (end === -1) {
            end = this.ops.length - 1;
        }

        // Ensure start is valid
        if (start === -1) {
            start = 0;
        }

        return { start, end };
    }

    /**
     * Splice operations at position
     */
    _spliceOps(index, deleteLength, newOps) {
        if (this.ops.length === 0) {
            this.ops = newOps;
            return;
        }

        // Find the operation at the insertion point
        let currentPos = 0;
        let insertIndex = -1;
        let insertOffset = 0;

        for (let i = 0; i < this.ops.length; i++) {
            const op = this.ops[i];
            const opLength = typeof op.insert === 'string' ? op.insert.length : 1;

            if (currentPos <= index && index < currentPos + opLength) {
                insertIndex = i;
                insertOffset = index - currentPos;
                break;
            }

            currentPos += opLength;
        }

        // If inserting at the end
        if (insertIndex === -1) {
            // Don't merge if inserting a newline
            const isNewOpNewline = newOps.length === 1 && typeof newOps[0].insert === 'string' && newOps[0].insert === '\n';
            
            if (isNewOpNewline) {
                this.ops.push(...newOps);
                return;
            }
            
            // Merge with last operation if attributes match
            const lastOp = this.ops[this.ops.length - 1];
            const isLastNewline = lastOp && typeof lastOp.insert === 'string' && lastOp.insert === '\n';
            
            if (lastOp && newOps.length === 1 && 
                typeof lastOp.insert === 'string' && 
                typeof newOps[0].insert === 'string' &&
                !isLastNewline &&
                this._attributesEqual(lastOp.attributes, newOps[0].attributes)) {
                lastOp.insert += newOps[0].insert;
            } else {
                this.ops.push(...newOps);
            }
            return;
        }

        // Handle deletion only case
        if (deleteLength > 0 && newOps.length === 0) {
            const targetOp = this.ops[insertIndex];
            if (typeof targetOp.insert === 'string') {
                // Delete within a single operation
                const before = targetOp.insert.substring(0, insertOffset);
                const after = targetOp.insert.substring(insertOffset + deleteLength);
                const newOp = { insert: before + after, attributes: targetOp.attributes };
                
                const newOpsArray = [];
                for (let i = 0; i < insertIndex; i++) {
                    newOpsArray.push(this.ops[i]);
                }
                if (newOp.insert.length > 0) {
                    newOpsArray.push(newOp);
                }
                for (let i = insertIndex + 1; i < this.ops.length; i++) {
                    newOpsArray.push(this.ops[i]);
                }
                this.ops = newOpsArray;
                return;
            }
        }

        // Split the operation at the insertion point
        const targetOp = this.ops[insertIndex];
        const beforeSplit = [];
        const afterSplit = [];

        if (typeof targetOp.insert === 'string') {
            // If inserting at the exact end of the operation and no deletion
            if (insertOffset === targetOp.insert.length && deleteLength === 0) {
                // Don't merge if inserting a newline
                const isNewOpNewline = newOps.length === 1 && typeof newOps[0].insert === 'string' && newOps[0].insert === '\n';
                
                if (!isNewOpNewline && newOps.length === 1 && typeof newOps[0].insert === 'string' &&
                    this._attributesEqual(targetOp.attributes, newOps[0].attributes)) {
                    targetOp.insert += newOps[0].insert;
                    return;
                }
                // Otherwise, split normally
                beforeSplit.push({
                    insert: targetOp.insert,
                    attributes: targetOp.attributes ? { ...targetOp.attributes } : {}
                });
            } else {
                if (insertOffset > 0) {
                    beforeSplit.push({
                        insert: targetOp.insert.substring(0, insertOffset),
                        attributes: targetOp.attributes ? { ...targetOp.attributes } : {}
                    });
                }
                if (insertOffset < targetOp.insert.length) {
                    afterSplit.push({
                        insert: targetOp.insert.substring(insertOffset),
                        attributes: targetOp.attributes ? { ...targetOp.attributes } : {}
                    });
                }
            }
        } else {
            // For non-string operations (images, etc.), we can't split
            if (insertOffset === 0) {
                afterSplit.push({ ...targetOp });
            } else {
                beforeSplit.push({ ...targetOp });
            }
        }

        // Handle deletion
        if (deleteLength > 0) {
            let deleteEnd = index + deleteLength;
            let deleteCurrentPos = index;
            let deleteIndex = insertIndex + 1; // Start from the next operation after the split

            // Remove content from the split operation (afterSplit)
            if (afterSplit.length > 0) {
                const afterOp = afterSplit[0];
                if (typeof afterOp.insert === 'string') {
                    const deleteFromAfter = deleteEnd - deleteCurrentPos;
                    if (deleteFromAfter >= afterOp.insert.length) {
                        // Delete entire afterSplit
                        afterSplit.length = 0;
                        deleteCurrentPos += afterOp.insert.length;
                    } else {
                        // Partial deletion from afterSplit
                        afterOp.insert = afterOp.insert.substring(deleteFromAfter);
                        deleteCurrentPos = deleteEnd;
                    }
                } else {
                    if (deleteEnd - deleteCurrentPos >= 1) {
                        afterSplit.length = 0;
                        deleteCurrentPos += 1;
                    }
                }
            }

            // Remove complete operations starting from deleteIndex
            while (deleteCurrentPos < deleteEnd && deleteIndex < this.ops.length) {
                const op = this.ops[deleteIndex];
                const opLength = typeof op.insert === 'string' ? op.insert.length : 1;

                if (deleteCurrentPos + opLength <= deleteEnd) {
                    deleteIndex++;
                    deleteCurrentPos += opLength;
                } else {
                    // Partial removal of this operation
                    if (typeof op.insert === 'string') {
                        const remaining = deleteEnd - deleteCurrentPos;
                        op.insert = op.insert.substring(remaining);
                    }
                    break;
                }
            }

            // Rebuild the ops array - skip the deleted operations
            const newOpsArray = [];
            // Add operations before the split point (but not the operation being split)
            for (let i = 0; i < insertIndex; i++) {
                newOpsArray.push(this.ops[i]);
            }
            // Add the before split (content before deletion)
            newOpsArray.push(...beforeSplit);
            // Add the remaining after split (if any)
            newOpsArray.push(...afterSplit);
            // Add operations after the deleted range
            for (let i = deleteIndex; i < this.ops.length; i++) {
                newOpsArray.push(this.ops[i]);
            }

            this.ops = newOpsArray;
        } else {
            // Just insert without deletion
            const newOpsArray = [];
            for (let i = 0; i < insertIndex; i++) {
                newOpsArray.push(this.ops[i]);
            }
            newOpsArray.push(...beforeSplit);
            newOpsArray.push(...newOps);
            newOpsArray.push(...afterSplit);
            for (let i = insertIndex + 1; i < this.ops.length; i++) {
                newOpsArray.push(this.ops[i]);
            }

            this.ops = newOpsArray;
        }

        // Merge adjacent operations with same attributes
        this._mergeAdjacentOps();
    }

    /**
     * Merge adjacent operations with same attributes
     */
    _mergeAdjacentOps() {
        if (this.ops.length < 2) return;

        const merged = [];
        for (let i = 0; i < this.ops.length; i++) {
            const current = this.ops[i];
            
            // Skip empty operations
            if (typeof current.insert === 'string' && current.insert.length === 0) {
                continue;
            }
            
            const last = merged[merged.length - 1];

            // Don't merge newlines with text or vice versa
            const isLastNewline = typeof last.insert === 'string' && last.insert === '\n';
            const isCurrentNewline = typeof current.insert === 'string' && current.insert === '\n';
            
            if (last && 
                typeof last.insert === 'string' && 
                typeof current.insert === 'string' &&
                !isLastNewline && !isCurrentNewline &&
                this._attributesEqual(last.attributes, current.attributes)) {
                // Merge with previous operation
                last.insert += current.insert;
            } else {
                merged.push(current);
            }
        }

        this.ops = merged;
    }

    /**
     * Check if two attribute objects are equal
     */
    _attributesEqual(attrs1, attrs2) {
        // Handle null/undefined
        if (attrs1 === null || attrs1 === undefined) attrs1 = {};
        if (attrs2 === null || attrs2 === undefined) attrs2 = {};
        
        const keys1 = Object.keys(attrs1);
        const keys2 = Object.keys(attrs2);
        
        if (keys1.length !== keys2.length) return false;
        
        for (const key of keys1) {
            if (attrs1[key] !== attrs2[key]) return false;
        }
        
        return true;
    }

    /**
     * Parse HTML to operations
     */
    _parseHTML(html) {
        const ops = [];
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        this._parseNode(doc.body, ops, {});
        
        return ops;
    }

    /**
     * Recursively parse DOM node
     */
    _parseNode(node, ops, attributes) {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent;
            if (text) {
                ops.push({ insert: text, attributes: { ...attributes } });
            }
            return;
        }

        if (node.nodeType === Node.ELEMENT_NODE) {
            const tagName = node.tagName.toLowerCase();
            const newAttributes = this._getElementAttributes(node, attributes);

            // Handle block elements
            if (['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre'].includes(tagName)) {
                if (ops.length > 0 && ops[ops.length - 1].insert !== '\n') {
                    ops.push({ insert: '\n' });
                }
                
                for (const child of node.childNodes) {
                    this._parseNode(child, ops, newAttributes);
                }
                
                ops.push({ insert: '\n', attributes: { ...newAttributes, block: tagName } });
                return;
            }

            // Handle lists
            if (tagName === 'ul' || tagName === 'ol') {
                for (const child of node.childNodes) {
                    if (child.nodeType === Node.ELEMENT_NODE && child.tagName.toLowerCase() === 'li') {
                        this._parseNode(child, ops, { ...newAttributes, list: tagName });
                    }
                }
                return;
            }

            // Handle list items
            if (tagName === 'li') {
                for (const child of node.childNodes) {
                    this._parseNode(child, ops, attributes);
                }
                ops.push({ insert: '\n', attributes });
                return;
            }

            // Handle inline elements
            for (const child of node.childNodes) {
                this._parseNode(child, ops, newAttributes);
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

        // Block alignment and indent
        const align = node.getAttribute('align');
        if (align) attributes.align = align;
        const indent = node.getAttribute('data-indent');
        if (indent !== null) attributes.indent = parseInt(indent, 10);

        return attributes;
    }

    /**
     * Render operations to HTML
     */
    _renderOps() {
        let html = '';
        let currentBlock = 'p';
        let currentAttributes = {};
        let blockOpen = false;

        for (const op of this.ops) {
            if (op.insert === '\n') {
                if (blockOpen) {
                    html += this._closeBlock(currentBlock, currentAttributes);
                    blockOpen = false;
                }
                currentBlock = op.attributes?.block || 'p';
                currentAttributes = op.attributes || {};
                continue;
            }

            if (op.attributes?.image) {
                if (!blockOpen) {
                    html += this._openBlock(currentBlock, currentAttributes);
                    blockOpen = true;
                }
                html += `<img src="${this._escapeHTML(op.attributes.image)}" alt="${this._escapeHTML(op.attributes.alt || '')}">`;
                continue;
            }

            const trimmed = op.insert.trim();
            if (trimmed.length === 0 && !blockOpen) {
                // Skip leading whitespace text, but still close if needed
                continue;
            }

            if (!blockOpen) {
                html += this._openBlock(currentBlock, currentAttributes);
                blockOpen = true;
            }

            const text = this._escapeHTML(op.insert);
            const formatted = this._applyInlineFormatting(text, op.attributes);
            html += formatted;
        }

        if (blockOpen) {
            html += this._closeBlock(currentBlock, currentAttributes);
        }
        return html;
    }

    /**
     * Open block element
     */
    _openBlock(tag, attributes) {
        if (tag === 'p') return '<p>';
        if (tag === 'h1') return '<h1>';
        if (tag === 'h2') return '<h2>';
        if (tag === 'h3') return '<h3>';
        if (tag === 'blockquote') return '<blockquote>';
        if (tag === 'pre') return '<pre><code>';
        if (attributes?.list === 'ul') return '<ul><li>';
        if (attributes?.list === 'ol') return '<ol><li>';
        return '<p>';
    }

    /**
     * Close block element
     */
    _closeBlock(tag, attributes) {
        if (tag === 'p') return '</p>';
        if (tag === 'h1') return '</h1>';
        if (tag === 'h2') return '</h2>';
        if (tag === 'h3') return '</h3>';
        if (tag === 'blockquote') return '</blockquote>';
        if (tag === 'pre') return '</code></pre>';
        if (attributes?.list === 'ul') return '</li></ul>';
        if (attributes?.list === 'ol') return '</li></ol>';
        return '</p>';
    }

    /**
     * Apply inline formatting to text
     */
    _applyInlineFormatting(text, attributes) {
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
     * Escape HTML entities
     */
    _escapeHTML(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Clone the content model
     */
    clone() {
        const clone = new ContentModel();
        clone.ops = JSON.parse(JSON.stringify(this.ops));
        return clone;
    }

    /**
     * Get operations as JSON
     */
    toJSON() {
        return JSON.stringify(this.ops);
    }

    /**
     * Load operations from JSON
     */
    fromJSON(json) {
        this.ops = JSON.parse(json);
        return this;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ContentModel;
}
