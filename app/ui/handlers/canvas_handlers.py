from nicegui import ui
import os
import uuid
from typing import List, Any, Optional
from app.models.canvas_node import CanvasNode
from app.models.canvas_edge import CanvasEdge
from app.models.whiteboard import Whiteboard
from app.services.board_service import BoardService

class CanvasHandlers:
    """Event handlers for whiteboard interactions"""
    def __init__(self, view: Any):
        self.view = view

    async def on_card_moved(self, e):
        node_id = e.args['id']
        x, y = e.args['x'], e.args['y']
        node = next((n for n in self.view.nodes if n.id == node_id), None)
        if node:
            node.x, node.y = x, y
            await BoardService.save_node(node)
    
    async def on_group_moved(self, e):
        node_id = e.args['id']
        x, y = e.args['x'], e.args['y']
        node = next((n for n in self.view.nodes if n.id == node_id), None)
        if node:
            dx = x - node.x
            dy = y - node.y
            node.x, node.y = x, y
            await BoardService.save_node(node)
            
            # Move child cards
            for child in self.view.nodes:
                if child.parent_id == node_id:
                    child.x += dx
                    child.y += dy
                    await BoardService.save_node(child)
    
    async def on_canvas_dblclick(self, e):
        x, y = e.args['x'], e.args['y']
        new_node = CanvasNode(
            type="text",
            text="# New Card\n\nDouble-click to edit",
            x=x - 150,
            y=y - 100,
            width=300,
            height=200,
            whiteboard_id=self.view.whiteboard_id
        )
        await BoardService.save_node(new_node)
        self.view.nodes.append(new_node)
        
        # Add to canvas
        await ui.run_javascript(f'''
            if (window.canvas) {{
                window.canvas.addCard({self.view.serialize_node(new_node)});
            }}
        ''')
        ui.notify('Card created!')

    async def on_create_group_at_center(self, e):
        x, y = e.args['x'], e.args['y']
        width, height = e.args['width'], e.args['height']
        
        new_group = CanvasNode(
            type="group",
            text="New Group",
            x=x,
            y=y,
            width=width,
            height=height,
            color='#e5e7eb',
            whiteboard_id=self.view.whiteboard_id
        )
        await BoardService.save_node(new_group)
        self.view.nodes.append(new_group)
        
        await ui.run_javascript(f'''
            if (window.canvas && window.groupManager) {{
                const groupData = {self.view.serialize_node(new_group)};
                const groupKonva = window.canvas.addGroup(groupData);
                window.groupManager.registerGroup(groupKonva, groupData);
            }}
        ''')
        ui.notify('Group created!')

    async def on_card_content_saved(self, e):
        node_id = e.args['id']
        new_content = e.args['content']
        node = next((n for n in self.view.nodes if n.id == node_id), None)
        if node:
            node.text = new_content
            if 'tags' in e.args:
                node.tags = e.args['tags']
            if 'color' in e.args:
                node.color = e.args['color']
            await BoardService.save_node(node)
            
            await ui.run_javascript(f'''
                if (window.canvas) {{
                    const oldCard = window.canvas.layers.card.findOne('#card-{node_id}');
                    if (oldCard) oldCard.destroy();
                    
                    const nodeData = {self.view.serialize_node(node)};
                    const card = window.canvas.addCard(nodeData);
                    
                    if (window.cardResizer) window.cardResizer.addResizeHandles(card, nodeData);
                    if (window.connectionManager) window.connectionManager.addAnchors(card, nodeData);
                    
                    if (window.canvas.currentFilter) window.canvas.filterNodes(window.canvas.currentFilter);
                }}
            ''')
            
            if hasattr(self.view, 'search_interface'):
                self.view.search_interface.refresh_tags(self.view.nodes)
            ui.notify('Card updated!')

    async def on_viewport_changed(self, e):
        if self.view.current_wb:
            self.view.current_wb.viewport = e.args
            await BoardService.save_whiteboard(self.view.current_wb)

    async def on_card_resized(self, e):
        node_id = e.args['id']
        node = next((n for n in self.view.nodes if n.id == node_id), None)
        if node:
            node.width = e.args['width']
            node.height = e.args['height']
            await BoardService.save_node(node)
            ui.notify(f'Card resized')

    async def on_edge_create(self, e):
        edge = CanvasEdge(
            id=str(uuid.uuid4()),
            whiteboard_id=self.view.whiteboard_id,
            fromNode=e.args['fromNode'],
            toNode=e.args['toNode'],
            fromSide=e.args.get('fromSide', 'right'),
            toSide=e.args.get('toSide', 'left'),
            color=e.args.get('color', '#64748b')
        )
        await BoardService.save_edge(edge)
        self.view.edges.append(edge)
        ui.notify('Connection created')
        
        await ui.run_javascript(f'''
            if (window.canvas) {{
                const edgeData = {{
                    id: "{edge.id}",
                    fromNode: "{edge.fromNode}",
                    toNode: "{edge.toNode}",
                    color: "{edge.color}"
                }};
                const fromNode = window.canvas.layers.card.findOne('#card-{edge.fromNode}') || 
                                 window.canvas.layers.group.findOne('#group-{edge.fromNode}');
                const toNode = window.canvas.layers.card.findOne('#card-{edge.toNode}') || 
                               window.canvas.layers.group.findOne('#group-{edge.toNode}');
                if (fromNode && toNode) {{
                    window.canvas.addEdge(edgeData, fromNode.nodeData || {{id: "{edge.fromNode}"}}, toNode.nodeData || {{id: "{edge.toNode}"}});
                }}
            }}
        ''')

    async def on_delete_nodes(self, e):
        node_ids = e.args['nodeIds']
        result = await BoardService.delete_nodes_and_edges(node_ids, self.view.whiteboard_id or "")
        self.view.nodes = [n for n in self.view.nodes if n.id not in node_ids]
        # Remove edges connected to these nodes
        self.view.edges = [ed for ed in self.view.edges if ed.fromNode not in node_ids and ed.toNode not in node_ids]
        if result["nodes"] > 0:
            ui.notify(f'Deleted {result["nodes"]} item(s)')

    async def on_delete_edges(self, e):
        edge_ids = e.args['edgeIds']
        deleted_count = 0
        for edge_id in edge_ids:
            if await BoardService.delete_edge(edge_id, self.view.whiteboard_id or ""):
                deleted_count += 1
                self.view.edges = [ed for ed in self.view.edges if ed.id != edge_id]
        
        if deleted_count > 0:
            ui.notify(f'Deleted {deleted_count} connection(s)')

    async def handle_upload(self, e):
        upload_dir = os.path.join(os.getcwd(), 'app', 'static', 'uploads')
        os.makedirs(upload_dir, exist_ok=True)
        
        try:
            original_name = e.file.name
            file_name = f"{uuid.uuid4()}_{original_name}"
            file_path = os.path.join(upload_dir, file_name)
            content = await e.file.read()
            with open(file_path, 'wb') as f:
                f.write(content)
        except Exception as ex:
            ui.notify(f"Upload failed: {ex}", type='negative')
            return

        vp = self.view.current_wb.viewport or {"x": 0, "y": 0, "scale": 1.0}
        vx, vy, vs = vp.get("x", 0), vp.get("y", 0), vp.get("scale", 1.0)
        new_x, new_y = -vx / vs + 100, -vy / vs + 100
        
        parent_id = None
        for node in self.view.nodes:
            if node.type == 'group' and node.x <= new_x <= node.x + node.width and node.y <= new_y <= node.y + node.height:
                parent_id = node.id
                break
        
        new_node = CanvasNode(
            type="file",
            file=f"/static/uploads/{file_name}",
            x=new_x,
            y=new_y,
            width=300,
            height=300,
            parent_id=parent_id,
            whiteboard_id=self.view.whiteboard_id
        )
        await BoardService.save_node(new_node)
        self.view.nodes.append(new_node)
        
        if hasattr(self.view, 'upload_dialog'):
            self.view.upload_dialog.close()
            
        await ui.run_javascript(f'''
            const nodeData = {self.view.serialize_node(new_node)};
            const card = window.canvas.addCard(nodeData);
            window.cardResizer.addResizeHandles(card, nodeData);
            window.connectionManager.addAnchors(card, nodeData);
        ''')
        ui.notify(f'Uploaded: {original_name}')

    async def on_edge_label_click(self, e):
        edge_id = e.args['edgeId']
        current_label = e.args['currentLabel']
        
        async def save_label(new_label):
            edge = await BoardService.get_edge_by_id(edge_id)
            if edge:
                edge.label = new_label
                await BoardService.save_edge(edge)
                ui.notify(f'Connection label updated')
                
                await ui.run_javascript(f'''
                    if (window.canvas) {{
                        const group = window.canvas.layers.edge.findOne('#edge-{edge_id}');
                        if (group) {{
                            group.attrs.edgeData.label = "{new_label}";
                            const textNode = group.findOne('Text');
                            const bgNode = group.findOne('Rect');
                            if (textNode) {{
                                textNode.text("{new_label}");
                                textNode.fontStyle("bold");
                                textNode.fill("#334155");
                                if (bgNode) {{
                                    bgNode.width(textNode.width());
                                    bgNode.height(textNode.height());
                                }}
                            }}
                            window.canvas.layers.edge.batchDraw();
                        }}
                    }}
                ''')

        async def handle_save():
            await save_label(input_field.value)
            dialog.close()

        with ui.dialog() as dialog, ui.card().classes('w-80'):
            ui.label('Edit Connection Label').classes('text-lg font-bold')
            input_field = ui.input('Label', value=current_label).classes('w-full')
            with ui.row().classes('justify-end w-full'):
                ui.button('Cancel', on_click=dialog.close).props('flat text-color=grey')
                ui.button('Save', on_click=handle_save).props('flat color=primary')
        dialog.open()

    async def on_card_grouped(self, e):
        card_id = e.args['cardId']
        group_id = e.args['groupId']
        card = next((n for n in self.view.nodes if n.id == card_id), None)
        if card:
            card.parent_id = group_id
            await BoardService.save_node(card)

    async def on_create_group_with_cards(self, e):
        group_id = str(uuid.uuid4())
        group = CanvasNode(
            id=group_id,
            whiteboard_id=self.view.whiteboard_id,
            type='group',
            x=e.args['x'],
            y=e.args['y'],
            width=e.args['width'],
            height=e.args['height'],
            color='#e2e8f0'
        )
        await BoardService.save_node(group)
        self.view.nodes.append(group)
        
        card_ids = e.args['cardIds']
        for card_id in card_ids:
            card = next((n for n in self.view.nodes if n.id == card_id), None)
            if card:
                card.parent_id = group_id
                await BoardService.save_node(card)
        
        ui.notify(f'Group created from {len(card_ids)} cards')
        
        group_data = self.view.serialize_node(group)
        await ui.run_javascript(f'''
            if (window.canvas && window.groupManager) {{
                const groupData = {group_data};
                const groupKonva = window.canvas.addGroup(groupData);
                window.groupManager.registerGroup(groupKonva, groupData);
                if (window.cardResizer) window.cardResizer.addGroupResizeHandles(groupKonva, groupData);
                const cardIds = {card_ids};
                cardIds.forEach(id => {{
                    const groupInfo = window.groupManager.groups.get("{group_id}");
                    if (groupInfo) groupInfo.members.add(id);
                }});
                if (window.undoManager) window.undoManager.recordCreate([groupData]);
            }}
        ''')

    async def on_card_ungrouped(self, e):
        card_id = e.args['cardId']
        card = next((n for n in self.view.nodes if n.id == card_id), None)
        if card:
            card.parent_id = None
            await BoardService.save_node(card)
            ui.notify(f'Card removed from group')

    async def on_group_resized(self, e):
        group_id = e.args['id']
        group = next((n for n in self.view.nodes if n.id == group_id), None)
        if group:
            group.width = e.args['width']
            group.height = e.args['height']
            await BoardService.save_node(group)
            ui.notify(f'Group resized')

    async def on_toggle_group_collapse(self, e):
        group_id = e.args['groupId']
        collapsed = e.args['collapsed']
        group = next((n for n in self.view.nodes if n.id == group_id), None)
        if group:
            group.collapsed = collapsed
            await BoardService.save_node(group)

    async def on_group_edit_click(self, e):
        group_id = e.args['id']
        current_text = e.args['text']
        
        async def save_rename(new_name):
            node = next((n for n in self.view.nodes if n.id == group_id), None)
            if node:
                node.text = new_name
                await BoardService.save_node(node)
                ui.notify(f'Group renamed to "{new_name}"')
                
                await ui.run_javascript(f'''
                    if (window.canvas) {{
                        const group = window.canvas.layers.group.findOne('#group-{group_id}');
                        if (group) {{
                            const label = group.findOne('Text');
                            if (label) label.text("{new_name}");
                            if (group.nodeData) group.nodeData.text = "{new_name}";
                            window.canvas.layers.group.batchDraw();
                        }}
                    }}
                ''')

        async def handle_save():
            await save_rename(input_field.value)
            dialog.close()

        with ui.dialog() as dialog, ui.card().classes('w-80'):
            ui.label('Rename Group').classes('text-lg font-bold')
            input_field = ui.input('Group Name', value=current_text).classes('w-full')
            with ui.row().classes('justify-end w-full'):
                ui.button('Cancel', on_click=dialog.close).props('flat text-color=grey')
                ui.button('Save', on_click=handle_save).props('flat color=primary')
        dialog.open()

    async def on_restore_node(self, e):
        node_data = e.args['nodeData']
        existing = next((n for n in self.view.nodes if n.id == node_data['id']), None)
        if existing: return
        
        restored_node = CanvasNode(
            id=node_data['id'],
            whiteboard_id=self.view.whiteboard_id,
            type=node_data.get('type', 'text'),
            x=node_data.get('x', 0),
            y=node_data.get('y', 0),
            width=node_data.get('width', 300),
            height=node_data.get('height', 200),
            text=node_data.get('text', ''),
            color=node_data.get('color', '#e5e7eb'),
            file=node_data.get('file', ''),
            parent_id=node_data.get('parent_id', None),
            tags=node_data.get('tags', []),
            collapsed=node_data.get('collapsed', False)
        )
        await BoardService.save_node(restored_node)
        self.view.nodes.append(restored_node)

    async def on_restore_edge(self, e):
        edge_data = e.args['edgeData']
        existing = next((ed for ed in self.view.edges if ed.id == edge_data['id']), None)
        if existing: return
        
        restored_edge = CanvasEdge(
            id=edge_data['id'],
            whiteboard_id=self.view.whiteboard_id,
            fromNode=edge_data['fromNode'],
            toNode=edge_data['toNode'],
            fromSide=edge_data.get('fromSide', 'right'),
            toSide=edge_data.get('toSide', 'left'),
            color=edge_data.get('color', '#64748b')
        )
        await BoardService.save_edge(restored_edge)
        self.view.edges.append(restored_edge)

    async def on_create_sub_whiteboard(self, e):
        card_id = e.args['cardId']
        card = next((n for n in self.view.nodes if n.id == card_id), None)
        if not card or card.sub_whiteboard_id: return
            
        new_wb_id = str(uuid.uuid4())
        sub_wb = Whiteboard(
            id=new_wb_id,
            name=card.get_title(), 
            parent_id=self.view.whiteboard_id
        )
        await BoardService.save_whiteboard(sub_wb)
        
        if self.view.on_whiteboard_create:
            if isinstance(self.view.on_whiteboard_create, list):
                for cb in self.view.on_whiteboard_create:
                    await cb() if callable(cb) else None
            elif callable(self.view.on_whiteboard_create):
                await self.view.on_whiteboard_create()

        card.sub_whiteboard_id = new_wb_id
        await BoardService.save_node(card)
        
        await ui.run_javascript(f'''
            if (window.canvas) {{
                const card = window.canvas.layers.card.findOne('#card-{card_id}');
                if (card) window.canvas.updateCardVisuals(card, {{sub_whiteboard_id: "{new_wb_id}"}});
            }}
        ''')
        ui.notify(f"Created sub-whiteboard: {sub_wb.name}")

    async def on_navigate_to_sub(self, e):
        wb_id = e.args['whiteboardId']
        ui.navigate.to(f'/?id={wb_id}')
            
    async def on_card_dblclick(self, e):
        node_id = e.args['id']
        text = e.args['text']
        tags = e.args.get('tags', [])
        
        # Find node for color
        node = next((n for n in self.view.nodes if n.id == node_id), None)
        color = node.color if node else '#ffffff'
        
        # Trigger JS editor
        import json
        tags_js = json.dumps(tags)
        await ui.run_javascript(f'if (window.cardEditor) window.cardEditor.open("{node_id}", `{text}`, {tags_js}, "{color}");')

    async def on_paste_nodes(self, e):
        data = e.args
        new_nodes_data = data.get('nodes', [])
        new_edges_data = data.get('edges', [])
        
        for node_data in new_nodes_data:
            node_data['whiteboard_id'] = self.view.whiteboard_id
            node = CanvasNode(**node_data)
            await BoardService.save_node(node)
            self.view.nodes.append(node)
            
        for edge_data in new_edges_data:
            edge_data['whiteboard_id'] = self.view.whiteboard_id
            edge = CanvasEdge(**edge_data)
            await BoardService.save_edge(edge)
            self.view.edges.append(edge)
        
    async def on_toggle_export(self, e):
        card_id = e.args['cardId']
        node = next((n for n in self.view.nodes if n.id == card_id), None)
        if node:
            node.exclude_from_export = not node.exclude_from_export
            await BoardService.save_node(node)
            status = "excluded from" if node.exclude_from_export else "included in"
            ui.notify(f"Card {status} export")
            
            # Optional: Update UI if needed via JS, but usually local toggle handles it visually
            # We can force a re-render if we want to be 100% sure of sync
            await ui.run_javascript(f'''
                if (window.canvas) {{
                    const card = window.canvas.layers.card.findOne('#card-{card_id}');
                    if (card) {{
                        // Update local data
                        if (card.nodeData) card.nodeData.exclude_from_export = {str(node.exclude_from_export).lower()};
                        
                        // Find the printer button and update its color
                        const portalBtn = card.findOne('.portal-button'); // We might need a better selector or name
                        // Actually, let's just trigger a redraw of the card execution context
                        // window.canvas.renderingController.renderTextCard(card.nodeData, card); 
                        // The above might duplicate children. 
                        // Better to rely on JS-side toggle logic update visual state, 
                        // but if we want backend source of truth we might need to send an event back.
                    }}
                }}
            ''')
