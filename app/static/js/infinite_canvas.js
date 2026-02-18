/**
 * Core Orchestrator for the Infinite Canvas
 */
class InfiniteCanvas {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.stage = new Konva.Stage({
            container: containerId,
            width: this.container.clientWidth,
            height: this.container.clientHeight,
            draggable: false
        });

        this.layers = {
            grid: new Konva.Layer(),
            group: new Konva.Layer(),
            edge: new Konva.Layer(),
            card: new Konva.Layer(),
            ui: new Konva.Layer()
        };

        Object.values(this.layers).forEach(layer => this.stage.add(layer));

        // State
        this.selectedCards = new Set();
        this.panMode = false;
        this.currentFilter = '';
        this.edgeMap = new Map(); // cardId -> Set of edge groups

        // Controllers
        this.selectionController = new SelectionController(this);
        this.renderingController = new RenderingController(this);
        this.inputController = new InputController(this);

        this.drawGrid();
        window.addEventListener('resize', () => this.handleResize());
    }

    // --- Delegation Methods ---
    drawGrid() { this.renderingController.drawGrid(); }
    renderTextCard(nodeData, group) { this.renderingController.renderTextCard(nodeData, group); }
    renderFileCard(nodeData, group) { this.renderingController.renderFileCard(nodeData, group); }
    renderTags(nodeData, group) { this.renderingController.renderTags(nodeData, group); }

    addGroup(nodeData) {
        const groupKonva = this.renderingController.addGroup(nodeData);
        this.layers.group.add(groupKonva);
        this._setupGroupEvents(groupKonva, nodeData);
        if (window.groupManager) window.groupManager.registerGroup(groupKonva, nodeData);
        if (window.cardResizer) window.cardResizer.addGroupResizeHandles(groupKonva, nodeData);
        this.layers.group.batchDraw();
        return groupKonva;
    }

    addEdge(edgeData, fromNode, toNode) {
        const edgeGroup = this.renderingController.addEdge(edgeData, fromNode, toNode);
        this.layers.edge.add(edgeGroup);

        // Register in O(1) edge map
        if (!this.edgeMap.has(edgeData.fromNode)) this.edgeMap.set(edgeData.fromNode, new Set());
        if (!this.edgeMap.has(edgeData.toNode)) this.edgeMap.set(edgeData.toNode, new Set());
        this.edgeMap.get(edgeData.fromNode).add(edgeGroup);
        this.edgeMap.get(edgeData.toNode).add(edgeGroup);

        this._setupEdgeEvents(edgeGroup, edgeData);
        this.layers.edge.batchDraw();
        return edgeGroup;
    }

    _setupEdgeEvents(group, edgeData) {
        group.on('click tap', (e) => {
            e.cancelBubble = true;
            this.selectionController.selectEdge(group, e);
        });

        // Ensure the arrow and label group also trigger selection
        const arrow = group.findOne('Arrow');
        if (arrow) {
            arrow.on('click tap', (e) => {
                e.cancelBubble = true;
                this.selectionController.selectEdge(group, e);
            });
        }
    }

    extractTitle(text) { return this.renderingController.extractTitle(text); }
    extractPreview(text) { return this.renderingController.extractPreview(text); }

    selectCard(cardGroup, event = null) { this.selectionController.selectCard(cardGroup, event); }
    deselectAllCards() { this.selectionController.deselectAllCards(); }
    selectGroup(groupKonva) { this.selectionController.selectGroup(groupKonva); }
    deselectAllGroups() { this.selectionController.deselectAllGroups(); }

    togglePanMode() { this.inputController.togglePanMode(); }

    emitEvent(eventName, data) {
        // Bridge to NiceGUI backend handlers
        if (typeof emitEvent !== 'undefined') {
            emitEvent(`${eventName}_backend`, data);
        }
        // Local CustomEvent for other JS components
        window.dispatchEvent(new CustomEvent(`canvas_${eventName}`, { detail: data }));
    }

    // --- Core Canvas Operations ---
    addCard(nodeData) {
        const group = new Konva.Group({
            x: nodeData.x, y: nodeData.y,
            draggable: true, id: `card-${nodeData.id}`, name: 'card-group'
        });
        group.nodeData = nodeData;

        if (nodeData.type === 'file') this.renderFileCard(nodeData, group);
        else this.renderTextCard(nodeData, group);

        this._setupCardEvents(group, nodeData);
        this.layers.card.add(group);
        this.layers.card.batchDraw();
        return group;
    }

    _setupCardEvents(group, nodeData) {
        let dragStartPos = null;
        group.on('dragstart', () => {
            dragStartPos = { x: group.x(), y: group.y() };
            group.moveToTop();
            group.clearCache(); // Uncache during interaction
        });

        group.on('dragmove', () => {
            this.updateConnectedEdges(nodeData.id);
            if (window.groupManager) window.groupManager.onCardDragMove(group);
        });

        group.on('dragend', () => {
            const pos = group.position();
            this.emitEvent('card_moved', { id: nodeData.id, x: pos.x, y: pos.y });

            // Sync local state
            nodeData.x = pos.x;
            nodeData.y = pos.y;

            if (window.undoManager) window.undoManager.recordMove(nodeData.id, dragStartPos, pos);
            if (window.groupManager) window.groupManager.onCardDrop(nodeData.id, group);

            // Re-cache after interaction
            setTimeout(() => this.renderingController.cacheItem(group), 0);
        });

        group.on('click tap', (e) => {
            if (group.isDragging() || e.target.getParent()?.name() === 'edit-button') return;
            this.selectCard(group, e);
        });

        group.on('dblclick dbltap', (e) => {
            if (nodeData.type === 'file' || e.target.getParent()?.name() === 'edit-button') return;
            group.clearCache(); // Must clear for editing
            this.emitEvent('card_dblclick', { id: nodeData.id, text: nodeData.text || '', tags: nodeData.tags || [] });
        });
    }

    toggleGroupCollapse(groupId, collapsed) {
        const group = this.layers.group.findOne('#group-' + groupId);
        if (!group) return;
        group.setAttr('collapsed', collapsed);
        const groupInfo = window.groupManager?.groups.get(groupId);
        if (groupInfo) {
            groupInfo.members.forEach(cardId => {
                const card = this.layers.card.findOne('#card-' + cardId);
                if (card) card.visible(!collapsed);
            });
        }
        const arrow = group.findOne('.collapse-arrow');
        if (arrow) arrow.text(collapsed ? '▶' : '▼');

        const bg = group.findOne('.group-bg');
        if (bg) {
            bg.height(collapsed ? 36 : group.nodeData.height);
        }

        this.layers.group.batchDraw();
        this.layers.card.batchDraw();
    }

    // --- Coordinate Transforms ---
    screenToWorld(screenX, screenY) {
        const scale = this.stage.scaleX();
        const offset = this.stage.position();
        return { x: (screenX - offset.x) / scale, y: (screenY - offset.y) / scale };
    }

    worldToScreen(worldX, worldY) {
        const scale = this.stage.scaleX();
        const offset = this.stage.position();
        return { x: (worldX * scale) + offset.x, y: (worldY * scale) + offset.y };
    }

    // --- Utilities ---
    updateViewport() {
        const pos = this.stage.position();
        const scale = this.stage.scaleX();

        // Immediate local logic (grid, culling)
        this.drawGrid();
        this.updateVisibility();

        // Throttled backend sync
        if (this._viewportTimeout) clearTimeout(this._viewportTimeout);
        this._viewportTimeout = setTimeout(() => {
            this.emitEvent('viewport_changed', { x: pos.x, y: pos.y, scale: scale });
        }, 100);
    }

    updateVisibility() {
        const stage = this.stage;
        const scale = stage.scaleX();
        const pos = stage.position();

        const viewport = {
            x1: -pos.x / scale - 500,
            y1: -pos.y / scale - 500,
            x2: (-pos.x + stage.width()) / scale + 500,
            y2: (-pos.y + stage.height()) / scale + 500
        };

        // Cull cards
        this.layers.card.getChildren().forEach(card => {
            const x = card.x();
            const y = card.y();
            const isVisible = x > viewport.x1 && x < viewport.x2 && y > viewport.y1 && y < viewport.y2;
            if (card.visible() !== isVisible) {
                card.visible(isVisible);
            }
        });

        // Cull edges (optional but recommended for large sets)
        this.layers.edge.getChildren().forEach(edge => {
            const edgeData = edge.attrs.edgeData;
            if (!edgeData) return;
            // Simple visibility based on endpoints (could be more precise)
            const fromCard = this.layers.card.findOne(`#card-${edgeData.fromNode}`) || this.layers.group.findOne(`#group-${edgeData.fromNode}`);
            const isVisible = fromCard ? fromCard.visible() : true;
            if (edge.visible() !== isVisible) edge.visible(isVisible);
        });

        this.layers.card.batchDraw();
        this.layers.edge.batchDraw();
    }

    _setupGroupEvents(group, nodeData) {
        group.on('dragstart', () => {
            group.moveToTop();
            group.clearCache();
        });
        group.on('dragmove', () => {
            const pos = group.position();
            this.updateConnectedEdges(nodeData.id);
            if (window.groupManager) window.groupManager.onGroupDragMove(group);
        });
        group.on('dragend', () => {
            const pos = group.position();
            this.emitEvent('group_moved', { id: nodeData.id, x: pos.x, y: pos.y });

            // Update local state for member delta calculation
            const dx = pos.x - nodeData.x;
            const dy = pos.y - nodeData.y;
            nodeData.x = pos.x;
            nodeData.y = pos.y;

            // Sync member nodeData as well
            const groupInfo = window.groupManager?.groups.get(nodeData.id);
            if (groupInfo) {
                groupInfo.members.forEach(cardId => {
                    const card = this.layers.card.findOne('#card-' + cardId);
                    if (card && card.nodeData) {
                        card.nodeData.x += dx;
                        card.nodeData.y += dy;
                    }
                });
            }

            // Re-cache group
            setTimeout(() => this.renderingController.cacheItem(group), 0);
        });
        group.on('click tap', (e) => {
            if (group.isDragging()) return;
            this.selectGroup(group);
        });
    }

    handleResize() {
        this.stage.width(this.container.clientWidth);
        this.stage.height(this.container.clientHeight);
        this.drawGrid();
    }

    updateConnectedEdges(cardId) {
        const edgeGroups = this.edgeMap.get(cardId);
        if (!edgeGroups) return;

        edgeGroups.forEach(group => {
            const edgeData = group.attrs.edgeData;
            if (!edgeData) return;

            const fromCard = this.layers.card.findOne(`#card-${edgeData.fromNode}`) || this.layers.group.findOne(`#group-${edgeData.fromNode}`);
            const toCard = this.layers.card.findOne(`#card-${edgeData.toNode}`) || this.layers.group.findOne(`#group-${edgeData.toNode}`);

            if (fromCard && toCard) {
                const fromPos = fromCard.position();
                const toPos = toCard.position();
                const fromBg = fromCard.findOne('Rect');
                const toBg = toCard.findOne('Rect');

                const fromNodeData = {
                    x: fromPos.x, y: fromPos.y,
                    width: fromBg ? fromBg.width() : 300,
                    height: fromBg ? fromBg.height() : 200
                };
                const toNodeData = {
                    x: toPos.x, y: toPos.y,
                    width: toBg ? toBg.width() : 300,
                    height: toBg ? toBg.height() : 200
                };

                const bestSides = this.getNearestSides(fromNodeData, toNodeData);
                const fromAnchor = this.getAnchorPosition(fromNodeData, bestSides.fromSide);
                const toAnchor = this.getAnchorPosition(toNodeData, bestSides.toSide);
                const points = this.calculateManhattanPoints(fromAnchor, toAnchor, bestSides.fromSide, bestSides.toSide);

                const arrow = group.findOne('Arrow');
                if (arrow) arrow.points(points);
                const labelGroup = group.findOne('.label-group');
                if (labelGroup) {
                    const midPoint = this.getManhattanMidpoint(points);
                    labelGroup.position(midPoint);
                }
            }
        });
        this.layers.edge.batchDraw();
    }

    getAnchorPosition(nodeData, side) {
        const positions = {
            top: { x: nodeData.x + nodeData.width / 2, y: nodeData.y },
            right: { x: nodeData.x + nodeData.width, y: nodeData.y + nodeData.height / 2 },
            bottom: { x: nodeData.x + nodeData.width / 2, y: nodeData.y + nodeData.height },
            left: { x: nodeData.x, y: nodeData.y + nodeData.height / 2 }
        };
        return positions[side] || positions.right;
    }

    getNearestSides(fromNode, toNode) {
        const sides = ['top', 'bottom', 'left', 'right'];
        let minOffset = Infinity;
        let bestSides = { fromSide: 'right', toSide: 'left' };
        sides.forEach(s1 => {
            const p1 = this.getAnchorPosition(fromNode, s1);
            sides.forEach(s2 => {
                const p2 = this.getAnchorPosition(toNode, s2);
                const dist = Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
                if (dist < minOffset) {
                    minOffset = dist;
                    bestSides = { fromSide: s1, toSide: s2 };
                }
            });
        });
        return bestSides;
    }

    calculateManhattanPoints(start, end, fromSide, toSide) {
        const points = [start.x, start.y];
        const offset = 30;
        let p1 = { x: start.x, y: start.y };
        if (fromSide === 'right') p1.x += offset;
        else if (fromSide === 'left') p1.x -= offset;
        else if (fromSide === 'top') p1.y -= offset;
        else if (fromSide === 'bottom') p1.y += offset;
        let p2 = { x: end.x, y: end.y };
        if (toSide === 'right') p2.x += offset;
        else if (toSide === 'left') p2.x -= offset;
        else if (toSide === 'top') p2.y -= offset;
        else if (toSide === 'bottom') p2.y += offset;
        points.push(p1.x, p1.y);
        if (fromSide === 'left' || fromSide === 'right') {
            if ((fromSide === 'right' && p2.x > p1.x) || (fromSide === 'left' && p2.x < p1.x)) {
                points.push(p1.x, p2.y);
            } else {
                const midY = (p1.y + p2.y) / 2;
                points.push(p1.x, midY);
                points.push(p2.x, midY);
            }
        } else {
            if ((fromSide === 'bottom' && p2.y > p1.y) || (fromSide === 'top' && p2.y < p1.y)) {
                points.push(p2.x, p1.y);
            } else {
                const midX = (p1.x + p2.x) / 2;
                points.push(midX, p1.y);
                points.push(midX, p2.y);
            }
        }
        points.push(p2.x, p2.y);
        points.push(end.x, end.y);
        return points;
    }

    getManhattanMidpoint(points) {
        if (points.length >= 8) {
            return { x: (points[4] + points[6]) / 2, y: (points[5] + points[7]) / 2 };
        }
        return { x: (points[0] + points[points.length - 2]) / 2, y: (points[1] + points[points.length - 1]) / 2 };
    }

    // Modes & Zoom
    zoomIn() { this.stage.scale({ x: this.stage.scaleX() * 1.2, y: this.stage.scaleY() * 1.2 }); this.drawGrid(); this.updateViewport(); }
    zoomOut() { this.stage.scale({ x: this.stage.scaleX() / 1.2, y: this.stage.scaleY() / 1.2 }); this.drawGrid(); this.updateViewport(); }
    resetView() { this.stage.position({ x: 0, y: 0 }).scale({ x: 1, y: 1 }); this.drawGrid(); this.updateViewport(); }

    copySelected() {
        if (!this.selectionController || this.selectionController.selectedCards.size === 0) return;

        const nodesToCopy = [];
        const selectedIds = Array.from(this.selectionController.selectedCards);

        selectedIds.forEach(id => {
            const card = this.layers.card.findOne('#card-' + id);
            if (card && card.nodeData) nodesToCopy.push(card.nodeData);
        });

        const edgesToCopy = [];
        this.layers.edge.find('.edge-group').forEach(group => {
            const edge = group.attrs.edgeData;
            if (edge && selectedIds.includes(edge.fromNode) && selectedIds.includes(edge.toNode)) {
                edgesToCopy.push(edge);
            }
        });

        localStorage.setItem('whiteboard_clipboard', JSON.stringify({ nodes: nodesToCopy, edges: edgesToCopy }));
        if (window.showToast) window.showToast(`Copied ${nodesToCopy.length} cards`, 'success');
    }

    paste() {
        const raw = localStorage.getItem('whiteboard_clipboard');
        if (!raw) return;
        const data = JSON.parse(raw);
        const stagePos = this.stage.getPointerPosition() || { x: 100, y: 100 };
        const worldPos = this.screenToWorld(stagePos.x, stagePos.y);

        const idMap = {};
        const newNodes = data.nodes.map(n => {
            const newId = crypto.randomUUID();
            idMap[n.id] = newId;
            return { ...n, id: newId, x: n.x + 50, y: n.y + 50 };
        });

        const newEdges = data.edges.map(e => ({
            ...e, id: crypto.randomUUID(), fromNode: idMap[e.fromNode], toNode: idMap[e.toNode]
        })).filter(e => e.fromNode && e.toNode);

        newNodes.forEach(n => this.addCard(n));
        newEdges.forEach(e => { if (window.connectionManager) window.connectionManager.renderEdge(e); });

        this.emitEvent('paste_nodes', { nodes: newNodes, edges: newEdges });
    }

    deleteSelected() {
        if (!this.selectionController) return;
        const cardIds = Array.from(this.selectionController.selectedCards);
        const groupIds = Array.from(this.selectionController.selectedGroups);
        const edgeIds = Array.from(this.selectionController.selectedEdges);

        if (cardIds.length === 0 && groupIds.length === 0 && edgeIds.length === 0) return;

        // Emit delete events
        if (cardIds.length > 0) this.emitEvent('delete_nodes', { nodeIds: cardIds });
        if (groupIds.length > 0) this.emitEvent('delete_nodes', { nodeIds: groupIds });
        if (edgeIds.length > 0) this.emitEvent('delete_edges', { edgeIds: edgeIds });

        // Remove cards from canvas
        cardIds.forEach(id => {
            const card = this.layers.card.findOne('#card-' + id);
            if (card) card.destroy();
            this.layers.edge.find('.edge-group').forEach(group => {
                const edge = group.attrs.edgeData;
                if (edge && (edge.fromNode === id || edge.toNode === id)) group.destroy();
            });
        });

        // Remove groups from canvas
        groupIds.forEach(id => {
            const groupKonva = this.layers.group.findOne('#group-' + id);
            if (groupKonva) {
                groupKonva.destroy();
                // Find and remove any edges connected to this group
                this.layers.edge.find('.edge-group').forEach(edgeGroup => {
                    const edge = edgeGroup.attrs.edgeData;
                    if (edge && (edge.fromNode === id || edge.toNode === id)) edgeGroup.destroy();
                });
            }
        });

        // Remove selected edges from canvas
        edgeIds.forEach(id => {
            const edgeGroup = this.layers.edge.findOne('#edge-' + id);
            if (edgeGroup) edgeGroup.destroy();
        });

        this.selectionController.deselectAll();
        this.layers.card.batchDraw();
        this.layers.group.batchDraw();
        this.layers.edge.batchDraw();
    }

    // --- Search & Filter ---
    filterNodes(query) {
        this.currentFilter = query;
        const lowerQuery = query.toLowerCase();

        this.layers.card.getChildren().forEach(group => {
            if (group.name() !== 'card-group') return;
            const node = group.nodeData;
            if (!node) return;

            const textMatch = (node.text || '').toLowerCase().includes(lowerQuery);
            const tagMatch = (node.tags || []).some(tag => tag.toLowerCase().includes(lowerQuery));
            const fileMatch = (node.file || '').toLowerCase().includes(lowerQuery);

            const isVisible = textMatch || tagMatch || fileMatch;

            // Animate opacity for better UX
            group.to({
                opacity: isVisible ? 1 : 0.1,
                duration: 0.2,
                onFinish: () => {
                    group.visible(isVisible || query === ''); // If query empty, ensure visible
                    group.listening(isVisible); // Disable interaction if hidden
                }
            });
        });
    }

    filterByTag(tag) {
        this.currentFilter = tag;
        this.layers.card.getChildren().forEach(group => {
            if (group.name() !== 'card-group') return;
            const node = group.nodeData;
            if (!node) return;

            const hasTag = (node.tags || []).includes(tag);

            group.to({
                opacity: hasTag ? 1 : 0.1,
                duration: 0.2,
                onFinish: () => {
                    group.visible(hasTag);
                    group.listening(hasTag);
                }
            });
        });
    }

    clearFilters() {
        this.currentFilter = '';
        this.layers.card.getChildren().forEach(group => {
            if (group.name() !== 'card-group') return;
            group.visible(true);
            group.listening(true);
            group.to({ opacity: 1, duration: 0.2 });
        });
    }
}

window.InfiniteCanvas = InfiniteCanvas;
