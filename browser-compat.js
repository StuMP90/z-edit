/**
 * Cross-Browser Compatibility Layer for z-edit Editor
 * Normalizes browser-specific behaviors and provides polyfills
 */

class BrowserCompat {
    constructor() {
        this.browser = this._detectBrowser();
        this.features = this._detectFeatures();
    }

    /**
     * Detect current browser
     */
    _detectBrowser() {
        const ua = navigator.userAgent.toLowerCase();
        
        if (ua.includes('chrome') && !ua.includes('edg')) {
            return 'chrome';
        } else if (ua.includes('safari') && !ua.includes('chrome')) {
            return 'safari';
        } else if (ua.includes('firefox')) {
            return 'firefox';
        } else if (ua.includes('edg')) {
            return 'edge';
        } else if (ua.includes('trident') || ua.includes('msie')) {
            return 'ie';
        }
        
        return 'unknown';
    }

    /**
     * Detect feature support
     */
    _detectFeatures() {
        return {
            inputEvents: 'InputEvent' in window,
            beforeInput: 'beforeinput' in window,
            selection: !!window.getSelection,
            range: !!document.createRange,
            contentEditable: 'contentEditable' in document.documentElement,
            clipboard: !!navigator.clipboard,
            execCommand: !!document.execCommand
        };
    }

    /**
     * Normalize selection API
     */
    normalizeSelection(selection) {
        if (!selection) return null;

        // Safari sometimes returns null for getRangeAt
        if (selection.rangeCount === 0) {
            return null;
        }

        const range = selection.getRangeAt(0);
        
        // Normalize range for different browsers
        return this._normalizeRange(range);
    }

    /**
     * Normalize range object
     */
    _normalizeRange(range) {
        if (!range) return null;

        // Some browsers have issues with collapsed ranges
        if (range.collapsed && range.startContainer !== range.endContainer) {
            const newRange = document.createRange();
            newRange.setStart(range.startContainer, range.startOffset);
            newRange.collapse(true);
            return newRange;
        }

        return range;
    }

    /**
     * Safe range creation
     */
    createRange() {
        try {
            return document.createRange();
        } catch (e) {
            console.warn('Range creation failed:', e);
            return null;
        }
    }

    /**
     * Safe selection restoration
     */
    restoreSelection(range) {
        if (!range) return false;

        try {
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
            return true;
        } catch (e) {
            console.warn('Selection restoration failed:', e);
            return false;
        }
    }

    /**
     * Normalize clipboard data
     */
    normalizeClipboardData(event) {
        const data = {
            text: '',
            html: '',
            files: []
        };

        try {
            // Try standard clipboard API
            if (event.clipboardData) {
                data.text = event.clipboardData.getData('text/plain') || '';
                data.html = event.clipboardData.getData('text/html') || '';
                
                const items = event.clipboardData.items;
                if (items) {
                    for (let i = 0; i < items.length; i++) {
                        if (items[i].type.indexOf('image') !== -1) {
                            const file = items[i].getAsFile();
                            if (file) {
                                data.files.push(file);
                            }
                        }
                    }
                }
            }
        } catch (e) {
            console.warn('Clipboard data normalization failed:', e);
        }

        return data;
    }

    /**
     * Safe clipboard write
     */
    writeToClipboard(data) {
        return new Promise((resolve, reject) => {
            try {
                if (navigator.clipboard && navigator.clipboard.write) {
                    const clipboardItem = new ClipboardItem({
                        'text/plain': new Blob([data.text], { type: 'text/plain' }),
                        'text/html': new Blob([data.html], { type: 'text/html' })
                    });
                    navigator.clipboard.write([clipboardItem])
                        .then(() => resolve(true))
                        .catch(() => reject(false));
                } else {
                    // Fallback for older browsers
                    resolve(false);
                }
            } catch (e) {
                reject(false);
            }
        });
    }

    /**
     * Normalize input event
     */
    normalizeInputEvent(event) {
        const normalized = {
            type: event.inputType,
            data: event.data || '',
            targetRanges: []
        };

        // Safari doesn't always provide targetRanges
        if (event.getTargetRanges) {
            try {
                normalized.targetRanges = event.getTargetRanges();
            } catch (e) {
                // Ignore errors
            }
        }

        return normalized;
    }

    /**
     * Check if beforeinput is supported
     */
    supportsBeforeInput() {
        return this.features.beforeInput && this.browser !== 'safari';
    }

    /**
     * Get fallback for beforeinput
     */
    getBeforeInputFallback() {
        // For browsers that don't support beforeinput
        return {
            textInput: 'textInput',
            keyPress: 'keypress'
        };
    }

    /**
     * Normalize contentEditable behavior
     */
    normalizeContentEditable(element) {
        // Fix for Firefox contentEditable issues
        if (this.browser === 'firefox') {
            element.setAttribute('contenteditable', 'true');
            element.setAttribute('spellcheck', 'false');
        }

        // Fix for Safari contentEditable issues
        if (this.browser === 'safari') {
            element.style.webkitUserModify = 'read-write-plaintext-only';
        }

        // Fix for IE/Edge contentEditable issues
        if (this.browser === 'ie' || this.browser === 'edge') {
            element.setAttribute('contenteditable', 'true');
            element.style.outline = 'none';
        }
    }

    /**
     * Handle browser-specific quirks
     */
    handleBrowserQuirks(element) {
        // Firefox: Prevent automatic link detection
        if (this.browser === 'firefox') {
            element.addEventListener('click', (e) => {
                if (e.target.tagName === 'A') {
                    e.preventDefault();
                }
            });
        }

        // Safari: Handle touch events properly
        if (this.browser === 'safari') {
            element.style.webkitUserSelect = 'text';
        }

        // Chrome: Handle spell check
        if (this.browser === 'chrome') {
            element.setAttribute('spellcheck', 'false');
        }
    }

    /**
     * Normalize key events
     */
    normalizeKeyEvent(event) {
        const normalized = {
            key: event.key,
            code: event.code,
            ctrlKey: event.ctrlKey || event.metaKey,
            shiftKey: event.shiftKey,
            altKey: event.altKey,
            metaKey: event.metaKey
        };

        // Normalize key names across browsers
        if (normalized.key === 'Enter' && event.keyCode === 13) {
            normalized.key = 'Enter';
        }
        if (normalized.key === 'Backspace' && event.keyCode === 8) {
            normalized.key = 'Backspace';
        }
        if (normalized.key === 'Delete' && event.keyCode === 46) {
            normalized.key = 'Delete';
        }

        return normalized;
    }

    /**
     * Get browser-specific CSS fixes
     */
    getCSSFixes() {
        const fixes = [];

        if (this.browser === 'firefox') {
            fixes.push(`
                .wysiwyg-editor {
                    -moz-user-select: text;
                }
            `);
        }

        if (this.browser === 'safari') {
            fixes.push(`
                .wysiwyg-editor {
                    -webkit-user-select: text;
                    -webkit-user-modify: read-write-plaintext-only;
                }
            `);
        }

        if (this.browser === 'ie' || this.browser === 'edge') {
            fixes.push(`
                .wysiwyg-editor {
                    -ms-user-select: text;
                    user-select: text;
                }
            `);
        }

        return fixes.join('\n');
    }

    /**
     * Check if feature is supported
     */
    supports(feature) {
        return this.features[feature] || false;
    }

    /**
     * Get browser info
     */
    getBrowserInfo() {
        return {
            name: this.browser,
            userAgent: navigator.userAgent,
            features: this.features
        };
    }

    /**
     * Polyfill missing features
     */
    polyfill() {
        // Polyfill for missing InputEvent
        if (!this.features.inputEvents) {
            this._polyfillInputEvent();
        }

        // Polyfill for missing beforeinput
        if (!this.features.beforeInput) {
            this._polyfillBeforeInput();
        }
    }

    /**
     * Polyfill InputEvent
     */
    _polyfillInputEvent() {
        // Basic polyfill for browsers without InputEvent support
        if (typeof window.InputEvent === 'undefined') {
            window.InputEvent = function(type, bubbles, cancelable) {
                const event = document.createEvent('Event');
                event.initEvent(type, bubbles, cancelable);
                return event;
            };
        }
    }

    /**
     * Polyfill beforeinput
     */
    _polyfillBeforeInput() {
        // This is a simplified polyfill - full implementation would be more complex
        const CustomEvent = window.CustomEvent || function(type, params) {
            const event = document.createEvent('CustomEvent');
            event.initCustomEvent(type, params.bubbles, params.cancelable, params.detail);
            return event;
        };

        if (!window.BeforeInputEvent) {
            window.BeforeInputEvent = CustomEvent;
        }
    }

    /**
     * Debounce function for performance
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Throttle function for performance
     */
    throttle(func, limit) {
        let inThrottle;
        return function executedFunction(...args) {
            if (!inThrottle) {
                func(...args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    /**
     * Request animation frame with fallback
     */
    requestAnimationFrame(callback) {
        return window.requestAnimationFrame ||
               window.webkitRequestAnimationFrame ||
               window.mozRequestAnimationFrame ||
               function(callback) {
                   return setTimeout(callback, 16);
               };
    }

    /**
     * Cancel animation frame with fallback
     */
    cancelAnimationFrame(id) {
        return window.cancelAnimationFrame ||
               window.webkitCancelAnimationFrame ||
               window.mozCancelAnimationFrame ||
               clearTimeout(id);
    }

    /**
     * Clean up resources
     */
    destroy() {
        // Clean up any browser-specific resources
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = BrowserCompat;
}
