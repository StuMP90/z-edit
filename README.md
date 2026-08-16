# WYSIWYG HTML Editor

A pure JavaScript WYSIWYG (What You See Is What You Get) HTML editor with no external dependencies. Perfect for embedding rich text editing capabilities into any web application.

## Features

- ✅ **Pure JavaScript** - No external dependencies required
- ✅ **Drag & Drop Images** - Simply drag images into the editor
- ✅ **Undo/Redo** - Full history support with keyboard shortcuts (Ctrl+Z / Ctrl+Y)
- ✅ **HTML Fragments & Full Documents** - Supports both partial content and complete HTML documents
- ✅ **Custom Templates** - Built-in templating system for dynamic content
- ✅ **Accessibility** - Full ARIA labels, roles, and keyboard navigation
- ✅ **Embeddable** - Works with textareas, inputs, or divs
- ✅ **Rich Formatting** - Bold, italic, underline, headings, lists, links, images, and more
- ✅ **List Indentation** - Indent and outdent list items for nested structures
- ✅ **Code Formatting** - Inline code and code block support with proper styling
- ✅ **Smart Paste** - Multi-line code is automatically formatted as code blocks
- ✅ **Keyboard Shortcuts** - Standard shortcuts for common operations
- ✅ **Code View** - Toggle between WYSIWYG and HTML code view

## Quick Start

### 1. Include the Script

```html
<script src="wysiwyg-editor.js"></script>
```

### 2. Create a Target Element

```html
<textarea id="my-editor"></textarea>
```

### 3. Initialize the Editor

```javascript
const editor = new WYSIWYGEditor({
    target: '#my-editor',
    placeholder: 'Start typing...'
});
```

That's it! Your editor is ready to use.

## Installation

Simply download `wysiwyg-editor.js` and include it in your HTML:

```html
<script src="path/to/wysiwyg-editor.js"></script>
```

Or use it as a module:

```javascript
import WYSIWYGEditor from './wysiwyg-editor.js';
```

## Configuration Options

```javascript
const editor = new WYSIWYGEditor({
    // Target element (required) - CSS selector or DOM element
    target: '#editor',
    
    // Show/hide toolbar (default: true)
    toolbar: true,
    
    // Customize toolbar buttons
    toolbarButtons: [
        'bold', 'italic', 'underline', 'strikethrough',
        '|',  // Separator
        'h1', 'h2', 'h3', 'p',
        '|',
        'ul', 'ol',
        '|',
        'indent', 'outdent',
        '|',
        'code-inline', 'code-block',
        '|',
        'link', 'image',
        '|',
        'align-left', 'align-center', 'align-right',
        '|',
        'undo', 'redo',
        '|',
        'code', 'split', 'clear'
    ],
    
    // Placeholder text
    placeholder: 'Start typing...',
    
    // Maximum undo/redo history size (default: 100)
    maxHistorySize: 100,
    
    // Custom image upload handler
    imageUploadHandler: (file, callback) => {
        // Upload to server and call callback with URL
        uploadToServer(file).then(url => callback(url));
    },
    
    // Content change callback
    onChange: (html) => {
        console.log('Content changed:', html);
    },
    
    // Image drop callback
    onImageDrop: (file, callback) => {
        // Handle dropped image
        callback(imageUrl);
    },
    
    // Custom templates for templating systems
    customTemplates: {
        'my-template': () => '<div>{{variable}}</div>',
        'another-template': '<span>{{name}}</span>'
    },
    
    // Allow full HTML documents (default: true)
    allowFullDocument: true,
    
    // Accessibility options
    ariaLabel: 'Rich text editor',
    ariaDescribedBy: 'editor-description'
});
```

## API Methods

### Content Management

```javascript
// Get HTML content
const html = editor.getHTML();

// Set HTML content
editor.setHTML('<p>Hello World</p>');

// Get full HTML document
const document = editor.getDocument();

// Set full HTML document
editor.setDocument('<!DOCTYPE html><html>...</html>');

// Insert HTML at cursor position
editor.insertHTML('<strong>Bold text</strong>');
```

### Template Management

```javascript
// Insert a custom template
editor.insertTemplate('my-template');
```

### History Management

```javascript
// Undo last change
editor.undo();

// Redo last undone change
editor.redo();
```

### Cleanup

```javascript
// Destroy editor and restore original element
editor.destroy();
```

## Usage Examples

### Basic Editor with Textarea

```html
<textarea id="editor1">
    <h2>Welcome!</h2>
    <p>Start editing...</p>
</textarea>

<script>
    const editor = new WYSIWYGEditor({
        target: '#editor1',
        onChange: (html) => {
            console.log('Content:', html);
        }
    });
</script>
```

### Editor with Custom Image Upload

```javascript
const editor = new WYSIWYGEditor({
    target: '#editor',
    onImageDrop: (file, callback) => {
        const formData = new FormData();
        formData.append('image', file);
        
        fetch('/api/upload', {
            method: 'POST',
            body: formData
        })
        .then(res => res.json())
        .then(data => callback(data.url))
        .catch(err => console.error('Upload failed:', err));
    }
});
```

### Editor with Custom Templates

```javascript
const editor = new WYSIWYGEditor({
    target: '#editor',
    customTemplates: {
        'user-card': () => {
            return `
                <div class="user-card">
                    <h3>{{user.name}}</h3>
                    <p>{{user.email}}</p>
                    <p>{{user.bio}}</p>
                </div>
            `;
        },
        'button': '<button class="btn">{{label}}</button>',
        'alert': () => '<div class="alert">{{message}}</div>'
    }
});

// Insert template
editor.insertTemplate('user-card');
```

### Form Integration

```html
<form id="myForm">
    <textarea id="content" name="content"></textarea>
    <button type="submit">Submit</button>
</form>

<script>
    const editor = new WYSIWYGEditor({
        target: '#content'
    });
    
    document.getElementById('myForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const html = editor.getHTML();
        // Submit html to server
        console.log('Submitting:', html);
    });
</script>
```

### Full Document Mode

```javascript
const editor = new WYSIWYGEditor({
    target: '#editor',
    allowFullDocument: true
});

// Load a complete HTML document
editor.setDocument(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>My Document</title>
</head>
<body>
    <h1>Document Content</h1>
    <p>This is a complete HTML document.</p>
</body>
</html>
`);

// Get the complete document back
const fullDoc = editor.getDocument();
```

## Keyboard Shortcuts

- **Ctrl+B** - Bold
- **Ctrl+I** - Italic
- **Ctrl+U** - Underline
- **Ctrl+Z** - Undo
- **Ctrl+Y** - Redo
- **Ctrl+Shift+Z** - Redo (alternative)

## Accessibility Features

The editor is built with accessibility in mind:

- **ARIA Labels** - All interactive elements have proper ARIA labels
- **ARIA Roles** - Correct roles for toolbar, buttons, and editor
- **Keyboard Navigation** - Full keyboard support for all features
- **Screen Reader Support** - Descriptive labels and live regions
- **Focus Management** - Proper focus indicators and management
- **Customizable ARIA** - Configure ARIA labels and descriptions

Example with accessibility options:

```html
<div id="editor-help">
    Use the toolbar to format your text. Press Tab to navigate between buttons.
</div>

<div id="editor"></div>

<script>
    const editor = new WYSIWYGEditor({
        target: '#editor',
        ariaLabel: 'Main content editor',
        ariaDescribedBy: 'editor-help'
    });
</script>
```

## Drag & Drop Images

Simply drag and drop images into the editor:

1. **Default Behavior** - Images are converted to base64 data URLs
2. **Custom Handler** - Use `onImageDrop` or `imageUploadHandler` to upload to your server

```javascript
const editor = new WYSIWYGEditor({
    target: '#editor',
    onImageDrop: (file, callback) => {
        // Upload file to your server
        uploadImage(file).then(url => {
            callback(url);  // Insert image with server URL
        });
    }
});
```

## Styling

The editor includes default styles, but you can customize them:

```css
/* Customize container */
.wysiwyg-container {
    border: 2px solid #0066cc;
    border-radius: 8px;
}

/* Customize toolbar */
.wysiwyg-toolbar {
    background: #f0f0f0;
}

/* Customize editor area */
.wysiwyg-editor {
    min-height: 300px;
    font-size: 16px;
    line-height: 1.6;
}

/* Customize buttons */
.wysiwyg-btn {
    background: #0066cc;
    color: white;
}

.wysiwyg-btn:hover {
    background: #0052a3;
}
```

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Opera (latest)

The editor uses standard web APIs and should work in all modern browsers.

## Advanced Features

### Custom Toolbar

Create a minimal toolbar with only the buttons you need:

```javascript
const editor = new WYSIWYGEditor({
    target: '#editor',
    toolbarButtons: ['bold', 'italic', '|', 'undo', 'redo']
});
```

### No Toolbar

Disable the toolbar completely for a minimal editor:

```javascript
const editor = new WYSIWYGEditor({
    target: '#editor',
    toolbar: false
});
```

### Code Formatting

The editor supports both inline code and code blocks:

```javascript
const editor = new WYSIWYGEditor({
    target: '#editor',
    toolbarButtons: [
        'bold', 'italic', 'code-inline', 'code-block', '|',
        'ul', 'ol', 'indent', 'outdent'
    ]
});
```

- **Inline Code**: Select text and click the inline code button to format it as `<code>` with styled appearance
- **Code Block**: Click the code block button to insert a `<pre><code>` block for multi-line code
- **Smart Paste**: When you paste multi-line content, it's automatically wrapped in a code block
- **Multi-line Selection**: Selecting multi-line text and clicking inline code automatically creates a code block

### List Indentation

Create nested lists with indent and outdent controls:

```javascript
const editor = new WYSIWYGEditor({
    target: '#editor',
    toolbarButtons: [
        'ul', 'ol', 'indent', 'outdent'
    ]
});
```

- Select list items and click indent (→) to nest them
- Click outdent (←) to reduce nesting level
- Works with both bullet lists and numbered lists

### Programmatic Content Insertion

```javascript
// Insert HTML at cursor
editor.insertHTML('<strong>Important!</strong>');

// Insert custom template
editor.insertTemplate('user-card');

// Set entire content
editor.setHTML('<h1>New Content</h1>');
```

## Security Considerations

When accepting user-generated HTML content:

1. **Sanitize Output** - Always sanitize HTML before displaying to other users
2. **XSS Prevention** - Use a library like DOMPurify to clean user content
3. **CSP Headers** - Implement Content Security Policy headers
4. **Validate Server-Side** - Never trust client-side validation alone

Example with DOMPurify:

```javascript
const editor = new WYSIWYGEditor({
    target: '#editor',
    onChange: (html) => {
        // Sanitize before saving
        const clean = DOMPurify.sanitize(html);
        saveToServer(clean);
    }
});
```

## License

This project is released as open source. Feel free to use, modify, and distribute as needed.

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## Demo

Open `demo.html` in your browser to see the editor in action with multiple examples and use cases.

## Support

For questions, issues, or feature requests, please open an issue on the project repository.
