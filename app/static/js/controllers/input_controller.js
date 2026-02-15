/**
 * Controller for handling input events (mouse, touch, keyboard)
 */
class InputController {
    constructor(canvas) {
        this.canvas = canvas;
        this.panMode = false;
        this.isDraggingStage = false;
        this.setupEvents();
    }

    setupEvents() {
        const stage = this.canvas.stage;

        // Zoom Handling
        stage.on('wheel', (e) => {
            e.evt.preventDefault();
            const oldScale = stage.scaleX();
            const pointer = stage.getPointerPosition();

            const mousePointTo = {
                x: (pointer.x - stage.x()) / oldScale,
                y: (pointer.y - stage.y()) / oldScale,
            };

            const slowZoom = e.evt.ctrlKey;
            const factor = 1.05;
            let newScale = e.evt.deltaY < 0 ?
                (slowZoom ? oldScale * 1.01 : oldScale * factor) :
                (slowZoom ? oldScale / 1.01 : oldScale / factor);

            // Constraints
            newScale = Math.max(0.05, Math.min(newScale, 5));

            stage.scale({ x: newScale, y: newScale });

            const newPos = {
                x: pointer.x - mousePointTo.x * newScale,
                y: pointer.y - mousePointTo.y * newScale,
            };
            stage.position(newPos);

            this.canvas.drawGrid();
            this.canvas.updateViewport();
        });

        // Pan and Box Selection
        stage.on('mousedown touchstart', (e) => {
            if (e.target !== stage) return;

            if (this.panMode || e.evt.button === 1 || e.evt.altKey) {
                this.isDraggingStage = true;
                stage.container().style.cursor = 'grabbing';
            } else {
                const pos = stage.getPointerPosition();
                const worldPos = this.canvas.screenToWorld(pos.x, pos.y);
                if (this.canvas.selectionController) {
                    this.canvas.selectionController.startBoxSelection(worldPos);
                }
            }
        });

        stage.on('mousemove touchmove', (e) => {
            if (this.isDraggingStage) {
                const dx = e.evt.movementX;
                const dy = e.evt.movementY;
                stage.x(stage.x() + dx);
                stage.y(stage.y() + dy);
                this.canvas.drawGrid();
                this.canvas.updateViewport();
                return;
            }

            if (this.canvas.selectionController?.selectionBox.active) {
                const pos = stage.getPointerPosition();
                const worldPos = this.canvas.screenToWorld(pos.x, pos.y);
                this.canvas.selectionController.updateBoxSelection(worldPos);
            }
        });

        stage.on('mouseup touchend', (e) => {
            this.isDraggingStage = false;
            stage.container().style.cursor = this.panMode ? 'grab' : 'default';

            if (this.canvas.selectionController?.selectionBox.active) {
                this.canvas.selectionController.finishBoxSelection(e.evt.shiftKey || e.evt.ctrlKey);
            }
        });

        // Keyboard Shortcuts
        window.addEventListener('keydown', (e) => {
            const isCopy = (e.ctrlKey || e.metaKey) && e.key === 'c';
            const isPaste = (e.ctrlKey || e.metaKey) && e.key === 'v';
            const isGroup = (e.ctrlKey || e.metaKey) && e.key === 'g';
            const isDelete = e.key === 'Delete' || e.key === 'Backspace';
            const isUndo = (e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey;
            const isRedo = (e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey));

            const isInput = ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName) || document.activeElement.isContentEditable;
            if (isInput && !isUndo && !isRedo) return;

            if (isCopy) {
                e.preventDefault();
                this.canvas.copySelected();
            } else if (isPaste) {
                e.preventDefault();
                this.canvas.paste();
            } else if (isGroup) {
                e.preventDefault();
                if (window.groupManager && this.canvas.selectionController?.selectedCards.size > 0) {
                    const cardIds = Array.from(this.canvas.selectionController.selectedCards);
                    const cardGroups = cardIds.map(id => this.canvas.layers.card.findOne('#card-' + id)).filter(c => c);
                    window.groupManager.createGroupAroundCards(cardGroups, cardIds);
                }
            } else if (isDelete) {
                if (this.canvas.selectionController?.selectedCards.size > 0 ||
                    this.canvas.selectionController?.selectedGroups.size > 0 ||
                    this.canvas.selectionController?.selectedEdges.size > 0) {
                    e.preventDefault();
                    this.canvas.deleteSelected();
                }
            } else if (isUndo) {
                e.preventDefault();
                if (window.undoManager) window.undoManager.undo();
            } else if (isRedo) {
                e.preventDefault();
                if (window.undoManager) window.undoManager.redo();
            } else if (e.key.toLowerCase() === 'p') {
                if (!isInput) this.togglePanMode();
            }
        });
    }

    togglePanMode() {
        this.panMode = !this.panMode;
        this.canvas.panMode = this.panMode; // Sync with legacy for now
        const mode = this.panMode ? 'PAN' : 'SELECT';
        this.canvas.stage.container().style.cursor = this.panMode ? 'grab' : 'default';
        console.log(`[MODE] Switched to ${mode} mode`);
    }
}

window.InputController = InputController;
