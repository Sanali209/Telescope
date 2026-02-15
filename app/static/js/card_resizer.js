/**
 * Card Resize Handler
 * Adds interactive resize handles to cards
 */

class CardResizer {
    constructor(canvas) {
        this.canvas = canvas;
        this.activeCard = null;
        this.activeHandle = null;
        this.handles = [];
    }

    addResizeHandles(cardGroup, nodeData) {
        console.log('[RESIZE-DEBUG] addResizeHandles for card:', nodeData.id);
        // Create 4 corner handles for resizing
        const handleSize = 8;
        const handlePositions = [
            { name: 'se', x: nodeData.width - handleSize, y: nodeData.height - handleSize, cursor: 'nwse-resize' }
        ];

        const handleGroup = new Konva.Group({
            name: 'resize-handles',
            visible: false // Hidden by default, show on selection
        });

        handlePositions.forEach(pos => {
            const handle = new Konva.Rect({
                x: pos.x,
                y: pos.y,
                width: handleSize,
                height: handleSize,
                fill: '#3b82f6',
                stroke: '#ffffff',
                strokeWidth: 2,
                name: pos.name,
                draggable: true,
                dragBoundFunc: function (pos) {
                    return pos; // Allow free movement
                }
            });

            handle.on('mouseenter', () => {
                document.body.style.cursor = pos.cursor;
            });

            handle.on('mouseleave', () => {
                document.body.style.cursor = 'default';
            });

            let startSize = null;

            handle.on('dragstart', () => {
                startSize = { width: nodeData.width, height: nodeData.height };
            });

            handle.on('dragmove', (e) => {
                this.handleResize(cardGroup, nodeData, pos.name, handle);
            });

            handle.on('dragend', () => {
                const newSize = { width: nodeData.width, height: nodeData.height };
                // Emit resize event
                this.canvas.emitEvent('card_resized', {
                    id: nodeData.id,
                    width: newSize.width,
                    height: newSize.height
                });

                // UndoManager tracking
                if (startSize && (startSize.width !== newSize.width || startSize.height !== newSize.height)) {
                    if (window.undoManager) {
                        window.undoManager.recordResize(nodeData.id, startSize, newSize);
                    }
                }
            });

            handleGroup.add(handle);
        });

        cardGroup.add(handleGroup);
        return handleGroup;
    }

    handleResize(cardGroup, nodeData, handleName, handle) {
        const pos = handle.position();

        // Get all card elements
        const bg = cardGroup.findOne('.bg');
        const handleRect = cardGroup.findOne('.drag-handle');
        const title = cardGroup.findOne('Text');

        // Find various content previews
        const textPreview = cardGroup.findOne('.text-preview');
        const filePreview = cardGroup.findOne('.file-preview');
        const fileIcon = cardGroup.findOne('.file-icon');
        const fileName = cardGroup.findOne('.file-name');

        // Calculate new dimensions based on handle position
        let newWidth = nodeData.width;
        let newHeight = nodeData.height;

        if (handleName === 'se') {
            // Southeast handle - simplest case
            newWidth = pos.x + handle.width();
            newHeight = pos.y + handle.height();
        }

        // Apply minimum dimensions
        newWidth = Math.max(200, newWidth);
        newHeight = Math.max(150, newHeight);

        // Update nodeData
        nodeData.width = newWidth;
        nodeData.height = newHeight;

        // Update visual elements
        if (bg) {
            bg.width(newWidth);
            bg.height(newHeight);
        }
        if (handleRect) handleRect.width(newWidth);
        if (title) title.width(newWidth - 40);

        // Update content previews
        if (textPreview) {
            textPreview.width(newWidth - 24);
            textPreview.height(newHeight - 60);
        }
        if (filePreview) {
            filePreview.width(newWidth - 10);
            filePreview.height(newHeight - 10);
        }
        if (fileIcon) {
            fileIcon.x(newWidth / 2 - 24);
            fileIcon.y(newHeight / 2 - 40);
        }
        if (fileName) {
            fileName.width(newWidth - 20);
            fileName.y(newHeight / 2 + 20);
        }

        // Update edit button position
        const editButton = cardGroup.findOne('.edit-button');
        if (editButton) {
            editButton.x(newWidth - 40);
        }

        // Update export button position
        const exportButton = cardGroup.findOne('.export-button');
        if (exportButton) {
            exportButton.x(newWidth - 75);
        }

        // Update portal button position
        const portalButton = cardGroup.findOne('.portal-button');
        if (portalButton) {
            portalButton.x(newWidth - 110);
        }

        // Update tags position
        const tags = cardGroup.findOne('.tags-container');
        if (tags) {
            tags.y(newHeight - 25);
        }

        // Update connection anchors
        if (window.connectionManager) {
            window.connectionManager.updateAnchors(cardGroup, nodeData);
        }

        // Keep this handle in place relative to mouse
        // (handle.position is already updated by Konva drag)

        // Update other handle positions (if any, though we only have one now)
        this.updateHandlePositions(cardGroup, newWidth, newHeight);

        this.canvas.layers.card.batchDraw();
    }

    updateHandlePositions(cardGroup, width, height) {
        const handleGroup = cardGroup.findOne('.resize-handles');
        if (!handleGroup) return;

        const handleSize = 8;
        const handles = {
            'nw': { x: 0, y: 0 },
            'ne': { x: width - handleSize, y: 0 },
            'sw': { x: 0, y: height - handleSize },
            'se': { x: width - handleSize, y: height - handleSize }
        };

        handleGroup.children.forEach(handle => {
            const name = handle.name();
            if (handles[name]) {
                handle.position(handles[name]);
            }
        });
    }

    showHandles(cardGroup) {
        console.log('[RESIZE-DEBUG] showHandles for:', cardGroup.id());
        const handleGroup = cardGroup.findOne('.resize-handles');
        if (handleGroup) {
            handleGroup.visible(true);
            this.canvas.layers.card.batchDraw();
            console.log('[RESIZE-DEBUG] Handles made VISIBLE');
        } else {
            console.warn('[RESIZE-DEBUG] NO handle group found in card!');
        }
    }

    hideHandles(cardGroup) {
        const handleGroup = cardGroup.findOne('.resize-handles');
        if (handleGroup) {
            handleGroup.visible(false);
            this.canvas.layers.card.batchDraw();
        }
    }

    hideAllHandles() {
        this.canvas.layers.card.find('.resize-handles').forEach(hg => {
            hg.visible(false);
        });
        this.canvas.layers.card.batchDraw();
    }

    /**
     * Add resize handles to a group (similar to cards)
     */
    addGroupResizeHandles(groupKonva, nodeData) {
        const handleSize = 8;
        const positions = ['se', 'sw', 'ne', 'nw'];

        const handleGroup = new Konva.Group({
            name: 'resize-handles',
            visible: false
        });

        positions.forEach(pos => {
            let x, y, cursor;

            switch (pos) {
                case 'se':
                    x = nodeData.width - handleSize / 2;
                    y = nodeData.height - handleSize / 2;
                    cursor = 'nwse-resize';
                    break;
                case 'sw':
                    x = 0 - handleSize / 2;
                    y = nodeData.height - handleSize / 2;
                    cursor = 'nesw-resize';
                    break;
                case 'ne':
                    x = nodeData.width - handleSize / 2;
                    y = 0 - handleSize / 2;
                    cursor = 'nesw-resize';
                    break;
                case 'nw':
                    x = 0 - handleSize / 2;
                    y = 0 - handleSize / 2;
                    cursor = 'nwse-resize';
                    break;
            }

            const handle = new Konva.Rect({
                x: x,
                y: y,
                width: handleSize,
                height: handleSize,
                fill: '#3b82f6',
                stroke: '#ffffff',
                strokeWidth: 1,
                name: pos,
                draggable: true
            });

            let startSize = null;
            handle.on('dragstart', () => {
                const bg = groupKonva.findOne('.group-bg');
                if (bg) {
                    startSize = { width: bg.width(), height: bg.height() };
                }
            });

            handle.on('mouseenter', () => {
                document.body.style.cursor = cursor;
            });

            handle.on('mouseleave', () => {
                document.body.style.cursor = 'default';
            });

            handle.on('dragmove', (e) => {
                e.cancelBubble = true;
                const bg = groupKonva.findOne('.group-bg');
                const header = groupKonva.findOne('.group-header');
                const label = groupKonva.findOne('Text');

                if (!bg || !header) return;

                const minWidth = 200;
                const minHeight = 150;
                const oldWidth = bg.width();
                const oldHeight = bg.height();
                let newWidth = oldWidth;
                let newHeight = oldHeight;

                const mousePos = groupKonva.getRelativePointerPosition();

                // Calculate new dimensions based on handle
                if (pos === 'se') {
                    newWidth = Math.max(minWidth, mousePos.x);
                    newHeight = Math.max(minHeight, mousePos.y);
                } else if (pos === 'sw') {
                    newWidth = Math.max(minWidth, oldWidth - mousePos.x);
                    newHeight = Math.max(minHeight, mousePos.y);
                } else if (pos === 'ne') {
                    newWidth = Math.max(minWidth, mousePos.x);
                    newHeight = Math.max(minHeight, oldHeight - mousePos.y);
                }

                // Update group shapes
                bg.width(newWidth);
                bg.height(newHeight);
                header.width(newWidth);
                label.width(newWidth - 20);

                // Update handle positions
                handleGroup.findOne('.se').position({
                    x: newWidth - handleSize / 2,
                    y: newHeight - handleSize / 2
                });
                handleGroup.findOne('.sw').position({
                    x: -handleSize / 2,
                    y: newHeight - handleSize / 2
                });
                handleGroup.findOne('.ne').position({
                    x: newWidth - handleSize / 2,
                    y: -handleSize / 2
                });

                this.canvas.layers.group.batchDraw();
            });

            handle.on('dragend', () => {
                const bg = groupKonva.findOne('.group-bg');
                if (bg) {
                    const newSize = { width: bg.width(), height: bg.height() };
                    this.canvas.emitEvent('group_resized', {
                        id: nodeData.id,
                        width: newSize.width,
                        height: newSize.height
                    });

                    // UndoManager tracking
                    if (startSize && (startSize.width !== newSize.width || startSize.height !== newSize.height)) {
                        if (window.undoManager) {
                            window.undoManager.recordResize(nodeData.id, startSize, newSize);
                        }
                    }
                }
            });

            handleGroup.add(handle);
        });

        groupKonva.add(handleGroup);
    }

    /**
     * Show resize handles for a group
     */
    showGroupHandles(groupKonva) {
        const handleGroup = groupKonva.findOne('.resize-handles');
        if (handleGroup) {
            handleGroup.visible(true);
            this.canvas.layers.group.batchDraw();
        }
    }

    /**
     * Hide resize handles for a group
     */
    hideGroupHandles(groupKonva) {
        const handleGroup = groupKonva.findOne('.resize-handles');
        if (handleGroup) {
            handleGroup.visible(false);
            this.canvas.layers.group.batchDraw();
        }
    }
}

// Export
window.CardResizer = CardResizer;
