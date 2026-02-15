/**
 * Connection Manager
 * Handles connection anchors and edge creation between cards
 */

class ConnectionManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.anchors = new Map(); // cardId -> anchor group
        this.dragState = null; // { fromCardId, fromSide, startPos, previewLine }
    }

    /**
     * Add connection anchors to a card
     */
    addAnchors(cardGroup, nodeData) {
        console.log('[CONNECTION] Adding anchors to card:', nodeData.id);

        const anchorGroup = new Konva.Group({
            name: 'connection-anchors',
            visible: false // Hidden by default, show on selection
        });

        const anchorSize = 20; // Much larger for touch screens
        const offset = 20; // Distance from card edge
        const anchorPositions = [
            { side: 'top', x: nodeData.width / 2 - anchorSize / 2, y: -offset - anchorSize / 2 },
            { side: 'right', x: nodeData.width + offset - anchorSize / 2, y: nodeData.height / 2 - anchorSize / 2 },
            { side: 'bottom', x: nodeData.width / 2 - anchorSize / 2, y: nodeData.height + offset - anchorSize / 2 },
            { side: 'left', x: -offset - anchorSize / 2, y: nodeData.height / 2 - anchorSize / 2 }
        ];

        anchorPositions.forEach(pos => {
            const anchor = new Konva.Circle({
                x: pos.x + anchorSize / 2,
                y: pos.y + anchorSize / 2,
                radius: anchorSize / 2,
                fill: '#3b82f6',
                stroke: '#ffffff',
                strokeWidth: 2,
                name: pos.side,
                draggable: false,
                // IMPORTANT: Larger hit area for touch screens
                hitStrokeWidth: 20
            });

            // Hover effects - more pronounced for touch screens
            anchor.on('mouseenter touchstart', () => {
                anchor.radius(anchorSize / 2 + 3);
                anchor.fill('#2563eb');
                anchor.shadowBlur(10);
                anchor.shadowColor('#3b82f6');
                document.body.style.cursor = 'crosshair';
                this.canvas.layers.card.batchDraw();
            });

            anchor.on('mouseleave', () => {
                anchor.radius(anchorSize / 2);
                anchor.fill('#3b82f6');
                anchor.shadowBlur(0);
                document.body.style.cursor = 'default';
                this.canvas.layers.card.batchDraw();
            });

            // Start connection drag
            anchor.on('mousedown', (e) => {
                console.log('[CONNECTION-DEBUG] Mousedown on anchor:', pos.side);

                // CRITICAL: Stop all event propagation
                e.cancelBubble = true;
                if (e.evt) {
                    e.evt.stopPropagation();
                    e.evt.stopImmediatePropagation();
                    e.evt.preventDefault();
                }

                // Disable card dragging temporarily
                if (cardGroup) {
                    cardGroup.draggable(false);
                    console.log('[CONNECTION-DEBUG] Disabled card dragging');
                }

                this.startConnectionDrag(nodeData.id, pos.side, cardGroup, anchor, e);
            });

            anchorGroup.add(anchor);
        });

        cardGroup.add(anchorGroup);
        this.anchors.set(nodeData.id, anchorGroup);

        return anchorGroup;
    }

    /**
     * Update anchor positions when card is resized
     */
    updateAnchors(cardGroup, nodeData) {
        const anchorGroup = cardGroup.findOne('.connection-anchors');
        if (!anchorGroup) return;

        const anchorSize = 20;
        const offset = 20;
        const width = nodeData.width;
        const height = nodeData.height;

        const positions = {
            top: { x: width / 2, y: -offset },
            right: { x: width + offset, y: height / 2 },
            bottom: { x: width / 2, y: height + offset },
            left: { x: -offset, y: height / 2 }
        };

        anchorGroup.children.forEach(anchor => {
            const side = anchor.name();
            if (positions[side]) {
                anchor.position(positions[side]);
            }
        });
    }

    /**
     * Start dragging to create a connection
     */
    startConnectionDrag(fromCardId, fromSide, cardGroup, anchor, event) {
        console.log('[CONNECTION] Starting drag from:', fromCardId, fromSide);

        // Get card world position and dimensions
        const cardPos = cardGroup.position();
        const cardBg = cardGroup.findOne('Rect');
        const cardWidth = cardBg ? cardBg.width() : 200;
        const cardHeight = cardBg ? cardBg.height() : 150;

        // Calculate anchor position in world coordinates (same as edges use)
        // This matches the getAnchorPosition logic in infinite_canvas.js
        const anchorWorldPos = this.getAnchorWorldPosition(cardPos.x, cardPos.y, cardWidth, cardHeight, fromSide);

        console.log('[CONNECTION] Card position:', cardPos);
        console.log('[CONNECTION] Anchor world position:', anchorWorldPos);
        console.log('[CONNECTION] Stage scale:', this.canvas.stage.scaleX());

        // Create preview line using world coordinates (like edges)
        const previewLine = new Konva.Arrow({
            points: [anchorWorldPos.x, anchorWorldPos.y, anchorWorldPos.x, anchorWorldPos.y],
            stroke: '#3b82f6',
            strokeWidth: 2,
            dash: [5, 5],
            pointerLength: 10,
            pointerWidth: 8,
            opacity: 0.7,
            listening: false
        });

        this.canvas.layers.edge.add(previewLine);
        this.canvas.layers.edge.batchDraw();

        this.dragState = {
            fromCardId,
            fromSide,
            startPos: anchorWorldPos,
            previewLine,
            fromAnchor: anchor,
            cardGroup: cardGroup
        };

        this.canvas.stage.on('mousemove.connection', (e) => {
            this.updateConnectionDrag(e);
        });

        this.canvas.stage.on('mouseup.connection', (e) => {
            this.endConnectionDrag(e);
        });
    }

    /**
     * Get anchor position in world coordinates
     */
    getAnchorWorldPosition(cardX, cardY, cardWidth, cardHeight, side) {
        const positions = {
            top: { x: cardX + cardWidth / 2, y: cardY },
            right: { x: cardX + cardWidth, y: cardY + cardHeight / 2 },
            bottom: { x: cardX + cardWidth / 2, y: cardY + cardHeight },
            left: { x: cardX, y: cardY + cardHeight / 2 }
        };
        return positions[side] || positions.right;
    }

    /**
     * Update preview line during drag
     */
    updateConnectionDrag(e) {
        if (!this.dragState) return;

        // Get pointer position in screen coordinates
        const screenPos = this.canvas.stage.getPointerPosition();

        // Transform to world coordinates
        const scale = this.canvas.stage.scaleX();
        const offset = this.canvas.stage.position();
        const worldPos = {
            x: (screenPos.x - offset.x) / scale,
            y: (screenPos.y - offset.y) / scale
        };

        const { fromSide, startPos, previewLine } = this.dragState;

        // Determine a likely toSide based on movement direction
        const dx = worldPos.x - startPos.x;
        const dy = worldPos.y - startPos.y;
        let toSide = 'left';
        if (Math.abs(dx) > Math.abs(dy)) {
            toSide = dx > 0 ? 'left' : 'right';
        } else {
            toSide = dy > 0 ? 'top' : 'bottom';
        }

        // Use Manhattan points for preview
        const points = this.canvas.calculateManhattanPoints(
            startPos,
            worldPos,
            fromSide,
            toSide
        );

        previewLine.points(points);
        this.canvas.layers.edge.batchDraw();
    }

    /**
     * End connection drag and create edge if dropped on valid target
     */
    endConnectionDrag(e) {
        if (!this.dragState) return;

        console.log('[CONNECTION] Ending connection drag');

        const { fromCardId, fromSide, previewLine, cardGroup } = this.dragState;

        // Re-enable card dragging
        if (cardGroup) {
            cardGroup.draggable(true);
            console.log('[CONNECTION-DEBUG] Re-enabled card dragging');
        }

        // Remove preview line
        previewLine.destroy();
        this.canvas.layers.edge.batchDraw();

        // Find target card at drop position
        const pos = this.canvas.stage.getPointerPosition();
        const targetShape = this.canvas.stage.getIntersection(pos);

        if (targetShape) {
            // Find the card group this shape belongs to
            let targetCard = targetShape;
            while (targetCard && !targetCard.id()?.startsWith('card-')) {
                targetCard = targetCard.getParent();
            }

            if (targetCard && targetCard.id()?.startsWith('card-')) {
                const toCardId = targetCard.id().replace('card-', '');

                // Don't connect to self
                if (toCardId !== fromCardId) {
                    // Determine which side of target card is closest
                    const toSide = this.getClosestSide(targetCard, pos);

                    console.log('[CONNECTION] Creating edge:', fromCardId, '->', toCardId);
                    this.createEdge(fromCardId, fromSide, toCardId, toSide);
                }
            }
        }

        // Cleanup
        this.canvas.stage.off('mousemove.connection');
        this.canvas.stage.off('mouseup.connection');
        this.dragState = null;
    }

    /**
     * Get closest anchor side of a card to a point
     */
    getClosestSide(cardGroup, point) {
        const cardPos = cardGroup.position();
        const cardBounds = cardGroup.getClientRect();

        // Calculate distances to each side
        const distances = {
            top: Math.abs(point.y - cardBounds.y),
            bottom: Math.abs(point.y - (cardBounds.y + cardBounds.height)),
            left: Math.abs(point.x - cardBounds.x),
            right: Math.abs(point.x - (cardBounds.x + cardBounds.width))
        };

        // Return side with minimum distance
        return Object.keys(distances).reduce((a, b) =>
            distances[a] < distances[b] ? a : b
        );
    }

    /**
     * Create an edge in the database and render it
     */
    createEdge(fromCardId, fromSide, toCardId, toSide) {
        // Check for duplicate connections
        if (this.edgeExists(fromCardId, toCardId)) {
            console.log('[CONNECTION] Edge already exists between', fromCardId, 'and', toCardId);
            return;
        }

        console.log('[CONNECTION] Creating new edge:', fromCardId, '->', toCardId);

        // Emit event to backend to create edge
        this.canvas.emitEvent('edge_create', {
            fromNode: fromCardId,
            toNode: toCardId,
            fromSide,
            toSide,
            color: '#64748b'
        });
    }

    /**
     * Check if an edge already exists between two cards (in either direction)
     */
    edgeExists(cardId1, cardId2) {
        const edges = this.canvas.layers.edge.find('.edge-group');

        for (let group of edges) {
            const edgeData = group.attrs.edgeData;
            if (edgeData) {
                // Check both directions
                if ((edgeData.fromNode === cardId1 && edgeData.toNode === cardId2) ||
                    (edgeData.fromNode === cardId2 && edgeData.toNode === cardId1)) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Show anchors for a card
     */
    showAnchors(cardGroup) {
        const cardId = cardGroup.id().replace('card-', '');
        const anchorGroup = this.anchors.get(cardId);

        if (anchorGroup) {
            console.log('[CONNECTION] Showing anchors for:', cardId);
            anchorGroup.visible(true);
            this.canvas.layers.card.batchDraw();
        }
    }

    /**
     * Hide anchors for a card
     */
    hideAnchors(cardGroup) {
        const cardId = cardGroup.id().replace('card-', '');
        const anchorGroup = this.anchors.get(cardId);

        if (anchorGroup) {
            anchorGroup.visible(false);
            this.canvas.layers.card.batchDraw();
        }
    }

    /**
     * Hide all anchors
     */
    hideAllAnchors() {
        this.anchors.forEach(anchorGroup => {
            anchorGroup.visible(false);
        });
        this.canvas.layers.card.batchDraw();
    }
}

// Export
window.ConnectionManager = ConnectionManager;
