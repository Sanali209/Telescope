/**
 * Controller for handling Konva component rendering and styling
 */
class RenderingController {
    constructor(canvas) {
        this.canvas = canvas;
    }

    /**
     * Draw the background grid using a pattern for maximum performance
     */
    drawGrid() {
        const stage = this.canvas.stage;
        const layer = this.canvas.layers.grid;

        // Only draw once if not already present
        if (layer.getChildren().length > 0) {
            const gridRect = layer.findOne('Rect');
            if (gridRect) {
                const scale = stage.scaleX();
                const pos = stage.position();
                gridRect.width(stage.width() / scale + 100);
                gridRect.height(stage.height() / scale + 100);
                gridRect.x(-pos.x / scale - 50);
                gridRect.y(-pos.y / scale - 50);
                gridRect.fillPatternOffset({ x: -pos.x / scale, y: -pos.y / scale });
            }
            return;
        }

        const size = 50;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(size, 0);
        ctx.moveTo(0, 0);
        ctx.lineTo(0, size);
        ctx.stroke();

        const gridRect = new Konva.Rect({
            x: -10000, y: -10000,
            width: 20000, height: 20000,
            fillPatternImage: canvas,
            fillPatternRepeat: 'repeat',
            listening: false,
            perfectDrawEnabled: false,
            shadowForStrokeEnabled: false
        });

        layer.add(gridRect);
        layer.batchDraw();
    }

    renderTextCard(nodeData, group) {
        // Background rectangle
        const bg = new Konva.Rect({
            width: nodeData.width,
            height: nodeData.height,
            fill: nodeData.color || '#ffffff',
            stroke: '#cbd5e1',
            strokeWidth: 1,
            shadowBlur: 8,
            shadowColor: 'rgba(0,0,0,0.15)',
            shadowOffset: { x: 0, y: 2 },
            cornerRadius: 8,
            name: 'bg',
            perfectDrawEnabled: false,
            shadowForStrokeEnabled: false
        });

        // Drag handle
        const handle = new Konva.Rect({
            width: nodeData.width,
            height: 40,
            fill: '#f1f5f9',
            cornerRadius: [8, 8, 0, 0],
            name: 'drag-handle',
            perfectDrawEnabled: false
        });

        // Title text
        const title = new Konva.Text({
            text: nodeData.title || this.extractTitle(nodeData.text),
            fontSize: 15,
            fontStyle: 'bold',
            padding: 12,
            width: nodeData.width - 40,
            fill: '#0f172a',
            ellipsis: true
        });

        // Edit button
        const editButton = new Konva.Group({
            x: nodeData.width - 40,
            y: 6,
            name: 'edit-button'
        });

        const editBg = new Konva.Rect({
            width: 32,
            height: 28,
            fill: 'transparent',
            cornerRadius: 4
        });

        const editIcon = new Konva.Text({
            text: '✎',
            fontSize: 18,
            x: 7,
            y: 5,
            fill: '#64748b'
        });

        editButton.add(editBg);
        editButton.add(editIcon);

        editButton.on('mousedown touchstart', (e) => { e.cancelBubble = true; });
        editButton.on('click tap', (e) => {
            e.cancelBubble = true;
            this.canvas.emitEvent('card_dblclick', {
                id: nodeData.id,
                text: nodeData.text || '',
                tags: nodeData.tags || []
            });
        });

        editButton.on('mouseenter', () => {
            editBg.fill('#e2e8f0');
            editIcon.fill('#1e293b');
            document.body.style.cursor = 'pointer';
            this.canvas.layers.card.batchDraw();
        });

        editButton.on('mouseleave', () => {
            editBg.fill('transparent');
            editIcon.fill('#64748b');
            document.body.style.cursor = 'default';
            this.canvas.layers.card.batchDraw();
        });

        // Content preview
        const preview = new Konva.Text({
            text: nodeData.preview || this.extractPreview(nodeData.text),
            fontSize: 13,
            y: 50,
            padding: 12,
            width: nodeData.width - 24,
            height: nodeData.height - 60,
            fill: '#475569',
            lineHeight: 1.5,
            wrap: 'word',
            ellipsis: true,
            name: 'text-preview'
        });

        group.add(bg);
        group.add(handle);
        group.add(title);
        group.add(preview);
        group.add(editButton);

        // Sub-whiteboard Portal Button (Left of Export Button)
        const hasSubBoard = !!nodeData.sub_whiteboard_id;
        const portalButton = new Konva.Group({
            x: nodeData.width - 110, // Shifted left
            y: 6,
            name: 'portal-button'
        });

        const portalBg = new Konva.Rect({
            width: 32,
            height: 28,
            fill: 'transparent',
            cornerRadius: 4
        });

        const portalIcon = new Konva.Text({
            text: hasSubBoard ? '↗' : '❖',
            fontSize: 18,
            x: 7,
            y: 5,
            fill: hasSubBoard ? '#3b82f6' : '#cbd5e1'
        });

        portalButton.add(portalBg);
        portalButton.add(portalIcon);

        portalButton.on('click tap', (e) => {
            e.cancelBubble = true;
            if (hasSubBoard) {
                this.canvas.emitEvent('navigate_to_sub', { whiteboardId: nodeData.sub_whiteboard_id });
            } else {
                this.canvas.emitEvent('create_sub_whiteboard', { cardId: nodeData.id });
            }
        });

        portalButton.on('mouseenter', () => {
            portalBg.fill(hasSubBoard ? '#eff6ff' : '#f8fafc');
            portalIcon.fill(hasSubBoard ? '#2563eb' : '#64748b');
            document.body.style.cursor = 'pointer';
            this.canvas.layers.card.batchDraw();
        });

        portalButton.on('mouseleave', () => {
            portalBg.fill('transparent');
            portalIcon.fill(hasSubBoard ? '#3b82f6' : '#cbd5e1');
            document.body.style.cursor = 'default';
            this.canvas.layers.card.batchDraw();
        });

        group.add(portalButton);

        // Export Toggle Button (Between Portal and Edit)
        const isExcluded = !!nodeData.exclude_from_export;
        const exportButton = new Konva.Group({
            x: nodeData.width - 75,
            y: 6,
            name: 'export-button'
        });

        const exportBg = new Konva.Rect({
            width: 32,
            height: 28,
            fill: 'transparent',
            cornerRadius: 4
        });

        // Printer Icon
        const exportIcon = new Konva.Text({
            text: '🖨',
            fontSize: 18,
            x: 5,
            y: 5,
            fill: isExcluded ? '#ef4444' : '#22c55e' // Red if excluded, Green if included
        });

        exportButton.add(exportBg);
        exportButton.add(exportIcon);

        exportButton.on('click tap', (e) => {
            e.cancelBubble = true;
            // Optimistic update
            nodeData.exclude_from_export = !nodeData.exclude_from_export;
            const newExcluded = nodeData.exclude_from_export;
            exportIcon.fill(newExcluded ? '#ef4444' : '#22c55e');
            this.canvas.layers.card.batchDraw();

            this.canvas.emitEvent('toggle_export', { cardId: nodeData.id });
        });

        exportButton.on('mouseenter', () => {
            exportBg.fill('#f1f5f9');
            document.body.style.cursor = 'pointer';
            this.canvas.layers.card.batchDraw();
        });

        exportButton.on('mouseleave', () => {
            exportBg.fill('transparent');
            document.body.style.cursor = 'default';
            this.canvas.layers.card.batchDraw();
        });

        group.add(exportButton);
        this.renderTags(nodeData, group);

        // Hover effect
        group.on('mouseenter', (e) => {
            if (e.target.getParent()?.name() !== 'edit-button' && e.target.getParent()?.name() !== 'portal-button') {
                bg.stroke('#3b82f6');
                bg.strokeWidth(2);
                document.body.style.cursor = 'move';
                this.canvas.layers.card.batchDraw();
            }
        });

        group.on('mouseleave', () => {
            bg.stroke('#cbd5e1');
            bg.strokeWidth(1);
            document.body.style.cursor = 'default';
            this.canvas.layers.card.batchDraw();
        });
    }

    renderFileCard(nodeData, group) {
        const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(nodeData.file);

        const bg = new Konva.Rect({
            width: nodeData.width,
            height: nodeData.height,
            fill: nodeData.color || '#ffffff',
            stroke: '#cbd5e1',
            strokeWidth: 1,
            shadowBlur: 8,
            shadowColor: 'rgba(0,0,0,0.15)',
            cornerRadius: 8,
            name: 'bg',
            perfectDrawEnabled: false,
            shadowForStrokeEnabled: false
        });
        group.add(bg);

        if (isImage) {
            const imageObj = new Image();
            imageObj.onload = () => {
                const imgNode = new Konva.Image({
                    image: imageObj,
                    x: 5,
                    y: 5,
                    width: nodeData.width - 10,
                    height: nodeData.height - 10,
                    cornerRadius: 4,
                    name: 'file-preview'
                });
                group.add(imgNode);
                imgNode.moveToBottom();
                bg.moveToBottom();
                this.canvas.layers.card.batchDraw();
            };
            imageObj.src = nodeData.file;
        } else {
            const icon = new Konva.Text({
                text: '📄', fontSize: 48,
                x: nodeData.width / 2 - 24, y: nodeData.height / 2 - 40,
                name: 'file-icon'
            });
            const fileName = new Konva.Text({
                text: nodeData.file.split('_').slice(1).join('_') || 'File',
                fontSize: 14, width: nodeData.width - 20, align: 'center',
                x: 10, y: nodeData.height / 2 + 20,
                ellipsis: true, name: 'file-name'
            });
            group.add(icon);
            group.add(fileName);
        }

        this.renderTags(nodeData, group);

        group.on('mouseenter', () => {
            bg.stroke('#3b82f6');
            bg.strokeWidth(2);
            document.body.style.cursor = 'move';
            this.canvas.layers.card.batchDraw();
        });

        group.on('mouseleave', () => {
            bg.stroke('#cbd5e1');
            bg.strokeWidth(1);
            document.body.style.cursor = 'default';
            this.canvas.layers.card.batchDraw();
        });
    }

    renderTags(nodeData, group) {
        if (!nodeData.tags || nodeData.tags.length === 0) return;

        const tagsGroup = new Konva.Group({
            x: 10,
            y: nodeData.height - 25,
            name: 'tags-container'
        });

        let currentX = 0;
        nodeData.tags.forEach(tag => {
            const tagText = new Konva.Text({
                text: tag, fontSize: 10, padding: 4,
                fill: '#3b82f6', fontStyle: 'bold', fontFamily: 'Inter, sans-serif'
            });

            const tagBg = new Konva.Rect({
                width: tagText.width(), height: tagText.height(),
                fill: '#eff6ff', stroke: '#bfdbfe', strokeWidth: 1, cornerRadius: 4
            });

            const tagContainer = new Konva.Group({ x: currentX });
            tagContainer.add(tagBg);
            tagContainer.add(tagText);
            tagsGroup.add(tagContainer);

            currentX += tagText.width() + 6;
        });

        group.add(tagsGroup);
    }

    addGroup(nodeData) {
        const group = new Konva.Group({
            x: nodeData.x, y: nodeData.y,
            draggable: true, id: `group-${nodeData.id}`, name: 'group-group'
        });

        const bg = new Konva.Rect({
            width: nodeData.width,
            height: nodeData.collapsed ? 36 : nodeData.height,
            fill: nodeData.color || '#e5e7eb', opacity: 0.2,
            stroke: '#9ca3af', strokeWidth: 2, dash: [10, 5],
            cornerRadius: 8, name: 'group-bg',
            perfectDrawEnabled: false,
            shadowForStrokeEnabled: false
        });

        const header = new Konva.Rect({
            width: nodeData.width, height: 36,
            fill: nodeData.color || '#d1d5db', opacity: 0.5,
            cornerRadius: [8, 8, 0, 0], name: 'group-header'
        });

        const label = new Konva.Text({
            text: nodeData.text || 'Group', fontSize: 14, fontStyle: 'bold',
            x: 35, padding: 10, fill: '#374151',
            width: nodeData.width - 100, ellipsis: true
        });

        group.add(bg);
        group.add(header);
        group.add(label);

        // Group Edit Button (Right of Header)
        const editButton = new Konva.Group({
            x: nodeData.width - 40,
            y: 4,
            name: 'group-edit-button'
        });

        const editBg = new Konva.Rect({
            width: 32,
            height: 28,
            fill: 'transparent',
            cornerRadius: 4
        });

        const editIcon = new Konva.Text({
            text: '✎',
            fontSize: 18,
            x: 7,
            y: 5,
            fill: '#64748b'
        });

        editButton.add(editBg);
        editButton.add(editIcon);

        editButton.on('mousedown touchstart', (e) => { e.cancelBubble = true; });
        editButton.on('click tap', (e) => {
            e.cancelBubble = true;
            this.canvas.emitEvent('group_edit_click', {
                id: nodeData.id,
                text: nodeData.text || ''
            });
        });

        editButton.on('mouseenter', () => {
            editBg.fill('#f1f5f9');
            editIcon.fill('#1e293b');
            document.body.style.cursor = 'pointer';
            this.canvas.layers.group.batchDraw();
        });

        editButton.on('mouseleave', () => {
            editBg.fill('transparent');
            editIcon.fill('#64748b');
            document.body.style.cursor = 'default';
            this.canvas.layers.group.batchDraw();
        });

        group.add(editButton);

        const arrowButton = new Konva.Text({
            text: nodeData.collapsed ? '▶' : '▼',
            fontSize: 16, fill: '#6b7280', x: 10, y: 10, name: 'collapse-arrow'
        });

        arrowButton.on('click tap', (e) => {
            e.cancelBubble = true;
            const currentState = group.getAttr('collapsed') || false;
            const newState = !currentState;
            this.canvas.toggleGroupCollapse(nodeData.id, newState);
            this.canvas.emitEvent('toggle_group_collapse', { groupId: nodeData.id, collapsed: newState });
        });

        arrowButton.on('mouseenter', () => {
            arrowButton.fill('#3b82f6');
            document.body.style.cursor = 'pointer';
            this.canvas.layers.group.batchDraw();
        });

        arrowButton.on('mouseleave', () => {
            arrowButton.fill('#6b7280');
            document.body.style.cursor = 'default';
            this.canvas.layers.group.batchDraw();
        });

        group.add(arrowButton);
        group.nodeData = nodeData;
        return group;
    }

    addEdge(edgeData, fromNode, toNode) {
        const bestSides = this.canvas.getNearestSides(fromNode, toNode);
        const fromPos = this.canvas.getAnchorPosition(fromNode, bestSides.fromSide);
        const toPos = this.canvas.getAnchorPosition(toNode, bestSides.toSide);

        const points = this.canvas.calculateManhattanPoints(fromPos, toPos, bestSides.fromSide, bestSides.toSide);

        const group = new Konva.Group({
            id: `edge-${edgeData.id}`, name: 'edge-group',
            edgeData: edgeData, draggable: false
        });

        const arrow = new Konva.Arrow({
            points: points, stroke: edgeData.color || '#64748b', strokeWidth: 2,
            pointerLength: 10, pointerWidth: 8,
            id: `arrow-${edgeData.id}`, name: 'edge-line',
            lineCap: 'round', lineJoin: 'round',
            hitStrokeWidth: 20 // Make it easier to click the line
        });

        const labelGroup = new Konva.Group({ name: 'label-group', listening: true });
        const labelText = edgeData.label || 'Add Label';
        const text = new Konva.Text({
            text: labelText, fontSize: 12, fontFamily: 'Inter, sans-serif',
            fill: edgeData.label ? '#334155' : '#94a3b8', padding: 5, align: 'center',
            fontStyle: edgeData.label ? 'bold' : 'italic'
        });

        const bg = new Konva.Rect({
            fill: 'white', stroke: '#e2e8f0', strokeWidth: 1, cornerRadius: 4,
            width: text.width(), height: text.height(),
            shadowBlur: 2, shadowOffset: { x: 0, y: 1 }, shadowOpacity: 0.1
        });

        labelGroup.add(bg);
        labelGroup.add(text);

        const midPoint = this.canvas.getManhattanMidpoint(points);
        labelGroup.position(midPoint);
        labelGroup.offset({ x: text.width() / 2, y: text.height() / 2 });

        labelGroup.on('mouseenter', () => {
            document.body.style.cursor = 'pointer';
            bg.stroke('#3b82f6');
            this.canvas.layers.edge.batchDraw();
        });

        labelGroup.on('mouseleave', () => {
            document.body.style.cursor = 'default';
            bg.stroke('#e2e8f0');
            this.canvas.layers.edge.batchDraw();
        });

        labelGroup.on('click tap', (e) => {
            e.cancelBubble = true;
            this.canvas.emitEvent('edge_label_click', {
                edgeId: edgeData.id,
                currentLabel: edgeData.label || ''
            });
        });

        group.add(arrow);
        group.add(labelGroup);
        return group;
    }

    extractTitle(text) {
        if (!text) return 'Untitled';
        const lines = text.trim().split('\n');
        const firstLine = lines[0].replace(/^#+\s*/, '');
        return firstLine.substring(0, 50);
    }

    extractPreview(text) {
        if (!text) return '';
        const lines = text.trim().split('\n');
        const contentLines = lines.slice(1).join('\n').trim();
        const cleanText = contentLines
            .replace(/^#+\s*/gm, '')
            .replace(/\*\*/g, '')
            .replace(/\*/g, '')
            .replace(/`/g, '');
        return cleanText;
    }

    /**
     * Cache a card or group for performance
     */
    cacheItem(item) {
        if (!item) return;
        try {
            // Get accurate bounding box (including shadows/strokes) in local coordinates
            const rect = item.getClientRect({ skipTransform: true });

            // Add a small safety buffer
            const buffer = 5;

            item.cache({
                x: rect.x - buffer,
                y: rect.y - buffer,
                width: rect.width + buffer * 2,
                height: rect.height + buffer * 2,
                pixelRatio: window.devicePixelRatio || 1
            });

            this.canvas.layers.card.batchDraw();
            this.canvas.layers.group.batchDraw();
        } catch (e) {
            console.warn('[CACHE] Failed to cache item:', e);
        }
    }
}

window.RenderingController = RenderingController;
