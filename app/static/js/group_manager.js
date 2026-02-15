/**
 * Group Manager
 * Handles group membership detection and management
 */

class GroupManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.groups = new Map(); // groupId -> group Konva.Group
    }

    /**
     * Register a group for membership tracking
     */
    registerGroup(groupKonva, nodeData) {
        this.groups.set(nodeData.id, {
            konva: groupKonva,
            data: nodeData,
            members: new Set()
        });
        console.log('[GROUP] Registered group:', nodeData.id);
    }

    /**
     * Check if a card is inside a group (bounding box collision)
     */
    isCardInsideGroup(cardGroup, groupGroup) {
        // Use world coordinates from nodeData/position instead of getClientRect (screen coords)
        const cx = cardGroup.x();
        const cy = cardGroup.y();
        // cardGroup might not have width set directly, use nodeData
        const cw = cardGroup.nodeData.width;
        const ch = cardGroup.nodeData.height;

        const gx = groupGroup.x();
        const gy = groupGroup.y();
        const gw = groupGroup.nodeData.width;
        const gh = groupGroup.nodeData.height;

        // Check if card is strictly inside group content area (below header)
        // Group header is approx 36px

        return (
            cx >= gx &&
            cy >= gy &&
            (cx + cw) <= (gx + gw) &&
            (cy + ch) <= (gy + gh)
        );
    }

    /**
     * Check all groups when a card is dropped
     */
    onCardDrop(cardId, cardGroup) {
        console.log('[GROUP] Checking drop for card:', cardId);

        let targetGroupId = null;
        let smallestGroupArea = Infinity;

        // Find the smallest group that contains the card
        this.groups.forEach((groupInfo, groupId) => {
            if (this.isCardInsideGroup(cardGroup, groupInfo.konva)) {
                const groupBounds = groupInfo.konva.getClientRect();
                const area = groupBounds.width * groupBounds.height;

                // Prefer smaller groups (nested groups)
                if (area < smallestGroupArea) {
                    targetGroupId = groupId;
                    smallestGroupArea = area;
                }
            }
        });

        if (targetGroupId) {
            console.log('[GROUP] Card', cardId, 'dropped into group:', targetGroupId);

            // Add to group membership
            const groupInfo = this.groups.get(targetGroupId);
            groupInfo.members.add(cardId);

            // Emit event to backend
            this.canvas.emitEvent('card_grouped', {
                cardId: cardId,
                groupId: targetGroupId
            });

            // Visual feedback
            this.highlightGroup(targetGroupId, false);
        } else {
            // Card was removed from all groups
            console.log('[GROUP] Card', cardId, 'removed from all groups');
            this.removeCardFromAllGroups(cardId);
        }
    }

    /**
     * Remove card from all group memberships
     */
    removeCardFromAllGroups(cardId) {
        this.groups.forEach(groupInfo => {
            if (groupInfo.members.has(cardId)) {
                groupInfo.members.delete(cardId);

                // Emit ungrouping event
                this.canvas.emitEvent('card_ungrouped', {
                    cardId: cardId
                });
            }
        });
    }

    /**
     * Highlight group when card is being dragged over it
     */
    highlightGroup(groupId, highlight = true) {
        const groupInfo = this.groups.get(groupId);
        if (!groupInfo) return false; // Return false if no change

        // Track state to avoid redundant redraws
        if (groupInfo.isHighlighted === highlight) return false;
        groupInfo.isHighlighted = highlight;

        const bg = groupInfo.konva.findOne('.group-bg');
        const header = groupInfo.konva.findOne('.group-header');

        if (bg && header) {
            if (highlight) {
                bg.opacity(0.4);
                bg.stroke('#3b82f6');
                bg.strokeWidth(3);
                header.opacity(0.7);
            } else {
                bg.opacity(0.2);
                bg.stroke('#9ca3af');
                bg.strokeWidth(2);
                header.opacity(0.5);
            }
            return true; // Return true indicating a change happened
        }
        return false;
    }

    /**
     * Handle child card movement during group drag
     */
    onGroupDragMove(groupKonva) {
        const id = groupKonva.nodeData.id;
        const groupInfo = this.groups.get(id);
        if (!groupInfo) return;

        // Calculate delta (groupKonva handles its own position, we move cards)
        const newX = groupKonva.x();
        const newY = groupKonva.y();
        const dx = newX - groupKonva.nodeData.x;
        const dy = newY - groupKonva.nodeData.y;

        // Update members
        groupInfo.members.forEach(cardId => {
            const card = this.canvas.layers.card.findOne('#card-' + cardId);
            if (card) {
                card.x(card.nodeData.x + dx);
                card.y(card.nodeData.y + dy);
                this.canvas.updateConnectedEdges(cardId);
            }
        });

        this.canvas.layers.card.batchDraw();
    }

    /**
     * Check if card is over any group during drag
     */
    onCardDragMove(cardGroup) {
        let needsDraw = false;

        this.groups.forEach((groupInfo, groupId) => {
            const isInside = this.isCardInsideGroup(cardGroup, groupInfo.konva);

            // highlightGroup now returns true if something changed
            if (this.highlightGroup(groupId, isInside)) {
                needsDraw = true;
            }
        });

        if (needsDraw) {
            this.canvas.layers.group.batchDraw();
        }
    }

    /**
     * Create a group around selected cards (Cmd+G functionality)
     */
    createGroupAroundCards(cardGroups, cardIds) {
        if (cardGroups.length === 0) return;

        // Calculate bounding box
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        cardGroups.forEach(cardGroup => {
            // Use world coordinates to avoid zoom/transform issues
            const x = cardGroup.x();
            const y = cardGroup.y();
            const w = cardGroup.nodeData.width;
            const h = cardGroup.nodeData.height;

            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x + w);
            maxY = Math.max(maxY, y + h);
        });

        // Add padding
        const padding = 30;
        minX -= padding;
        minY -= padding;
        maxX += padding;
        maxY += padding + 36; // Extra for header

        // Emit group creation event
        this.canvas.emitEvent('create_group_with_cards', {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
            cardIds: cardIds
        });
    }
}

// Export
window.GroupManager = GroupManager;
