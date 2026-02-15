/**
 * UndoManager - Command pattern history stack for canvas actions
 * Supports Cmd+Z (undo) and Cmd+Shift+Z (redo)
 */
class UndoManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.undoStack = [];
        this.redoStack = [];
        this.maxHistory = 50;
        this.isUndoing = false; // Prevent recording during undo/redo

        console.log('[UNDO] UndoManager initialized');
    }

    /**
     * Record an action to the history stack
     * @param {Object} action - { type, description, undo(), redo() }
     */
    push(action) {
        if (this.isUndoing) return; // Don't record actions triggered by undo/redo

        this.undoStack.push(action);
        this.redoStack = []; // Clear redo stack on new action

        // Trim to max history
        if (this.undoStack.length > this.maxHistory) {
            this.undoStack.shift();
        }

        console.log(`[UNDO] Recorded: ${action.type} - "${action.description}" (stack: ${this.undoStack.length})`);
        this.updateUI();
    }

    /**
     * Undo the last action
     */
    undo() {
        if (!this.canUndo()) {
            console.log('[UNDO] Nothing to undo');
            this.showToast('Nothing to undo', 'warning');
            return;
        }

        this.isUndoing = true;
        const action = this.undoStack.pop();

        try {
            console.log(`[UNDO] Undoing: ${action.type} - "${action.description}"`);
            action.undo();
            this.redoStack.push(action);
            this.showToast(`Undo: ${action.description}`, 'info');
        } catch (err) {
            console.error('[UNDO] Error during undo:', err);
            this.showToast('Undo failed', 'error');
        }

        this.isUndoing = false;
        this.updateUI();
    }

    /**
     * Redo the last undone action
     */
    redo() {
        if (!this.canRedo()) {
            console.log('[UNDO] Nothing to redo');
            this.showToast('Nothing to redo', 'warning');
            return;
        }

        this.isUndoing = true;
        const action = this.redoStack.pop();

        try {
            console.log(`[UNDO] Redoing: ${action.type} - "${action.description}"`);
            action.redo();
            this.undoStack.push(action);
            this.showToast(`Redo: ${action.description}`, 'info');
        } catch (err) {
            console.error('[UNDO] Error during redo:', err);
            this.showToast('Redo failed', 'error');
        }

        this.isUndoing = false;
        this.updateUI();
    }

    canUndo() { return this.undoStack.length > 0; }
    canRedo() { return this.redoStack.length > 0; }

    /**
     * Update toolbar button states
     */
    updateUI() {
        const undoBtn = document.getElementById('undo-btn');
        const redoBtn = document.getElementById('redo-btn');
        if (undoBtn) undoBtn.style.opacity = this.canUndo() ? '1' : '0.35';
        if (redoBtn) redoBtn.style.opacity = this.canRedo() ? '1' : '0.35';
    }

    // ─── Action Creators ────────────────────────────────────────────

    /**
     * Record a creation event
     */
    recordCreate(nodeDataArray, edgeDataArray = []) {
        const canvas = this.canvas;
        const nodeSnapshots = nodeDataArray.map(d => ({ ...d }));
        const edgeSnapshots = edgeDataArray.map(e => ({ ...e }));
        const nodeIds = nodeSnapshots.map(d => d.id);
        const edgeIds = edgeSnapshots.map(e => e.id);

        this.push({
            type: 'node_create',
            description: `Create ${nodeSnapshots.length + edgeSnapshots.length} item(s)`,
            undo() {
                // Delete created nodes
                nodeIds.forEach(id => {
                    const card = canvas.layers.card.findOne('#card-' + id);
                    const group = canvas.layers.group.findOne('#group-' + id);
                    if (card) card.destroy();
                    if (group) group.destroy();
                });
                // Delete created edges
                edgeIds.forEach(id => {
                    const edge = canvas.layers.edge.findOne('#edge-' + id);
                    if (edge) edge.destroy();
                });

                emitEvent('delete_nodes_backend', { nodeIds: nodeIds });
                canvas.layers.card.batchDraw();
                canvas.layers.group.batchDraw();
                canvas.layers.edge.batchDraw();
            },
            redo() {
                // Restore nodes
                nodeSnapshots.forEach(data => {
                    emitEvent('restore_node_backend', { nodeData: data });
                    if (data.type === 'group') {
                        canvas.addGroup(data);
                    } else {
                        canvas.addCard(data);
                    }
                });
                // Restore edges
                edgeSnapshots.forEach(data => {
                    emitEvent('restore_edge_backend', { edgeData: data });
                    const fromNode = canvas.layers.card.findOne('#card-' + data.fromNode) ||
                        canvas.layers.group.findOne('#group-' + data.fromNode);
                    const toNode = canvas.layers.card.findOne('#card-' + data.toNode) ||
                        canvas.layers.group.findOne('#group-' + data.toNode);
                    if (fromNode && toNode) {
                        canvas.addEdge(data, fromNode, toNode);
                    }
                });
                canvas.layers.card.batchDraw();
                canvas.layers.group.batchDraw();
                canvas.layers.edge.batchDraw();
            }
        });
    }

    /**
     * Record a card move
     */
    recordMove(cardId, oldPos, newPos) {
        const canvas = this.canvas;
        this.push({
            type: 'card_move',
            description: 'Move card',
            undo() {
                const card = canvas.layers.card.findOne('#card-' + cardId) ||
                    canvas.layers.group.findOne('#group-' + cardId);
                if (card) {
                    card.position(oldPos);
                    canvas.layers.card.batchDraw();
                    canvas.layers.group.batchDraw();
                    // Persist to backend
                    emitEvent('card_moved_backend', { id: cardId, x: oldPos.x, y: oldPos.y });
                }
            },
            redo() {
                const card = canvas.layers.card.findOne('#card-' + cardId) ||
                    canvas.layers.group.findOne('#group-' + cardId);
                if (card) {
                    card.position(newPos);
                    canvas.layers.card.batchDraw();
                    canvas.layers.group.batchDraw();
                    emitEvent('card_moved_backend', { id: cardId, x: newPos.x, y: newPos.y });
                }
            }
        });
    }

    /**
     * Record a card resize
     */
    recordResize(cardId, oldSize, newSize) {
        const canvas = this.canvas;
        this.push({
            type: 'card_resize',
            description: 'Resize card',
            undo() {
                emitEvent('card_resized_backend', { id: cardId, width: oldSize.width, height: oldSize.height });
                // Visual update - destroy and re-add would be complex,
                // so we just emit to backend and let it handle the re-render
                const card = canvas.layers.card.findOne('#card-' + cardId);
                if (card && card.nodeData) {
                    card.nodeData.width = oldSize.width;
                    card.nodeData.height = oldSize.height;
                    card.destroy();
                    canvas.addCard(card.nodeData);
                }
            },
            redo() {
                emitEvent('card_resized_backend', { id: cardId, width: newSize.width, height: newSize.height });
                const card = canvas.layers.card.findOne('#card-' + cardId);
                if (card && card.nodeData) {
                    card.nodeData.width = newSize.width;
                    card.nodeData.height = newSize.height;
                    card.destroy();
                    canvas.addCard(card.nodeData);
                }
            }
        });
    }

    /**
     * Record a card content edit
     */
    recordEdit(cardId, oldText, newText, oldTags, newTags, oldColor, newColor) {
        this.push({
            type: 'card_edit',
            description: 'Edit card',
            undo() {
                window.dispatchEvent(new CustomEvent('card_content_saved', {
                    detail: { id: cardId, content: oldText, tags: oldTags || [], color: oldColor }
                }));
            },
            redo() {
                window.dispatchEvent(new CustomEvent('card_content_saved', {
                    detail: { id: cardId, content: newText, tags: newTags || [], color: newColor }
                }));
            }
        });
    }

    /**
     * Record a card deletion (for restore)
     */
    recordDelete(nodeDataArray, edgeDataArray = []) {
        const canvas = this.canvas;
        const nodeSnapshots = nodeDataArray.map(d => ({ ...d }));
        const edgeSnapshots = edgeDataArray.map(e => ({ ...e }));

        this.push({
            type: 'node_delete',
            description: `Delete ${nodeSnapshots.length} item(s)`,
            undo() {
                // 1. Restore Nodes
                nodeSnapshots.forEach(data => {
                    emitEvent('restore_node_backend', { nodeData: data });
                    if (data.type === 'group') {
                        canvas.addGroup(data);
                    } else {
                        canvas.addCard(data);
                    }
                });

                // 2. Restore Edges
                edgeSnapshots.forEach(data => {
                    emitEvent('restore_edge_backend', { edgeData: data });
                    const fromNode = canvas.layers.card.findOne('#card-' + data.fromNode) ||
                        canvas.layers.group.findOne('#group-' + data.fromNode);
                    const toNode = canvas.layers.card.findOne('#card-' + data.toNode) ||
                        canvas.layers.group.findOne('#group-' + data.toNode);

                    if (fromNode && toNode) {
                        canvas.addEdge(data, fromNode, toNode);
                    }
                });

                canvas.layers.card.batchDraw();
                canvas.layers.group.batchDraw();
                canvas.layers.edge.batchDraw();
            },
            redo() {
                // Delete again
                const allIds = nodeSnapshots.map(d => d.id);
                allIds.forEach(id => {
                    const card = canvas.layers.card.findOne('#card-' + id);
                    const group = canvas.layers.group.findOne('#group-' + id);
                    if (card) card.destroy();
                    if (group) group.destroy();
                });

                edgeSnapshots.forEach(ed => {
                    const edgeObj = canvas.layers.edge.findOne('#edge-' + ed.id);
                    if (edgeObj) edgeObj.destroy();
                });

                emitEvent('delete_nodes_backend', { nodeIds: allIds });
                canvas.layers.card.batchDraw();
                canvas.layers.group.batchDraw();
                canvas.layers.edge.batchDraw();
            }
        });
    }

    /**
     * Show a toast notification
     */
    showToast(message, type = 'info') {
        if (window.showToast) {
            window.showToast(message, type);
        }
    }
}

// Export
window.UndoManager = UndoManager;
