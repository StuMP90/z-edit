/**
 * WYSIWYG HTML Editor
 * A pure JavaScript WYSIWYG editor with no external dependencies
 * Supports drag-and-drop images, undo/redo, accessibility, and templating
 */

class WYSIWYGEditor {
    constructor(options = {}) {
        this.options = {
            target: options.target || null,
            toolbar: options.toolbar !== false,
            toolbarButtons: options.toolbarButtons || [
                'bold', 'italic', 'underline', 'strikethrough',
                '|',
                'h1', 'h2', 'h3', 'p',
                '|',
                'ul', 'ol',
                '|',
                'link', 'image',
                '|',
                'align-left', 'align-center', 'align-right',
                '|',
                'undo', 'redo',
                '|',
                'code', 'split', 'clear'
            ],
            placeholder: options.placeholder || 'Start typing...',
            maxHistorySize: options.maxHistorySize || 100,
            imageUploadHandler: options.imageUploadHandler || null,
            onChange: options.onChange || null,
            onImageDrop: options.onImageDrop || null,
            customTemplates: options.customTemplates || {},
            allowFullDocument: options.allowFullDocument !== false,
            ariaLabel: options.ariaLabel || 'Rich text editor',
            ariaDescribedBy: options.ariaDescribedBy || null
        };

        this.history = [];
        this.historyIndex = -1;
        this.isRecording = true;
        this.isCodeView = false;
        this.isSplitView = false;
        this.editor = null;
        this.codeEditor = null;
        this.previewPane = null;
        this.splitContainer = null;
        this.toolbar = null;
        this.container = null;
        this.selectedImage = null;
        this.imageToolbar = null;
        this.fileInput = null;
        this.linkDialog = null;
        this.currentLink = null;
        this.savedRange = null;

        if (this.options.target) {
            this.init(this.options.target);
        }
    }

    init(target) {
        if (typeof target === 'string') {
            target = document.querySelector(target);
        }

        if (!target) {
            throw new Error('Target element not found');
        }

        this.target = target;
        this.createEditor();
        this.attachEvents();
        this.loadContent();
        this.saveState();
    }

    createEditor() {
        this.container = document.createElement('div');
        this.container.className = 'wysiwyg-container';
        this.container.setAttribute('role', 'application');
        this.container.setAttribute('aria-label', 'WYSIWYG editor container');

        if (this.options.toolbar) {
            this.toolbar = this.createToolbar();
            this.container.appendChild(this.toolbar);
        }

        this.editor = document.createElement('div');
        this.editor.className = 'wysiwyg-editor';
        this.editor.contentEditable = true;
        this.editor.setAttribute('role', 'textbox');
        this.editor.setAttribute('aria-label', this.options.ariaLabel);
        this.editor.setAttribute('aria-multiline', 'true');
        
        if (this.options.ariaDescribedBy) {
            this.editor.setAttribute('aria-describedby', this.options.ariaDescribedBy);
        }

        if (this.options.placeholder) {
            this.editor.setAttribute('data-placeholder', this.options.placeholder);
        }

        this.container.appendChild(this.editor);

        this.createFileInput();
        this.createImageToolbar();
        this.createLinkDialog();

        if (this.target.tagName === 'TEXTAREA' || this.target.tagName === 'INPUT') {
            this.target.style.display = 'none';
            this.target.parentNode.insertBefore(this.container, this.target.nextSibling);
        } else {
            const content = this.target.getAttribute('data-content') || this.target.innerHTML;
            this.target.parentNode.insertBefore(this.container, this.target);
            this.target.style.display = 'none';
            this.target.setAttribute('data-original-content', content);
        }

        this.injectStyles();
    }

    createToolbar() {
        const toolbar = document.createElement('div');
        toolbar.className = 'wysiwyg-toolbar';
        toolbar.setAttribute('role', 'toolbar');
        toolbar.setAttribute('aria-label', 'Text formatting toolbar');
        toolbar.setAttribute('aria-controls', 'wysiwyg-editor');

        this.options.toolbarButtons.forEach((button, index) => {
            if (button === '|') {
                const separator = document.createElement('span');
                separator.className = 'wysiwyg-separator';
                separator.setAttribute('role', 'separator');
                toolbar.appendChild(separator);
            } else {
                const btn = this.createToolbarButton(button);
                toolbar.appendChild(btn);
            }
        });

        return toolbar;
    }

    createToolbarButton(action) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'wysiwyg-btn';
        button.setAttribute('data-action', action);
        button.setAttribute('role', 'button');
        button.setAttribute('tabindex', '0');

        const buttonConfig = this.getButtonConfig(action);
        button.innerHTML = buttonConfig.icon;
        button.title = buttonConfig.title;
        button.setAttribute('aria-label', buttonConfig.title);

        button.addEventListener('click', (e) => {
            e.preventDefault();
            this.executeCommand(action);
            this.editor.focus();
        });

        button.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.executeCommand(action);
                this.editor.focus();
            }
        });

        return button;
    }

    getButtonConfig(action) {
        const configs = {
            'bold': { icon: '<strong>B</strong>', title: 'Bold (Ctrl+B)' },
            'italic': { icon: '<em>I</em>', title: 'Italic (Ctrl+I)' },
            'underline': { icon: '<u>U</u>', title: 'Underline (Ctrl+U)' },
            'strikethrough': { icon: '<s>S</s>', title: 'Strikethrough' },
            'h1': { icon: 'H1', title: 'Heading 1' },
            'h2': { icon: 'H2', title: 'Heading 2' },
            'h3': { icon: 'H3', title: 'Heading 3' },
            'p': { icon: 'P', title: 'Paragraph' },
            'ul': { icon: '• List', title: 'Bullet List' },
            'ol': { icon: '1. List', title: 'Numbered List' },
            'link': { icon: '🔗', title: 'Insert Link' },
            'image': { icon: '🖼', title: 'Insert Image' },
            'align-left': { icon: '≡', title: 'Align Left' },
            'align-center': { icon: '≣', title: 'Align Center' },
            'align-right': { icon: '≡', title: 'Align Right' },
            'undo': { icon: '↶', title: 'Undo (Ctrl+Z)' },
            'redo': { icon: '↷', title: 'Redo (Ctrl+Y)' },
            'code': { icon: '&lt;/&gt;', title: 'View HTML Code' },
            'split': { icon: '⇆', title: 'Split View (Code + Preview)' },
            'clear': { icon: '✕', title: 'Clear Formatting' }
        };

        return configs[action] || { icon: action, title: action };
    }

    executeCommand(action) {
        this.isRecording = false;

        switch (action) {
            case 'bold':
                document.execCommand('bold', false, null);
                break;
            case 'italic':
                document.execCommand('italic', false, null);
                break;
            case 'underline':
                document.execCommand('underline', false, null);
                break;
            case 'strikethrough':
                document.execCommand('strikeThrough', false, null);
                break;
            case 'h1':
            case 'h2':
            case 'h3':
                document.execCommand('formatBlock', false, action);
                break;
            case 'p':
                document.execCommand('formatBlock', false, 'p');
                break;
            case 'ul':
                document.execCommand('insertUnorderedList', false, null);
                break;
            case 'ol':
                document.execCommand('insertOrderedList', false, null);
                break;
            case 'link':
                this.insertLink();
                break;
            case 'image':
                this.insertImage();
                break;
            case 'align-left':
                document.execCommand('justifyLeft', false, null);
                break;
            case 'align-center':
                document.execCommand('justifyCenter', false, null);
                break;
            case 'align-right':
                document.execCommand('justifyRight', false, null);
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
            case 'clear':
                document.execCommand('removeFormat', false, null);
                break;
            default:
                if (this.options.customTemplates[action]) {
                    this.insertTemplate(action);
                }
        }

        this.isRecording = true;
        this.saveState();
    }

    insertLink() {
        const selection = window.getSelection();
        let linkElement = null;
        
        if (selection.rangeCount > 0) {
            this.savedRange = selection.getRangeAt(0).cloneRange();
            let node = this.savedRange.commonAncestorContainer;
            
            if (node.nodeType === Node.TEXT_NODE) {
                node = node.parentNode;
            }
            
            if (node.tagName === 'A') {
                linkElement = node;
            } else {
                linkElement = node.closest('a');
            }
        } else {
            this.savedRange = null;
        }
        
        this.showLinkDialog(linkElement);
    }

    createLinkDialog() {
        this.linkDialog = document.createElement('div');
        this.linkDialog.className = 'wysiwyg-link-dialog';
        this.linkDialog.style.display = 'none';
        this.linkDialog.setAttribute('role', 'dialog');
        this.linkDialog.setAttribute('aria-label', 'Link properties');

        const overlay = document.createElement('div');
        overlay.className = 'wysiwyg-dialog-overlay';
        overlay.addEventListener('click', () => this.hideLinkDialog());

        const dialogContent = document.createElement('div');
        dialogContent.className = 'wysiwyg-dialog-content';
        dialogContent.addEventListener('click', (e) => e.stopPropagation());

        const title = document.createElement('h3');
        title.textContent = 'Link Properties';
        dialogContent.appendChild(title);

        const fields = [
            { label: 'Link Text:', id: 'link-text', type: 'text', placeholder: 'Click here' },
            { label: 'URL:', id: 'link-url', type: 'text', placeholder: 'https://example.com' },
            { label: 'Title:', id: 'link-title', type: 'text', placeholder: 'Optional tooltip' },
            { label: 'Target:', id: 'link-target', type: 'select', options: [
                { value: '', label: 'Same window' },
                { value: '_blank', label: 'New window (_blank)' },
                { value: '_parent', label: 'Parent frame (_parent)' },
                { value: '_top', label: 'Top frame (_top)' }
            ]},
            { label: 'Rel:', id: 'link-rel', type: 'text', placeholder: 'e.g., nofollow, noopener' }
        ];

        fields.forEach(field => {
            const wrapper = document.createElement('div');
            wrapper.className = 'wysiwyg-dialog-field';

            const label = document.createElement('label');
            label.textContent = field.label;
            label.htmlFor = field.id;
            wrapper.appendChild(label);

            if (field.type === 'select') {
                const select = document.createElement('select');
                select.id = field.id;
                field.options.forEach(opt => {
                    const option = document.createElement('option');
                    option.value = opt.value;
                    option.textContent = opt.label;
                    select.appendChild(option);
                });
                wrapper.appendChild(select);
            } else {
                const input = document.createElement('input');
                input.type = field.type;
                input.id = field.id;
                input.placeholder = field.placeholder;
                wrapper.appendChild(input);
            }

            dialogContent.appendChild(wrapper);
        });

        const buttonWrapper = document.createElement('div');
        buttonWrapper.className = 'wysiwyg-dialog-buttons';

        const insertBtn = document.createElement('button');
        insertBtn.type = 'button';
        insertBtn.className = 'wysiwyg-dialog-btn wysiwyg-dialog-btn-primary';
        insertBtn.textContent = 'Insert Link';
        insertBtn.addEventListener('click', () => this.applyLink());
        buttonWrapper.appendChild(insertBtn);

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'wysiwyg-dialog-btn wysiwyg-dialog-btn-danger';
        removeBtn.textContent = 'Remove Link';
        removeBtn.id = 'link-remove-btn';
        removeBtn.style.display = 'none';
        removeBtn.addEventListener('click', () => this.removeLink());
        buttonWrapper.appendChild(removeBtn);

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'wysiwyg-dialog-btn';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.addEventListener('click', () => this.hideLinkDialog());
        buttonWrapper.appendChild(cancelBtn);

        dialogContent.appendChild(buttonWrapper);
        this.linkDialog.appendChild(overlay);
        this.linkDialog.appendChild(dialogContent);
        this.container.appendChild(this.linkDialog);
    }

    showLinkDialog(linkElement) {
        this.currentLink = linkElement;
        this.linkDialog.style.display = 'flex';

        const textInput = this.linkDialog.querySelector('#link-text');
        const urlInput = this.linkDialog.querySelector('#link-url');
        const titleInput = this.linkDialog.querySelector('#link-title');
        const targetSelect = this.linkDialog.querySelector('#link-target');
        const relInput = this.linkDialog.querySelector('#link-rel');
        const removeBtn = this.linkDialog.querySelector('#link-remove-btn');
        const insertBtn = this.linkDialog.querySelector('.wysiwyg-dialog-btn-primary');

        if (linkElement) {
            textInput.value = linkElement.textContent || '';
            urlInput.value = linkElement.href || '';
            titleInput.value = linkElement.title || '';
            targetSelect.value = linkElement.target || '';
            relInput.value = linkElement.rel || '';
            removeBtn.style.display = 'inline-block';
            insertBtn.textContent = 'Update Link';
        } else {
            const selection = window.getSelection();
            textInput.value = selection.toString() || '';
            urlInput.value = '';
            titleInput.value = '';
            targetSelect.value = '';
            relInput.value = '';
            removeBtn.style.display = 'none';
            insertBtn.textContent = 'Insert Link';
        }

        urlInput.focus();
    }

    hideLinkDialog() {
        this.linkDialog.style.display = 'none';
        this.currentLink = null;
        this.savedRange = null;
    }

    applyLink() {
        const textInput = this.linkDialog.querySelector('#link-text');
        const urlInput = this.linkDialog.querySelector('#link-url');
        const titleInput = this.linkDialog.querySelector('#link-title');
        const targetSelect = this.linkDialog.querySelector('#link-target');
        const relInput = this.linkDialog.querySelector('#link-rel');

        const url = urlInput.value.trim();
        if (!url) {
            alert('Please enter a URL');
            return;
        }

        const text = textInput.value.trim() || url;

        if (this.currentLink) {
            this.currentLink.href = url;
            this.currentLink.textContent = text;
            if (titleInput.value) {
                this.currentLink.title = titleInput.value;
            } else {
                this.currentLink.removeAttribute('title');
            }
            if (targetSelect.value) {
                this.currentLink.target = targetSelect.value;
            } else {
                this.currentLink.removeAttribute('target');
            }
            if (relInput.value) {
                this.currentLink.rel = relInput.value;
            } else {
                this.currentLink.removeAttribute('rel');
            }
        } else {
            const link = document.createElement('a');
            link.href = url;
            link.textContent = text;
            if (titleInput.value) link.title = titleInput.value;
            if (targetSelect.value) link.target = targetSelect.value;
            if (relInput.value) link.rel = relInput.value;

            if (this.savedRange) {
                this.savedRange.deleteContents();
                this.savedRange.insertNode(link);
                this.savedRange.setStartAfter(link);
                this.savedRange.setEndAfter(link);
                
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(this.savedRange);
            } else {
                this.editor.appendChild(link);
            }
        }

        this.saveState();
        this.hideLinkDialog();
    }

    removeLink() {
        if (this.currentLink) {
            const text = document.createTextNode(this.currentLink.textContent);
            this.currentLink.parentNode.replaceChild(text, this.currentLink);
            this.saveState();
        }
        this.hideLinkDialog();
    }

    insertImage() {
        this.fileInput.click();
    }

    createFileInput() {
        this.fileInput = document.createElement('input');
        this.fileInput.type = 'file';
        this.fileInput.accept = 'image/*';
        this.fileInput.style.display = 'none';
        this.fileInput.setAttribute('aria-label', 'Select image file');
        
        this.fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file && file.type.startsWith('image/')) {
                if (this.options.imageUploadHandler) {
                    this.options.imageUploadHandler(file, (url) => {
                        this.insertImageFromUrl(url, file.name);
                    });
                } else if (this.options.onImageDrop) {
                    this.options.onImageDrop(file, (url) => {
                        this.insertImageFromUrl(url, file.name);
                    });
                } else {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        this.insertImageFromUrl(e.target.result, file.name);
                    };
                    reader.readAsDataURL(file);
                }
            }
            this.fileInput.value = '';
        });
        
        this.container.appendChild(this.fileInput);
    }

    insertImageFromUrl(url, alt = '') {
        const img = document.createElement('img');
        img.src = url;
        img.alt = alt;
        img.setAttribute('role', 'img');
        img.setAttribute('tabindex', '0');
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        img.style.cursor = 'pointer';

        this.attachImageEvents(img);

        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.deleteContents();
            range.insertNode(img);
            range.setStartAfter(img);
            range.setEndAfter(img);
            selection.removeAllRanges();
            selection.addRange(range);
        } else {
            this.editor.appendChild(img);
        }

        this.saveState();
    }

    attachImageEvents(img) {
        img.addEventListener('click', (e) => {
            e.preventDefault();
            this.selectImage(img);
        });

        img.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.selectImage(img);
            }
            if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                this.deleteSelectedImage();
            }
        });
    }

    selectImage(img) {
        if (this.selectedImage) {
            this.selectedImage.classList.remove('wysiwyg-image-selected');
        }
        
        this.selectedImage = img;
        img.classList.add('wysiwyg-image-selected');
        this.showImageToolbar(img);
    }

    deselectImage() {
        if (this.selectedImage) {
            this.selectedImage.classList.remove('wysiwyg-image-selected');
            this.selectedImage = null;
        }
        this.hideImageToolbar();
    }

    deleteSelectedImage() {
        if (this.selectedImage) {
            this.selectedImage.remove();
            this.selectedImage = null;
            this.hideImageToolbar();
            this.saveState();
        }
    }

    insertTemplate(templateName) {
        const template = this.options.customTemplates[templateName];
        if (typeof template === 'function') {
            const html = template();
            this.insertHTML(html);
        } else if (typeof template === 'string') {
            this.insertHTML(template);
        }
    }

    insertHTML(html) {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.deleteContents();
            
            const fragment = range.createContextualFragment(html);
            range.insertNode(fragment);
        } else {
            this.editor.insertAdjacentHTML('beforeend', html);
        }
        
        this.saveState();
    }

    toggleCodeView() {
        if (this.isSplitView) {
            this.exitSplitView();
        }

        if (!this.isCodeView) {
            const html = this.getHTML();
            this.editor.textContent = html;
            this.editor.style.whiteSpace = 'pre-wrap';
            this.editor.style.fontFamily = 'monospace';
            this.editor.setAttribute('aria-label', 'HTML code view');
            this.isCodeView = true;
            this.updateToolbarState();
        } else {
            const html = this.editor.textContent;
            this.editor.style.whiteSpace = '';
            this.editor.style.fontFamily = '';
            this.setHTML(html);
            this.editor.setAttribute('aria-label', this.options.ariaLabel);
            this.isCodeView = false;
            this.updateToolbarState();
        }
    }

    toggleSplitView() {
        if (!this.isSplitView) {
            this.enterSplitView();
        } else {
            this.exitSplitView();
        }
    }

    enterSplitView() {
        if (this.isCodeView) {
            this.toggleCodeView();
        }

        this.isSplitView = true;
        const currentHTML = this.getHTML();

        this.splitContainer = document.createElement('div');
        this.splitContainer.className = 'wysiwyg-split-container';

        this.codeEditor = document.createElement('div');
        this.codeEditor.className = 'wysiwyg-code-editor';
        this.codeEditor.contentEditable = true;
        this.codeEditor.textContent = currentHTML;
        this.codeEditor.style.whiteSpace = 'pre-wrap';
        this.codeEditor.style.fontFamily = 'monospace';
        this.codeEditor.setAttribute('role', 'textbox');
        this.codeEditor.setAttribute('aria-label', 'HTML code editor');
        this.codeEditor.setAttribute('aria-multiline', 'true');

        this.previewPane = document.createElement('div');
        this.previewPane.className = 'wysiwyg-preview-pane';
        this.previewPane.innerHTML = currentHTML;
        this.previewPane.setAttribute('role', 'region');
        this.previewPane.setAttribute('aria-label', 'Live preview');
        this.previewPane.setAttribute('aria-live', 'polite');

        this.splitContainer.appendChild(this.codeEditor);
        this.splitContainer.appendChild(this.previewPane);

        this.editor.style.display = 'none';
        this.editor.parentNode.insertBefore(this.splitContainer, this.editor);

        this.codeEditor.addEventListener('input', () => {
            this.updatePreview();
        });

        this.updateToolbarState();
    }

    exitSplitView() {
        if (!this.isSplitView) return;

        const html = this.codeEditor.textContent;
        this.isSplitView = false;

        if (this.splitContainer && this.splitContainer.parentNode) {
            this.splitContainer.parentNode.removeChild(this.splitContainer);
        }

        this.editor.style.display = '';
        this.setHTML(html);

        this.codeEditor = null;
        this.previewPane = null;
        this.splitContainer = null;

        this.updateToolbarState();
    }

    updatePreview() {
        if (!this.isSplitView || !this.previewPane) return;

        const html = this.codeEditor.textContent;
        this.previewPane.innerHTML = html;

        this.updateTarget();
        if (this.options.onChange) {
            this.options.onChange(html);
        }

        if (this.isRecording) {
            this.saveState();
        }
    }

    createImageToolbar() {
        this.imageToolbar = document.createElement('div');
        this.imageToolbar.className = 'wysiwyg-image-toolbar';
        this.imageToolbar.style.display = 'none';
        this.imageToolbar.setAttribute('role', 'toolbar');
        this.imageToolbar.setAttribute('aria-label', 'Image properties toolbar');

        const controls = [
            { label: 'Width:', type: 'number', id: 'img-width', min: '1', placeholder: 'auto' },
            { label: 'Height:', type: 'number', id: 'img-height', min: '1', placeholder: 'auto' },
            { label: 'Alt:', type: 'text', id: 'img-alt', placeholder: 'Description' },
            { label: 'Class:', type: 'text', id: 'img-class', placeholder: 'CSS class' },
            { label: 'Style:', type: 'text', id: 'img-style', placeholder: 'CSS styles' },
        ];

        controls.forEach(control => {
            const wrapper = document.createElement('div');
            wrapper.className = 'wysiwyg-img-control';

            const label = document.createElement('label');
            label.textContent = control.label;
            label.htmlFor = control.id;
            wrapper.appendChild(label);

            const input = document.createElement('input');
            input.type = control.type;
            input.id = control.id;
            input.placeholder = control.placeholder;
            if (control.min) input.min = control.min;
            input.addEventListener('change', () => this.updateImageProperties());
            wrapper.appendChild(input);

            this.imageToolbar.appendChild(wrapper);
        });

        const alignmentWrapper = document.createElement('div');
        alignmentWrapper.className = 'wysiwyg-img-control';
        const alignLabel = document.createElement('label');
        alignLabel.textContent = 'Align:';
        alignmentWrapper.appendChild(alignLabel);

        const alignButtons = [
            { value: 'left', label: '←', title: 'Float left' },
            { value: 'center', label: '■', title: 'Center' },
            { value: 'right', label: '→', title: 'Float right' },
            { value: 'none', label: '✕', title: 'No float' }
        ];

        alignButtons.forEach(btn => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'wysiwyg-img-align-btn';
            button.textContent = btn.label;
            button.title = btn.title;
            button.setAttribute('data-align', btn.value);
            button.addEventListener('click', () => this.setImageAlignment(btn.value));
            alignmentWrapper.appendChild(button);
        });

        this.imageToolbar.appendChild(alignmentWrapper);

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'wysiwyg-img-delete-btn';
        deleteBtn.textContent = '🗑 Delete';
        deleteBtn.title = 'Delete image';
        deleteBtn.addEventListener('click', () => this.deleteSelectedImage());
        this.imageToolbar.appendChild(deleteBtn);

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'wysiwyg-img-close-btn';
        closeBtn.textContent = '✕';
        closeBtn.title = 'Close toolbar';
        closeBtn.addEventListener('click', () => this.deselectImage());
        this.imageToolbar.appendChild(closeBtn);

        this.container.appendChild(this.imageToolbar);
    }

    showImageToolbar(img) {
        this.imageToolbar.style.display = 'flex';

        const widthInput = this.imageToolbar.querySelector('#img-width');
        const heightInput = this.imageToolbar.querySelector('#img-height');
        const altInput = this.imageToolbar.querySelector('#img-alt');
        const classInput = this.imageToolbar.querySelector('#img-class');
        const styleInput = this.imageToolbar.querySelector('#img-style');

        widthInput.value = img.width || '';
        heightInput.value = img.height || '';
        altInput.value = img.alt || '';
        classInput.value = img.className || '';
        styleInput.value = img.getAttribute('style') || '';
    }

    hideImageToolbar() {
        this.imageToolbar.style.display = 'none';
    }

    updateImageProperties() {
        if (!this.selectedImage) return;

        const widthInput = this.imageToolbar.querySelector('#img-width');
        const heightInput = this.imageToolbar.querySelector('#img-height');
        const altInput = this.imageToolbar.querySelector('#img-alt');
        const classInput = this.imageToolbar.querySelector('#img-class');
        const styleInput = this.imageToolbar.querySelector('#img-style');

        if (widthInput.value) {
            this.selectedImage.width = parseInt(widthInput.value);
            this.selectedImage.style.width = widthInput.value + 'px';
        } else {
            this.selectedImage.removeAttribute('width');
            this.selectedImage.style.width = '';
        }

        if (heightInput.value) {
            this.selectedImage.height = parseInt(heightInput.value);
            this.selectedImage.style.height = heightInput.value + 'px';
        } else {
            this.selectedImage.removeAttribute('height');
            this.selectedImage.style.height = 'auto';
        }

        this.selectedImage.alt = altInput.value;
        this.selectedImage.className = classInput.value;

        if (styleInput.value) {
            this.selectedImage.setAttribute('style', styleInput.value);
        } else {
            this.selectedImage.removeAttribute('style');
        }

        if (!classInput.value.includes('wysiwyg-image-selected')) {
            this.selectedImage.classList.add('wysiwyg-image-selected');
        }

        this.saveState();
    }

    setImageAlignment(alignment) {
        if (!this.selectedImage) return;

        this.selectedImage.style.float = '';
        this.selectedImage.style.display = '';
        this.selectedImage.style.margin = '';

        switch (alignment) {
            case 'left':
                this.selectedImage.style.float = 'left';
                this.selectedImage.style.marginRight = '10px';
                this.selectedImage.style.marginBottom = '10px';
                break;
            case 'right':
                this.selectedImage.style.float = 'right';
                this.selectedImage.style.marginLeft = '10px';
                this.selectedImage.style.marginBottom = '10px';
                break;
            case 'center':
                this.selectedImage.style.display = 'block';
                this.selectedImage.style.margin = '10px auto';
                break;
            case 'none':
                break;
        }

        this.saveState();
    }

    attachEvents() {
        this.editor.addEventListener('input', () => {
            if (this.isRecording) {
                this.saveState();
            }
            this.updateTarget();
            if (this.options.onChange) {
                this.options.onChange(this.getHTML());
            }
        });

        this.editor.addEventListener('paste', (e) => {
            e.preventDefault();
            const text = e.clipboardData.getData('text/html') || e.clipboardData.getData('text/plain');
            document.execCommand('insertHTML', false, text);
        });

        this.editor.addEventListener('drop', (e) => {
            e.preventDefault();
            this.handleDrop(e);
        });

        this.editor.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });

        this.editor.addEventListener('click', (e) => {
            if (!e.target.closest('img')) {
                this.deselectImage();
            }
        });

        this.editor.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key.toLowerCase()) {
                    case 'z':
                        e.preventDefault();
                        if (e.shiftKey) {
                            this.redo();
                        } else {
                            this.undo();
                        }
                        break;
                    case 'y':
                        e.preventDefault();
                        this.redo();
                        break;
                    case 'b':
                        e.preventDefault();
                        this.executeCommand('bold');
                        break;
                    case 'i':
                        e.preventDefault();
                        this.executeCommand('italic');
                        break;
                    case 'u':
                        e.preventDefault();
                        this.executeCommand('underline');
                        break;
                }
            }
        });
    }

    handleDrop(e) {
        const files = e.dataTransfer.files;
        const html = e.dataTransfer.getData('text/html');
        const text = e.dataTransfer.getData('text/plain');

        if (files.length > 0) {
            Array.from(files).forEach(file => {
                if (file.type.startsWith('image/')) {
                    this.handleImageDrop(file, e);
                }
            });
        } else if (html) {
            const range = this.getRangeAtPoint(e.clientX, e.clientY);
            if (range) {
                range.deleteContents();
                const fragment = range.createContextualFragment(html);
                range.insertNode(fragment);
            }
        } else if (text) {
            const range = this.getRangeAtPoint(e.clientX, e.clientY);
            if (range) {
                range.deleteContents();
                range.insertNode(document.createTextNode(text));
            }
        }
    }

    handleImageDrop(file, event) {
        if (this.options.onImageDrop) {
            this.options.onImageDrop(file, (url) => {
                this.insertImageAtPoint(url, file.name, event.clientX, event.clientY);
            });
        } else if (this.options.imageUploadHandler) {
            this.options.imageUploadHandler(file, (url) => {
                this.insertImageAtPoint(url, file.name, event.clientX, event.clientY);
            });
        } else {
            const reader = new FileReader();
            reader.onload = (e) => {
                this.insertImageAtPoint(e.target.result, file.name, event.clientX, event.clientY);
            };
            reader.readAsDataURL(file);
        }
    }

    insertImageAtPoint(url, alt, x, y) {
        const range = this.getRangeAtPoint(x, y);
        if (range) {
            const img = document.createElement('img');
            img.src = url;
            img.alt = alt;
            img.setAttribute('role', 'img');
            img.setAttribute('tabindex', '0');
            img.style.maxWidth = '100%';
            img.style.height = 'auto';
            img.style.cursor = 'pointer';
            
            this.attachImageEvents(img);
            
            range.deleteContents();
            range.insertNode(img);
            range.setStartAfter(img);
            range.setEndAfter(img);
            
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
        }
        
        this.saveState();
    }

    getRangeAtPoint(x, y) {
        if (document.caretRangeFromPoint) {
            return document.caretRangeFromPoint(x, y);
        } else if (document.caretPositionFromPoint) {
            const position = document.caretPositionFromPoint(x, y);
            const range = document.createRange();
            range.setStart(position.offsetNode, position.offset);
            range.setEnd(position.offsetNode, position.offset);
            return range;
        }
        return null;
    }

    saveState() {
        const currentState = this.editor.innerHTML;
        
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }
        
        if (this.history.length === 0 || this.history[this.historyIndex] !== currentState) {
            this.history.push(currentState);
            this.historyIndex++;
            
            if (this.history.length > this.options.maxHistorySize) {
                this.history.shift();
                this.historyIndex--;
            }
        }
        
        this.updateUndoRedoButtons();
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.isRecording = false;
            this.editor.innerHTML = this.history[this.historyIndex];
            this.isRecording = true;
            this.updateTarget();
            this.updateUndoRedoButtons();
            
            if (this.options.onChange) {
                this.options.onChange(this.getHTML());
            }
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.isRecording = false;
            this.editor.innerHTML = this.history[this.historyIndex];
            this.isRecording = true;
            this.updateTarget();
            this.updateUndoRedoButtons();
            
            if (this.options.onChange) {
                this.options.onChange(this.getHTML());
            }
        }
    }

    updateUndoRedoButtons() {
        if (this.toolbar) {
            const undoBtn = this.toolbar.querySelector('[data-action="undo"]');
            const redoBtn = this.toolbar.querySelector('[data-action="redo"]');
            
            if (undoBtn) {
                undoBtn.disabled = this.historyIndex <= 0;
                undoBtn.setAttribute('aria-disabled', this.historyIndex <= 0);
            }
            
            if (redoBtn) {
                redoBtn.disabled = this.historyIndex >= this.history.length - 1;
                redoBtn.setAttribute('aria-disabled', this.historyIndex >= this.history.length - 1);
            }
        }
    }

    updateToolbarState() {
        if (!this.toolbar) return;
        
        const buttons = this.toolbar.querySelectorAll('.wysiwyg-btn');
        buttons.forEach(btn => {
            const action = btn.getAttribute('data-action');
            
            if (action === 'code' || action === 'split' || action === 'undo' || action === 'redo') {
                return;
            }
            
            if (this.isCodeView || this.isSplitView) {
                btn.disabled = true;
                btn.setAttribute('aria-disabled', 'true');
            } else {
                btn.disabled = false;
                btn.setAttribute('aria-disabled', 'false');
            }
        });
    }

    loadContent() {
        if (this.target.tagName === 'TEXTAREA' || this.target.tagName === 'INPUT') {
            this.setHTML(this.target.value);
        } else {
            const content = this.target.getAttribute('data-content') || 
                          this.target.getAttribute('data-original-content') || '';
            if (content) {
                this.setHTML(content);
            }
        }
    }

    updateTarget() {
        const html = this.getHTML();
        
        if (this.target.tagName === 'TEXTAREA' || this.target.tagName === 'INPUT') {
            this.target.value = html;
        } else {
            this.target.setAttribute('data-content', html);
        }
    }

    getHTML() {
        return this.editor.innerHTML;
    }

    setHTML(html) {
        this.isRecording = false;
        this.editor.innerHTML = html;
        this.isRecording = true;
        this.reattachImageHandlers();
        this.updateTarget();
    }

    reattachImageHandlers() {
        const images = this.editor.querySelectorAll('img');
        images.forEach(img => {
            this.attachImageEvents(img);
        });
    }

    getDocument() {
        const content = this.getHTML();
        
        if (this.options.allowFullDocument && this.isFullDocument(content)) {
            return content;
        } else {
            return this.wrapInDocument(content);
        }
    }

    setDocument(html) {
        if (this.isFullDocument(html)) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            this.setHTML(doc.body.innerHTML);
        } else {
            this.setHTML(html);
        }
    }

    isFullDocument(html) {
        const trimmed = html.trim();
        return trimmed.toLowerCase().startsWith('<!doctype') || 
               trimmed.toLowerCase().startsWith('<html');
    }

    wrapInDocument(content) {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document</title>
</head>
<body>
${content}
</body>
</html>`;
    }

    destroy() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        
        this.target.style.display = '';
        
        if (this.target.tagName !== 'TEXTAREA' && this.target.tagName !== 'INPUT') {
            const originalContent = this.target.getAttribute('data-original-content');
            if (originalContent) {
                this.target.innerHTML = originalContent;
                this.target.removeAttribute('data-original-content');
            }
        }
    }

    injectStyles() {
        if (document.getElementById('wysiwyg-editor-styles')) {
            return;
        }

        const style = document.createElement('style');
        style.id = 'wysiwyg-editor-styles';
        style.textContent = `
            .wysiwyg-container {
                border: 1px solid #ccc;
                border-radius: 4px;
                background: #fff;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            }

            .wysiwyg-toolbar {
                display: flex;
                flex-wrap: wrap;
                gap: 4px;
                padding: 8px;
                background: #f5f5f5;
                border-bottom: 1px solid #ccc;
                border-radius: 4px 4px 0 0;
            }

            .wysiwyg-btn {
                padding: 6px 10px;
                border: 1px solid #ddd;
                background: #fff;
                border-radius: 3px;
                cursor: pointer;
                font-size: 14px;
                color: #333;
                transition: all 0.2s;
                min-width: 32px;
                height: 32px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
            }

            .wysiwyg-btn:hover:not(:disabled) {
                background: #e9e9e9;
                border-color: #999;
            }

            .wysiwyg-btn:active:not(:disabled) {
                background: #ddd;
            }

            .wysiwyg-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }

            .wysiwyg-btn:focus {
                outline: 2px solid #0066cc;
                outline-offset: 2px;
            }

            .wysiwyg-separator {
                width: 1px;
                background: #ccc;
                margin: 0 4px;
            }

            .wysiwyg-editor {
                min-height: 200px;
                padding: 16px;
                outline: none;
                overflow-y: auto;
                max-height: 600px;
            }

            .wysiwyg-editor:focus {
                outline: 2px solid #0066cc;
                outline-offset: -2px;
            }

            .wysiwyg-editor:empty:before {
                content: attr(data-placeholder);
                color: #999;
                pointer-events: none;
            }

            .wysiwyg-editor img {
                max-width: 100%;
                height: auto;
                display: block;
                margin: 8px 0;
            }

            .wysiwyg-editor h1,
            .wysiwyg-editor h2,
            .wysiwyg-editor h3 {
                margin: 16px 0 8px 0;
            }

            .wysiwyg-editor p {
                margin: 8px 0;
            }

            .wysiwyg-editor ul,
            .wysiwyg-editor ol {
                margin: 8px 0;
                padding-left: 24px;
            }

            .wysiwyg-editor a {
                color: #0066cc;
                text-decoration: underline;
            }

            .wysiwyg-editor blockquote {
                border-left: 4px solid #ccc;
                margin: 16px 0;
                padding-left: 16px;
                color: #666;
            }

            .wysiwyg-image-selected {
                outline: 3px solid #0066cc;
                outline-offset: 2px;
            }

            .wysiwyg-image-toolbar {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                padding: 12px;
                background: #f9f9f9;
                border-top: 1px solid #ccc;
                align-items: center;
            }

            .wysiwyg-img-control {
                display: flex;
                align-items: center;
                gap: 4px;
            }

            .wysiwyg-img-control label {
                font-size: 13px;
                font-weight: 500;
                color: #333;
            }

            .wysiwyg-img-control input {
                padding: 4px 8px;
                border: 1px solid #ddd;
                border-radius: 3px;
                font-size: 13px;
                width: 80px;
            }

            .wysiwyg-img-control input[type="text"] {
                width: 120px;
            }

            .wysiwyg-img-align-btn {
                padding: 4px 8px;
                border: 1px solid #ddd;
                background: #fff;
                border-radius: 3px;
                cursor: pointer;
                font-size: 14px;
                color: #333;
                min-width: 28px;
                height: 28px;
                transition: all 0.2s;
            }

            .wysiwyg-img-align-btn:hover {
                background: #e9e9e9;
                border-color: #999;
            }

            .wysiwyg-img-delete-btn,
            .wysiwyg-img-close-btn {
                padding: 6px 12px;
                border: 1px solid #ddd;
                background: #fff;
                border-radius: 3px;
                cursor: pointer;
                font-size: 13px;
                color: #333;
                transition: all 0.2s;
                margin-left: auto;
            }

            .wysiwyg-img-delete-btn {
                color: #d32f2f;
                border-color: #d32f2f;
            }

            .wysiwyg-img-delete-btn:hover {
                background: #d32f2f;
                color: white;
            }

            .wysiwyg-img-close-btn:hover {
                background: #e9e9e9;
            }

            .wysiwyg-link-dialog {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .wysiwyg-dialog-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
            }

            .wysiwyg-dialog-content {
                position: relative;
                background: white;
                border-radius: 8px;
                padding: 24px;
                min-width: 400px;
                max-width: 500px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                z-index: 1;
            }

            .wysiwyg-dialog-content h3 {
                margin: 0 0 20px 0;
                color: #333;
                font-size: 18px;
                font-weight: 600;
            }

            .wysiwyg-dialog-field {
                margin-bottom: 16px;
            }

            .wysiwyg-dialog-field label {
                display: block;
                margin-bottom: 6px;
                font-size: 14px;
                font-weight: 500;
                color: #333;
            }

            .wysiwyg-dialog-field input,
            .wysiwyg-dialog-field select {
                width: 100%;
                padding: 8px 12px;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-size: 14px;
                color: #333;
                box-sizing: border-box;
            }

            .wysiwyg-dialog-field input:focus,
            .wysiwyg-dialog-field select:focus {
                outline: 2px solid #0066cc;
                outline-offset: 0;
                border-color: #0066cc;
            }

            .wysiwyg-dialog-buttons {
                display: flex;
                gap: 8px;
                margin-top: 24px;
                justify-content: flex-end;
            }

            .wysiwyg-dialog-btn {
                padding: 8px 16px;
                border: 1px solid #ddd;
                background: #fff;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
                color: #333;
                transition: all 0.2s;
            }

            .wysiwyg-dialog-btn:hover {
                background: #f5f5f5;
            }

            .wysiwyg-dialog-btn-primary {
                background: #0066cc;
                color: white;
                border-color: #0066cc;
            }

            .wysiwyg-dialog-btn-primary:hover {
                background: #0052a3;
                border-color: #0052a3;
            }

            .wysiwyg-dialog-btn-danger {
                color: #d32f2f;
                border-color: #d32f2f;
            }

            .wysiwyg-dialog-btn-danger:hover {
                background: #d32f2f;
                color: white;
            }

            .wysiwyg-split-container {
                display: flex;
                gap: 1px;
                background: #ccc;
                min-height: 400px;
            }

            .wysiwyg-code-editor {
                flex: 1;
                padding: 16px;
                background: #fff;
                overflow-y: auto;
                white-space: pre-wrap;
                font-family: 'Courier New', monospace;
                font-size: 14px;
                line-height: 1.5;
                color: #333;
                outline: none;
            }

            .wysiwyg-code-editor:focus {
                outline: 2px solid #0066cc;
                outline-offset: -2px;
            }

            .wysiwyg-preview-pane {
                flex: 1;
                padding: 16px;
                background: #fff;
                overflow-y: auto;
                border-left: 1px solid #ccc;
            }

            .wysiwyg-preview-pane img {
                max-width: 100%;
                height: auto;
                display: block;
                margin: 8px 0;
            }

            .wysiwyg-preview-pane h1,
            .wysiwyg-preview-pane h2,
            .wysiwyg-preview-pane h3 {
                margin: 16px 0 8px 0;
            }

            .wysiwyg-preview-pane p {
                margin: 8px 0;
            }

            .wysiwyg-preview-pane ul,
            .wysiwyg-preview-pane ol {
                margin: 8px 0;
                padding-left: 24px;
            }

            .wysiwyg-preview-pane a {
                color: #0066cc;
                text-decoration: underline;
            }
        `;

        document.head.appendChild(style);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = WYSIWYGEditor;
}

if (typeof window !== 'undefined') {
    window.WYSIWYGEditor = WYSIWYGEditor;
}
