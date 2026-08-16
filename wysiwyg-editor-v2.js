/**
 * z-edit WYSIWYG Editor v2.0
 * Modern architecture without document.execCommand
 * 
 * Components:
 * - ContentModel: Delta-like content representation
 * - DOMRenderer: Renders content model to DOM
 * - SelectionManager: Handles cursor and selection
 * - FormattingEngine: Text and block formatting
 * - InputHandler: Keyboard and input events
 * - ClipboardHandler: Copy, cut, paste operations
 * - HistoryManager: Undo/redo functionality
 * - BrowserCompat: Cross-browser compatibility
 */

class WYSIWYGEditor {
    constructor(options = {}) {
        this.options = {
            target: options.target || null,
            placeholder: options.placeholder || 'Start typing...',
            toolbar: options.toolbar !== false,
            toolbarButtons: options.toolbarButtons || this._getDefaultToolbarButtons(),
            maxHistorySize: options.maxHistorySize || 100,
            onChange: options.onChange || null,
            onImageDrop: options.onImageDrop || null,
            imageUploadHandler: options.imageUploadHandler || null,
            customTemplates: options.customTemplates || {},
            allowFullDocument: options.allowFullDocument || false,
            ariaLabel: options.ariaLabel || 'Rich text editor',
            ariaDescribedBy: options.ariaDescribedBy || null
        };

        // Initialize browser compatibility
        this.browserCompat = new BrowserCompat();
        this.browserCompat.polyfill();

        // Initialize content model
        this.contentModel = new ContentModel();

        // Find or create target element
        this.targetElement = this._getTargetElement();
        if (!this.targetElement) {
            throw new Error('Target element not found');
        }

        // Create editor structure
        this._createEditorStructure();

        // Initialize components
        this.selectionManager = new SelectionManager(this.editor, this.contentModel);
        this.domRenderer = new DOMRenderer(this.editor);
        this.domRenderer.setContentModel(this.contentModel);
        this.domRenderer.setSelectionManager(this.selectionManager);

        this.formattingEngine = new FormattingEngine(this.contentModel, this.selectionManager);
        this.inputHandler = new InputHandler(this.editor, this.contentModel, this.selectionManager, this.formattingEngine, this.domRenderer);
        this.clipboardHandler = new ClipboardHandler(this.editor, this.contentModel, this.selectionManager, this.domRenderer);
        this.historyManager = new HistoryManager(this.contentModel, this.options.maxHistorySize);

        // Setup callbacks
        this._setupCallbacks();

        // Apply browser compatibility fixes
        this.browserCompat.normalizeContentEditable(this.editor);
        this.browserCompat.handleBrowserQuirks(this.editor);

        // Inject CSS
        this._injectStyles();

        // Initialize content
        this._initializeContent();

        // Create toolbar if enabled
        if (this.options.toolbar) {
            this._createToolbar();
        }

        // Apply initial content if provided
        if (options.content) {
            this.setHTML(options.content);
        }
    }

    /**
     * Get default toolbar buttons
     */
    _getDefaultToolbarButtons() {
        return [
            'bold', 'italic', 'underline', 'strikethrough',
            '|',
            'h1', 'h2', 'h3', 'p',
            '|',
            'ul', 'ol',
            '|',
            'code-inline', 'code-block',
            '|',
            'link', 'image',
            '|',
            'align-left', 'align-center', 'align-right',
            '|',
            'code', 'split', 'clear'
        ];
    }

    /**
     * Get target element
     */
    _getTargetElement() {
        if (!this.options.target) return null;

        if (typeof this.options.target === 'string') {
            return document.querySelector(this.options.target);
        } else if (this.options.target instanceof HTMLElement) {
            return this.options.target;
        }

        return null;
    }

    /**
     * Create editor structure
     */
    _createEditorStructure() {
        // Create container
        this.container = document.createElement('div');
        this.container.className = 'wysiwyg-container';

        // Create editor element
        this.editor = document.createElement('div');
        this.editor.className = 'wysiwyg-editor';
        this.editor.contentEditable = 'true';
        this.editor.setAttribute('role', 'textbox');
        this.editor.setAttribute('aria-multiline', 'true');
        this.editor.setAttribute('aria-label', this.options.ariaLabel);

        if (this.options.ariaDescribedBy) {
            this.editor.setAttribute('aria-describedby', this.options.ariaDescribedBy);
        }

        if (this.options.placeholder) {
            this.editor.setAttribute('data-placeholder', this.options.placeholder);
        }

        // Create code view textarea
        this.codeView = document.createElement('textarea');
        this.codeView.className = 'wysiwyg-code-view';
        this.codeView.style.display = 'none';
        this.codeView.spellcheck = false;

        // Replace target element with container
        this.targetElement.parentNode.replaceChild(this.container, this.targetElement);
        this.container.appendChild(this.editor);
        this.container.appendChild(this.codeView);

        // Store original element reference
        this.originalElement = this.targetElement;

        // Default view mode
        this.viewMode = 'editor';
    }

    /**
     * Setup callbacks
     */
    _setupCallbacks() {
        // Save selection on mouseup to capture final text selection
        this.editor.addEventListener('mouseup', () => {
            if (this.selectionManager) {
                this.selectionManager.save();
            }
        });
        
        this.inputHandler.setOnChange((html) => {
            this._handleChange(html);
        });

        this.clipboardHandler.setOnPaste((html) => {
            this._handleChange(html);
        });

        this.inputHandler.setOnKeyDown((e) => {
            // Handle keyboard shortcuts
            if (e.ctrlKey || e.metaKey) {
                switch (e.key.toLowerCase()) {
                    case 'z':
                        e.preventDefault();
                        if (e.shiftKey) {
                            this.redo();
                        } else {
                            this.undo();
                        }
                        return false;
                    case 'y':
                        e.preventDefault();
                        this.redo();
                        return false;
                }
            }
        });
    }

    /**
     * Handle content change
     */
    _handleChange(html) {
        // Save state to history
        const selection = this.selectionManager.getSelection();
        this.historyManager.save(selection);

        // Update code view if visible
        if (this.codeView) {
            this.codeView.value = html;
        }

        // Update target element
        this._updateTarget();

        // Call change callback
        if (this.options.onChange) {
            this.options.onChange(html);
        }
    }

    /**
     * Update target element
     */
    _updateTarget() {
        if (this.originalElement) {
            if (this.originalElement.tagName === 'TEXTAREA' || this.originalElement.tagName === 'INPUT') {
                this.originalElement.value = this.getHTML();
            } else {
                this.originalElement.innerHTML = this.getHTML();
            }
        }
    }

    /**
     * Initialize content
     */
    _initializeContent() {
        if (this.originalElement) {
            let initialContent = '';
            if (this.originalElement.tagName === 'TEXTAREA' || this.originalElement.tagName === 'INPUT') {
                initialContent = this.originalElement.value;
            } else {
                initialContent = this.originalElement.innerHTML;
            }

            if (initialContent) {
                this.contentModel.fromHTML(initialContent);
                this.domRenderer.render();
            }
        }
    }

    /**
     * Create toolbar
     */
    _createToolbar() {
        this.toolbar = document.createElement('div');
        this.toolbar.className = 'wysiwyg-toolbar';
        this.container.insertBefore(this.toolbar, this.editor);

        this.options.toolbarButtons.forEach(button => {
            if (button === '|') {
                this._addToolbarSeparator();
            } else {
                this._addToolbarButton(button);
            }
        });
    }

    /**
     * Add toolbar button
     */
    _addToolbarButton(button) {
        const config = this._getButtonConfig(button);
        if (!config) return;

        const buttonElement = document.createElement('button');
        buttonElement.type = 'button';
        buttonElement.className = 'wysiwyg-toolbar-button';
        buttonElement.setAttribute('data-command', button);
        buttonElement.setAttribute('title', config.title);
        buttonElement.setAttribute('aria-label', config.title);
        buttonElement.setAttribute('tabindex', '-1'); // Prevent focus stealing
        buttonElement.innerHTML = config.icon;

        buttonElement.addEventListener('mousedown', (e) => {
            e.preventDefault(); // Prevent button from taking focus
            // Capture the current selection before focus is lost
            this.selectionManager.save();
            const sel = window.getSelection();
            this.selectionManager.savedText = sel.toString();
            this.selectionManager.savedSelection = {
                index: this.selectionManager.savedIndex,
                length: this.selectionManager.savedLength || 0
            };
        });
        
        buttonElement.addEventListener('click', (e) => {
            e.preventDefault();
            this.executeCommand(button);
        });

        this.toolbar.appendChild(buttonElement);
    }

    /**
     * Add toolbar separator
     */
    _addToolbarSeparator() {
        const separator = document.createElement('span');
        separator.className = 'wysiwyg-toolbar-separator';
        this.toolbar.appendChild(separator);
    }

    /**
     * Get button configuration
     */
    _getButtonConfig(button) {
        const configs = {
            'bold': { icon: '<strong>B</strong>', title: 'Bold (Ctrl+B)' },
            'italic': { icon: '<em>I</em>', title: 'Italic (Ctrl+I)' },
            'underline': { icon: '<u>U</u>', title: 'Underline (Ctrl+U)' },
            'strikethrough': { icon: '<s>S</s>', title: 'Strikethrough' },
            'h1': { icon: 'H1', title: 'Heading 1' },
            'h2': { icon: 'H2', title: 'Heading 2' },
            'h3': { icon: 'H3', title: 'Heading 3' },
            'p': { icon: 'P', title: 'Paragraph' },
            'ul': { icon: '•', title: 'Bullet List' },
            'ol': { icon: '1.', title: 'Numbered List' },
            'indent': { icon: '→', title: 'Indent' },
            'outdent': { icon: '←', title: 'Outdent' },
            'code-inline': { icon: '&lt;/&gt;', title: 'Inline Code' },
            'code-block': { icon: '{ }', title: 'Code Block' },
            'link': { icon: '🔗', title: 'Insert Link' },
            'image': { icon: '🖼️', title: 'Insert Image' },
            'align-left': { icon: '⫷', title: 'Align Left' },
            'align-center': { icon: '≡', title: 'Align Center' },
            'align-right': { icon: '⫸', title: 'Align Right' },
            'undo': { icon: '↶', title: 'Undo (Ctrl+Z)' },
            'redo': { icon: '↷', title: 'Redo (Ctrl+Y)' },
            'code': { icon: '&lt;/&gt;', title: 'View HTML Code' },
            'split': { icon: '⇆', title: 'Split View' },
            'clear': { icon: '✕', title: 'Clear Formatting' }
        };

        return configs[button] || null;
    }

    /**
     * Execute toolbar command by directly manipulating the DOM, then sync the content model
     */
    executeCommand(command) {
        switch (command) {
            case 'bold':
                this._wrapSelection('strong');
                break;
            case 'italic':
                this._wrapSelection('em');
                break;
            case 'underline':
                this._wrapSelection('u');
                break;
            case 'strikethrough':
                this._wrapSelection('s');
                break;
            case 'code-inline':
                this._wrapSelection('code');
                break;
            case 'h1':
            case 'h2':
            case 'h3':
                this._changeBlockTag(command);
                break;
            case 'p':
                this._changeBlockTag('p');
                break;
            case 'code-block':
                this._changeBlockTag('pre');
                break;
            case 'ul':
                this._wrapBlockInList('ul');
                break;
            case 'ol':
                this._wrapBlockInList('ol');
                break;
            case 'indent':
                this._indentBlock(1);
                break;
            case 'outdent':
                this._indentBlock(-1);
                break;
            case 'align-left':
            case 'align-center':
            case 'align-right':
                this._setBlockAlign(command.replace('align-', ''));
                break;
            case 'link':
                this._insertLinkDOM();
                break;
            case 'image':
                this._insertImageDOM();
                break;
            case 'clear':
                this._clearSelection();
                break;
            case 'undo':
                this.undo();
                return;
            case 'redo':
                this.redo();
                return;
            case 'code':
                this.toggleCodeView();
                return;
            case 'split':
                this.toggleSplitView();
                return;
        }

        this.contentModel.fromHTML(this.editor.innerHTML);
        this._handleChange(this.getHTML());
        this.editor.focus();
    }

    /**
     * Insert link
     */
    insertLink(selection, url = null) {
        if (!url) {
            url = prompt('Enter URL:');
            if (!url) return;
        }
        this.formattingEngine.link(url, selection);
        this.domRenderer.render();
    }

    /**
     * Insert image
     */
    insertImage(src = null, alt = '') {
        if (!src) {
            src = prompt('Enter image URL:');
            if (!src) return;
        }
        this.formattingEngine.insertImage(src, alt);
        this.domRenderer.render();
    }

    /**
     * Undo
     */
    undo() {
        const selection = this.historyManager.undo();
        this.domRenderer.render();
        if (selection) {
            this.selectionManager.setSelection(selection.index, selection.length);
        }
        if (this.editor) this.editor.focus();
    }

    /**
     * Redo
     */
    redo() {
        const selection = this.historyManager.redo();
        this.domRenderer.render();
        if (selection) {
            this.selectionManager.setSelection(selection.index, selection.length);
        }
        if (this.editor) this.editor.focus();
    }

    /**
     * Toggle code view
     */
    toggleCodeView() {
        if (this.viewMode === 'code') {
            this.setHTML(this.codeView.value);
            this.viewMode = 'editor';
            this._updateViewMode();
            this.editor.focus();
        } else {
            this.viewMode = 'code';
            this.codeView.value = this.getHTML();
            this._updateViewMode();
            this.codeView.focus();
        }
    }

    /**
     * Toggle split view
     */
    toggleSplitView() {
        if (this.viewMode === 'split') {
            this.viewMode = 'editor';
            this._updateViewMode();
            this.editor.focus();
        } else {
            if (this.viewMode === 'code') {
                this.setHTML(this.codeView.value);
            }
            this.viewMode = 'split';
            this.codeView.value = this.getHTML();
            this._updateViewMode();
            this.editor.focus();
        }
    }

    /**
     * Update visibility of editor and code view based on view mode
     */
    _updateViewMode() {
        if (this.viewMode === 'editor') {
            this.editor.style.display = 'block';
            this.codeView.style.display = 'none';
            this.codeView.readOnly = false;
        } else if (this.viewMode === 'code') {
            this.editor.style.display = 'none';
            this.codeView.style.display = 'block';
            this.codeView.readOnly = false;
            this.codeView.style.marginTop = '';
        } else if (this.viewMode === 'split') {
            this.editor.style.display = 'block';
            this.codeView.style.display = 'block';
            this.codeView.readOnly = true;
            this.codeView.style.marginTop = '8px';
        }
    }

    /**
     * Get HTML content
     */
    getHTML() {
        return this.contentModel.toHTML();
    }

    /**
     * Set HTML content
     */
    setHTML(html) {
        // Change content first
        this.contentModel.fromHTML(html);
        // Save state after changing
        this.historyManager.save();
        this.domRenderer.render();
        this._updateTarget();
    }

    /**
     * Get plain text content
     */
    getText() {
        return this.contentModel.ops
            .filter(op => typeof op.insert === 'string')
            .map(op => op.insert)
            .join('');
    }

    /**
     * Set plain text content
     */
    setText(text) {
        this.contentModel.fromText(text);
        this.domRenderer.render();
        this._updateTarget();
    }

    /**
     * Insert HTML at cursor
     */
    insertHTML(html) {
        const { index } = this.selectionManager.getSelection();
        this.contentModel.fromHTML(html);
        this.domRenderer.render();
        this._handleChange(this.getHTML());
    }

    /**
     * Insert custom template
     */
    insertTemplate(templateName) {
        const template = this.options.customTemplates[templateName];
        if (template) {
            this.insertHTML(template);
        }
    }

    /**
     * Focus editor
     */
    focus() {
        this.editor.focus();
    }

    /**
     * Blur editor
     */
    blur() {
        this.editor.blur();
    }

    /**
     * Check if editor is focused
     */
    isFocused() {
        return document.activeElement === this.editor;
    }

    /**
     * Enable editor
     */
    enable() {
        this.editor.contentEditable = 'true';
        this.editor.removeAttribute('disabled');
    }

    /**
     * Disable editor
     */
    disable() {
        this.editor.contentEditable = 'false';
        this.editor.setAttribute('disabled', 'true');
    }

    /**
     * Destroy editor
     */
    destroy() {
        // Destroy components
        this.inputHandler.destroy();
        this.clipboardHandler.destroy();
        this.historyManager.destroy();
        this.formattingEngine.destroy();
        this.selectionManager.destroy();
        this.domRenderer.destroy();
        this.browserCompat.destroy();

        // Remove editor structure
        this.container.parentNode.replaceChild(this.originalElement, this.container);

        // Clear references
        this.editor = null;
        this.codeView = null;
        this.container = null;
        this.toolbar = null;
        this.contentModel = null;
        this.selectionManager = null;
        this.domRenderer = null;
        this.formattingEngine = null;
        this.inputHandler = null;
        this.clipboardHandler = null;
        this.historyManager = null;
        this.browserCompat = null;
    }

    /**
     * Wrap the current selection in an inline element
     */
    _wrapSelection(tag) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        const range = selection.getRangeAt(0);
        if (range.collapsed) return;
        const existing = this._getParentOrSelf(range.commonAncestorContainer, tag.toUpperCase());
        if (existing) {
            const parent = existing.parentNode;
            while (existing.firstChild) parent.insertBefore(existing.firstChild, existing);
            parent.removeChild(existing);
        } else {
            const wrapper = document.createElement(tag);
            const contents = range.extractContents();
            wrapper.appendChild(contents);
            range.insertNode(wrapper);
            range.selectNodeContents(wrapper);
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }

    /**
     * Change the tag of all selected top-level blocks
     */
    _changeBlockTag(tag) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        const range = selection.getRangeAt(0);

        const getTopBlock = (node) => {
            while (node && node !== this.editor && node.parentNode !== this.editor) {
                node = node.parentNode;
            }
            return (node && node !== this.editor) ? node : null;
        };

        const startBlock = getTopBlock(range.startContainer);
        const endBlock = getTopBlock(range.endContainer);
        if (!startBlock || !endBlock) return;

        const children = Array.from(this.editor.childNodes);
        let startIndex = children.indexOf(startBlock);
        let endIndex = children.indexOf(endBlock);
        if (startIndex === -1 || endIndex === -1) return;
        if (startIndex > endIndex) [startIndex, endIndex] = [endIndex, startIndex];

        if (tag === 'pre') {
            // Merge selected blocks into a single <pre><code>
            const pre = document.createElement('pre');
            const code = document.createElement('code');
            const lines = [];
            for (let i = startIndex; i <= endIndex; i++) {
                const node = children[i];
                if (node.nodeType === Node.ELEMENT_NODE) {
                    lines.push(node.textContent);
                }
            }
            code.textContent = lines.join('\n');
            pre.appendChild(code);
            this.editor.replaceChild(pre, children[startIndex]);
            for (let i = startIndex + 1; i <= endIndex; i++) {
                this.editor.removeChild(children[i]);
            }
            return;
        }

        for (let i = startIndex; i <= endIndex; i++) {
            const node = children[i];
            if (node.nodeType !== Node.ELEMENT_NODE) continue;
            if (node.nodeName === tag.toUpperCase()) continue;
            const newBlock = document.createElement(tag);
            while (node.firstChild) newBlock.appendChild(node.firstChild);
            this.editor.replaceChild(newBlock, node);
            children[i] = newBlock;
        }
    }

    /**
     * Wrap all selected top-level blocks in a list
     */
    _wrapBlockInList(listType) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        const range = selection.getRangeAt(0);

        const getTopBlock = (node) => {
            while (node && node !== this.editor && node.parentNode !== this.editor) {
                node = node.parentNode;
            }
            return (node && node !== this.editor) ? node : null;
        };

        const startBlock = getTopBlock(range.startContainer);
        const endBlock = getTopBlock(range.endContainer);
        if (!startBlock || !endBlock) return;

        const children = Array.from(this.editor.childNodes);
        let startIndex = children.indexOf(startBlock);
        let endIndex = children.indexOf(endBlock);
        if (startIndex === -1 || endIndex === -1) return;
        if (startIndex > endIndex) [startIndex, endIndex] = [endIndex, startIndex];

        const list = document.createElement(listType);
        for (let i = startIndex; i <= endIndex; i++) {
            const node = children[i];
            if (node.nodeType !== Node.ELEMENT_NODE) continue;
            if (['UL', 'OL'].includes(node.nodeName) && node.nodeName.toLowerCase() === listType) {
                // Already the right list type; keep as is
                while (node.firstChild) list.appendChild(node.firstChild);
                continue;
            }
            const li = document.createElement('li');
            while (node.firstChild) li.appendChild(node.firstChild);
            list.appendChild(li);
        }

        this.editor.replaceChild(list, children[startIndex]);
        for (let i = startIndex + 1; i <= endIndex; i++) {
            this.editor.removeChild(children[i]);
        }
    }

    /**
     * Indent or outdent the current block
     */
    _indentBlock(direction) {
        const block = this._getCurrentBlock();
        if (!block || block === this.editor) return;
        const current = parseInt(block.getAttribute('data-indent') || '0', 10);
        const next = Math.max(0, current + direction);
        if (next === 0) {
            block.removeAttribute('data-indent');
        } else {
            block.setAttribute('data-indent', next);
        }
    }

    /**
     * Set alignment of the current block
     */
    _setBlockAlign(align) {
        const block = this._getCurrentBlock();
        if (!block || block === this.editor) return;
        block.setAttribute('align', align);
    }

    /**
     * Insert or update a link in the DOM
     */
    _insertLinkDOM() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        const range = selection.getRangeAt(0);
        const existing = this._getParentOrSelf(range.startContainer, 'A');
        if (existing) {
            const text = document.createTextNode(existing.textContent);
            existing.parentNode.replaceChild(text, existing);
            return;
        }
        const url = prompt('Enter URL:');
        if (!url) return;
        const a = document.createElement('a');
        a.href = url;
        if (range.collapsed) {
            a.textContent = url;
            range.insertNode(a);
            range.setStartAfter(a);
            range.setEndAfter(a);
        } else {
            const contents = range.extractContents();
            a.appendChild(contents);
            range.insertNode(a);
            range.selectNodeContents(a);
        }
        selection.removeAllRanges();
        selection.addRange(range);
    }

    /**
     * Insert an image in the DOM
     */
    _insertImageDOM() {
        const src = prompt('Enter image URL:');
        if (!src) return;
        const alt = prompt('Enter alt text:') || '';
        const img = document.createElement('img');
        img.src = src;
        img.alt = alt;
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        const range = selection.getRangeAt(0);
        range.insertNode(img);
        range.setStartAfter(img);
        range.setEndAfter(img);
        selection.removeAllRanges();
        selection.addRange(range);
    }

    /**
     * Clear formatting in the current selection while preserving blocks/line breaks
     */
    _clearSelection() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const formattingTags = ['strong', 'b', 'em', 'i', 'u', 's', 'strike', 'code', 'a'];
        const elements = this.editor.querySelectorAll(formattingTags.join(', '));
        for (const el of elements) {
            if (selection.containsNode(el, true)) {
                const parent = el.parentNode;
                while (el.firstChild) parent.insertBefore(el.firstChild, el);
                parent.removeChild(el);
            }
        }
    }

    /**
     * Find the current block-level element from the selection
     */
    _getCurrentBlock() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return this.editor;
        let node = selection.getRangeAt(0).startContainer;
        while (node && node !== this.editor && !['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'PRE', 'UL', 'OL', 'LI'].includes(node.nodeName)) {
            node = node.parentNode;
        }
        return node || this.editor;
    }

    /**
     * Get an ancestor (or self) with the given tag name
     */
    _getParentOrSelf(node, tagName) {
        tagName = tagName.toUpperCase();
        while (node && node !== this.editor) {
            if (node.nodeName === tagName) return node;
            node = node.parentNode;
        }
        return null;
    }

    /**
     * Inject CSS styles
     */
    _injectStyles() {
        if (document.getElementById('wysiwyg-editor-styles')) return;

        const style = document.createElement('style');
        style.id = 'wysiwyg-editor-styles';
        style.textContent = this._getStyles();
        document.head.appendChild(style);
    }

    /**
     * Get CSS styles
     */
    _getStyles() {
        return `
            .wysiwyg-container {
                border: 1px solid #ccc;
                border-radius: 4px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            }

            .wysiwyg-toolbar {
                display: flex;
                flex-wrap: wrap;
                gap: 4px;
                padding: 8px;
                border-bottom: 1px solid #ccc;
                background: #f5f5f5;
            }

            .wysiwyg-toolbar-button {
                padding: 6px 12px;
                border: 1px solid #ddd;
                border-radius: 3px;
                background: white;
                cursor: pointer;
                font-size: 14px;
                min-width: 32px;
            }

            .wysiwyg-toolbar-button:hover {
                background: #e9e9e9;
            }

            .wysiwyg-toolbar-button:active {
                background: #d9d9d9;
            }

            .wysiwyg-toolbar-separator {
                width: 1px;
                background: #ccc;
                margin: 0 4px;
            }

            .wysiwyg-editor {
                min-height: 200px;
                padding: 12px;
                outline: none;
                overflow-y: auto;
            }

            .wysiwyg-editor:empty:before {
                content: attr(data-placeholder);
                color: #999;
                pointer-events: none;
            }

            .wysiwyg-editor code {
                background: #f5f5f5;
                border: 1px solid #ddd;
                border-radius: 3px;
                padding: 2px 6px;
                font-family: 'Courier New', monospace;
                font-size: 0.9em;
                color: #d63384;
            }

            .wysiwyg-editor pre {
                background: #f5f5f5;
                border: 1px solid #ddd;
                border-radius: 4px;
                padding: 12px;
                margin: 16px 0;
                overflow-x: auto;
                white-space: pre-wrap;
                word-wrap: break-word;
            }

            .wysiwyg-editor pre code {
                background: none;
                border: none;
                padding: 0;
                color: #333;
                font-size: 14px;
                white-space: pre-wrap;
                display: block;
            }

            .wysiwyg-editor ul,
            .wysiwyg-editor ol {
                margin: 8px 0;
                padding-left: 24px;
            }

            .wysiwyg-editor ul {
                list-style-type: disc;
            }

            .wysiwyg-editor ol {
                list-style-type: decimal;
            }

            .wysiwyg-editor li {
                margin: 4px 0;
            }

            .wysiwyg-code-view {
                width: 100%;
                min-height: 200px;
                padding: 12px;
                border: none;
                border-top: 1px solid #ccc;
                font-family: 'Courier New', Courier, monospace;
                font-size: 13px;
                resize: vertical;
                outline: none;
                box-sizing: border-box;
                background: #f9f9f9;
            }

            .wysiwyg-code-view:focus {
                background: #fff;
            }

            ${this.browserCompat.getCSSFixes()}
        `;
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WYSIWYGEditor;
}
