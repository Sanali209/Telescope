/**
 * Controller for handling card and group selection logic
 */
class SelectionController {
    constructor(canvas) {
        this.canvas = canvas;
        this.selectedCards = new Set();
        this.selectedGroups = new Set(); // Track selected groups
        this.selectedEdges = new Set(); // Track selected edges
        this.selectionBox = {
            rect: null,
            startPos: { x: 0, y: 0 },
            active: false
        };
    }

    /**
     * Select a card and show handles
     */
    selectCard(cardGroup, event = null) {
        const id = cardGroup.id();
        const cardId = id.replace('card-', '');

        // Check if Shift or Ctrl is pressed for multi-select
        const isMultiSelect = event && (event.evt.shiftKey || event.evt.ctrlKey || event.evt.metaKey);

        if (!isMultiSelect) {
            this.deselectAll();
        }

        // Add to selection
        this.selectedCards.add(cardId);
        cardGroup.setAttr('selected', true);

        // Selection indicator
        const bg = cardGroup.findOne('Rect');
        if (bg) {
            bg.stroke('#3b82f6');
            bg.strokeWidth(5);
            bg.shadowBlur(20);
            bg.shadowColor('rgba(59, 130, 246, 0.6)');
            bg.shadowOpacity(1);
        }

        // Show handles (only single selection)
        if (!isMultiSelect && window.cardResizer) {
            window.cardResizer.showHandles(cardGroup);
        }

        // Show anchors (only single selection)
        if (!isMultiSelect && window.connectionManager) {
            window.connectionManager.showAnchors(cardGroup);
        }

        this.canvas.layers.card.batchDraw();
    }

    /**
     * Select an edge and highlight it
     */
    selectEdge(edgeGroup, event = null) {
        const edgeId = edgeGroup.id().replace('edge-', '');
        const isMultiSelect = event && (event.evt.shiftKey || event.evt.ctrlKey || event.evt.metaKey);

        if (!isMultiSelect) {
            this.deselectAll();
        }

        this.selectedEdges.add(edgeId);
        edgeGroup.setAttr('selected', true);

        const arrow = edgeGroup.findOne('Arrow');
        if (arrow) {
            arrow.stroke('#3b82f6');
            arrow.strokeWidth(4);
            arrow.shadowBlur(10);
            arrow.shadowColor('#3b82f6');
        }

        const labelBg = edgeGroup.findOne('.label-group')?.findOne('Rect');
        if (labelBg) {
            labelBg.stroke('#3b82f6');
            labelBg.strokeWidth(2);
        }

        this.canvas.layers.edge.batchDraw();
    }

    /**
     * Deselect everything
     */
    deselectAll() {
        this.deselectAllCards();
        this.deselectAllGroups();
        this.deselectAllEdges();
    }

    /**
     * Deselect all cards
     */
    deselectAllCards() {
        this.selectedCards.clear();
        this.canvas.layers.card.find('Group').forEach(cardGroup => {
            if (cardGroup.getAttr('selected')) {
                cardGroup.setAttr('selected', false);
                const bg = cardGroup.findOne('Rect');
                if (bg) {
                    bg.stroke('#cbd5e1');
                    bg.strokeWidth(1);
                    bg.shadowBlur(8);
                    bg.shadowColor('rgba(0, 0, 0, 0.1)');
                    bg.shadowOpacity(1);
                }
            }
        });

        if (window.cardResizer) window.cardResizer.hideAllHandles();
        if (window.connectionManager) window.connectionManager.hideAllAnchors();
        this.canvas.layers.card.batchDraw();
    }

    /**
     * Select a group
     */
    selectGroup(groupKonva) {
        this.deselectAll();
        const id = groupKonva.nodeData.id;
        this.selectedGroups.add(id);
        const bg = groupKonva.findOne('.group-bg');
        const header = groupKonva.findOne('.group-header');
        if (bg && header) {
            bg.stroke('#3b82f6');
            bg.strokeWidth(3);
            header.opacity(0.7);
        }
        if (window.cardResizer) window.cardResizer.showGroupHandles(groupKonva);
        groupKonva.setAttr('selected', true);
        this.canvas.layers.group.batchDraw();
    }

    /**
     * Deselect all groups
     */
    deselectAllGroups() {
        this.selectedGroups.clear();
        this.canvas.layers.group.find('Group').forEach(group => {
            if (group.getAttr('selected')) {
                const bg = group.findOne('.group-bg');
                const header = group.findOne('.group-header');
                if (bg && header) {
                    bg.stroke('#9ca3af');
                    bg.strokeWidth(2);
                    header.opacity(0.5);
                }
                if (window.cardResizer) window.cardResizer.hideGroupHandles(group);
                group.setAttr('selected', false);
            }
        });
        this.canvas.layers.group.batchDraw();
    }

    /**
     * Deselect all edges
     */
    deselectAllEdges() {
        this.selectedEdges.clear();
        this.canvas.layers.edge.find('.edge-group').forEach(group => {
            if (group.getAttr('selected')) {
                group.setAttr('selected', false);
                const arrow = group.findOne('Arrow');
                const edgeData = group.attrs.edgeData;
                if (arrow) {
                    arrow.stroke(edgeData?.color || '#64748b');
                    arrow.strokeWidth(2);
                    arrow.shadowBlur(0);
                }
                const labelBg = group.findOne('.label-group')?.findOne('Rect');
                if (labelBg) {
                    labelBg.stroke('#e2e8f0');
                    labelBg.strokeWidth(1);
                }
            }
        });
        this.canvas.layers.edge.batchDraw();
    }

    /**
     * Box selection start
     */
    startBoxSelection(pos) {
        this.selectionBox.startPos = pos;
        this.selectionBox.active = true;
        const scale = this.canvas.stage.scaleX();
        this.selectionBox.rect = new Konva.Rect({
            x: pos.x,
            y: pos.y,
            width: 0,
            height: 0,
            fill: 'rgba(59, 130, 246, 0.1)',
            stroke: '#3b82f6',
            strokeWidth: 1 / scale,
            dash: [5 / scale, 5 / scale]
        });
        this.canvas.layers.ui.add(this.selectionBox.rect);
        this.canvas.layers.ui.batchDraw();
    }

    /**
     * Box selection update
     */
    updateBoxSelection(pos) {
        if (!this.selectionBox.active || !this.selectionBox.rect) return;
        const newX = Math.min(pos.x, this.selectionBox.startPos.x);
        const newY = Math.min(pos.y, this.selectionBox.startPos.y);
        const newWidth = Math.abs(pos.x - this.selectionBox.startPos.x);
        const newHeight = Math.abs(pos.y - this.selectionBox.startPos.y);
        this.selectionBox.rect.setAttrs({
            x: newX,
            y: newY,
            width: newWidth,
            height: newHeight
        });
        this.canvas.layers.ui.batchDraw();
    }

    /**
     * Box selection finish
     */
    finishBoxSelection(addToSelection) {
        if (!this.selectionBox.rect) return;
        const box = this.selectionBox.rect.getClientRect();
        this.selectionBox.rect.destroy();
        this.selectionBox.rect = null;
        this.selectionBox.active = false;
        this.canvas.layers.ui.batchDraw();

        if (box.width < 10 || box.height < 10) return;

        if (!addToSelection) this.deselectAllCards();

        this.canvas.layers.card.children.forEach(cardGroup => {
            if (!cardGroup.id || !cardGroup.id().startsWith('card-')) return;
            const cardBox = cardGroup.getClientRect();
            if (this.boxesIntersect(box, cardBox)) {
                const cardId = cardGroup.id().replace('card-', '');
                this.selectedCards.add(cardId);
                cardGroup.setAttr('selected', true);
                const bg = cardGroup.findOne('Rect');
                if (bg) {
                    bg.stroke('#3b82f6');
                    bg.strokeWidth(5);
                    bg.shadowBlur(10);
                    bg.shadowColor('#3b82f6');
                }
            }
        });
        this.canvas.layers.card.batchDraw();
    }

    /**
     * Check intersection
     */
    boxesIntersect(a, b) {
        return !(a.x + a.width < b.x || b.x + b.width < a.x || a.y + a.height < b.y || b.y + b.height < a.y);
    }
}

window.SelectionController = SelectionController;
