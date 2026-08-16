/**
 * History Manager for z-edit Editor
 * Manages undo/redo functionality with state snapshots
 */

class HistoryManager {
    constructor(contentModel, maxHistorySize = 100) {
        this.contentModel = contentModel;
        this.maxHistorySize = maxHistorySize;
        this.undoStack = [];
        this.redoStack = [];
        this.currentSnapshot = null;
        this.isRecording = true;
        
        this._saveInitialSnapshot();
    }

    /**
     * Save initial snapshot
     */
    _saveInitialSnapshot() {
        this.currentSnapshot = this._createSnapshot();
    }

    /**
     * Create a snapshot of current state
     */
    _createSnapshot() {
        return {
            ops: JSON.parse(JSON.stringify(this.contentModel.ops)),
            selection: null // Will be set when saving
        };
    }

    /**
     * Save current state to history
     */
    save(selection = null) {
        if (!this.isRecording) return;
        
        const snapshot = this._createSnapshot();
        snapshot.selection = selection;
        
        // Always save if undo stack is empty (first save)
        // Otherwise only save if different from current
        if (this.undoStack.length === 0 || this._isDifferent(snapshot)) {
            this.undoStack.push(this.currentSnapshot);
            this.redoStack = []; // Clear redo stack on new action
            
            // Limit stack size
            if (this.undoStack.length > this.maxHistorySize) {
                this.undoStack.shift();
            }
            
            this.currentSnapshot = snapshot;
        }
    }

    /**
     * Check if snapshot is different from current
     */
    _isDifferent(snapshot) {
        if (!this.currentSnapshot) return true;
        
        const currentOps = JSON.stringify(this.currentSnapshot.ops);
        const newOps = JSON.stringify(snapshot.ops);
        
        return currentOps !== newOps;
    }

    /**
     * Undo last action
     */
    undo() {
        if (this.undoStack.length === 0) return null;
        
        this.isRecording = false;
        
        // Save current state to redo stack
        this.redoStack.push(this.currentSnapshot);
        
        // Restore previous state
        const previousSnapshot = this.undoStack.pop();
        this._restoreSnapshot(previousSnapshot);
        this.currentSnapshot = previousSnapshot;
        
        this.isRecording = true;
        
        return previousSnapshot.selection;
    }

    /**
     * Redo last undone action
     */
    redo() {
        if (this.redoStack.length === 0) return null;
        
        this.isRecording = false;
        
        // Save current state to undo stack
        this.undoStack.push(this.currentSnapshot);
        
        // Restore next state
        const nextSnapshot = this.redoStack.pop();
        this._restoreSnapshot(nextSnapshot);
        this.currentSnapshot = nextSnapshot;
        
        this.isRecording = true;
        
        return nextSnapshot.selection;
    }

    /**
     * Restore snapshot to content model
     */
    _restoreSnapshot(snapshot) {
        this.contentModel.ops = JSON.parse(JSON.stringify(snapshot.ops));
    }

    /**
     * Check if undo is available
     */
    canUndo() {
        return this.undoStack.length > 0;
    }

    /**
     * Check if redo is available
     */
    canRedo() {
        return this.redoStack.length > 0;
    }

    /**
     * Get undo stack size
     */
    getUndoCount() {
        return this.undoStack.length;
    }

    /**
     * Get redo stack size
     */
    getRedoCount() {
        return this.redoStack.length;
    }

    /**
     * Clear all history
     */
    clear() {
        this.undoStack = [];
        this.redoStack = [];
        this.currentSnapshot = this._createSnapshot();
    }

    /**
     * Start recording (for batch operations)
     */
    startRecording() {
        this.isRecording = true;
    }

    /**
     * Stop recording (for batch operations)
     */
    stopRecording() {
        this.isRecording = false;
    }

    /**
     * Save a checkpoint (for batch operations)
     */
    saveCheckpoint(selection = null) {
        const snapshot = this._createSnapshot();
        snapshot.selection = selection;
        this.currentSnapshot = snapshot;
    }

    /**
     * Get current state as JSON
     */
    getCurrentState() {
        return JSON.stringify(this.currentSnapshot);
    }

    /**
     * Load state from JSON
     */
    loadState(json) {
        const snapshot = JSON.parse(json);
        this._restoreSnapshot(snapshot);
        this.currentSnapshot = snapshot;
        this.undoStack = [];
        this.redoStack = [];
    }

    /**
     * Merge consecutive similar operations (optimization)
     */
    _mergeOperations() {
        // This would merge consecutive text insertions or similar operations
        // to reduce history stack size
        // Implementation depends on specific use cases
    }

    /**
     * Get history statistics
     */
    getStats() {
        return {
            undoCount: this.undoStack.length,
            redoCount: this.redoStack.length,
            maxHistorySize: this.maxHistorySize,
            isRecording: this.isRecording
        };
    }

    /**
     * Set maximum history size
     */
    setMaxHistorySize(size) {
        this.maxHistorySize = size;
        
        // Trim stacks if necessary
        while (this.undoStack.length > this.maxHistorySize) {
            this.undoStack.shift();
        }
        while (this.redoStack.length > this.maxHistorySize) {
            this.redoStack.shift();
        }
    }

    /**
     * Compress history (remove intermediate states)
     */
    compress() {
        // Keep only every Nth state to reduce memory usage
        const compressionFactor = 2;
        
        const compressedUndo = [];
        for (let i = 0; i < this.undoStack.length; i += compressionFactor) {
            compressedUndo.push(this.undoStack[i]);
        }
        // Always keep the most recent state
        if (this.undoStack.length > 0) {
            compressedUndo.push(this.undoStack[this.undoStack.length - 1]);
        }
        
        this.undoStack = compressedUndo;
        
        const compressedRedo = [];
        for (let i = 0; i < this.redoStack.length; i += compressionFactor) {
            compressedRedo.push(this.redoStack[i]);
        }
        if (this.redoStack.length > 0) {
            compressedRedo.push(this.redoStack[this.redoStack.length - 1]);
        }
        
        this.redoStack = compressedRedo;
    }

    /**
     * Clean up resources
     */
    destroy() {
        this.contentModel = null;
        this.undoStack = [];
        this.redoStack = [];
        this.currentSnapshot = null;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = HistoryManager;
}
