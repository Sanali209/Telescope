from nicegui import ui
from typing import List, Optional, Callable, Any
import json

from app.models.canvas_node import CanvasNode
from app.models.canvas_edge import CanvasEdge
from app.models.whiteboard import Whiteboard
from app.services.board_service import BoardService
from app.ui.components.board_toolbar import BoardToolbar
from app.ui.components.board_search import BoardSearch
from app.ui.handlers.canvas_handlers import CanvasHandlers

class WhiteboardView:
    """Orchestrator for the Whiteboard UI"""
    def __init__(self, whiteboard_id: Optional[str] = None):
        self.whiteboard_id: Optional[str] = whiteboard_id
        self.nodes: List[CanvasNode] = []
        self.edges: List[CanvasEdge] = []
        self.current_wb: Optional[Whiteboard] = None
        self.on_whiteboard_create: Optional[Callable] = None
        
        # Initialize handlers and components
        self.handlers = CanvasHandlers(self)
        self.search_interface = None
        self.toolbar = None
        self.upload_dialog = None
    
    async def export_linear_doc(self) -> None:
        """Export current whiteboard as a linear HTML document"""
        try:
            if not self.current_wb:
                await self.load_data() 
            if not self.current_wb:
                ui.notify("No whiteboard loaded", type='negative')
                return

            data = await BoardService.export_to_json_canvas(self.current_wb)
            
            # Filter out excluded nodes
            all_nodes = data['nodes']
            filtered_nodes = [n for n in all_nodes if not n.get('exclude_from_export', False)]
            included_ids = {n['id'] for n in filtered_nodes}
            
            # Filter edges: both source and target must be included
            all_edges = data['edges']
            filtered_edges = [
                e for e in all_edges 
                if e['fromNode'] in included_ids and e['toNode'] in included_ids
            ]
            
            if not filtered_nodes:
                ui.notify("No cards to export (all excluded or empty)", type='warning')
                return

            from app.utils.linear_export import NarrativeExporter
            exporter = NarrativeExporter(filtered_nodes, filtered_edges)
            html_content = exporter.generate_html(self.current_wb.name or "Whiteboard Export")
            ui.download(html_content.encode('utf-8'), f"{self.current_wb.name}.html")
            ui.notify(f"Exported {len(filtered_nodes)} cards", type='positive')
        except Exception as e:
            ui.notify(f"Export failed: {str(e)}", type='negative')

    async def load_data(self) -> None:
        """Load whiteboard and its nodes/edges using BoardService"""
        if self.whiteboard_id:
            self.current_wb = await BoardService.get_whiteboard_by_id(self.whiteboard_id)
        if not self.current_wb:
            self.current_wb = await BoardService.get_first_whiteboard()
        if not self.current_wb:
            self.current_wb = await BoardService.create_whiteboard("My First Whiteboard")
        
        self.whiteboard_id = self.current_wb.id
        self.nodes = await BoardService.get_nodes(self.whiteboard_id)
        self.edges = await BoardService.get_edges(self.whiteboard_id)
        
        if not self.nodes:
            welcome_node = CanvasNode(
                type="text",
                text="# Welcome to Nomad Telescope\n\nDouble-click the canvas to add cards!",
                x=100.0, y=100.0, width=400.0, height=200.0,
                whiteboard_id=self.whiteboard_id
            )
            await BoardService.save_node(welcome_node)
            self.nodes.append(welcome_node)
    
    async def render(self):
        """Render the Konva-based infinite canvas"""
        await self.load_data()
        
        # Main canvas container
        with ui.element('div').props('id=wb-container') \
                .classes('w-full h-full relative') \
                .style('background: #f8fafc; overflow: hidden;'):
            pass
        
        self._add_scripts()
        self._init_canvas_js()
        self._setup_events()
        
        # Components
        self.search_interface = BoardSearch(self.nodes)
        self.search_interface.render()
        self.render_breadcrumbs()
        await self._render_toolbar_and_dialogs()

    def _add_scripts(self):
        ui.add_head_html('<script src="https://unpkg.com/konva@9/konva.min.js"></script>')
        import time
        v = int(time.time())
        # Controllers
        for controller in ['selection_controller', 'input_controller', 'rendering_controller']:
            ui.add_body_html(f'<script src="/static/js/controllers/{controller}.js?v={v}"></script>')
        # Core & Extensions
        for script in ['infinite_canvas', 'card_editor', 'card_resizer', 'connection_manager', 'group_manager', 'undo_manager']:
            ui.add_body_html(f'<script src="/static/js/{script}.js?v={v}"></script>')

    def _init_canvas_js(self):
        init_script = f'''
        if (typeof Konva !== 'undefined') {{
            const canvas = new InfiniteCanvas('wb-container');
            window.canvas = canvas;
            window.cardEditor = new CardEditor(canvas);
            window.cardResizer = new CardResizer(canvas);
            window.connectionManager = new ConnectionManager(canvas);
            window.groupManager = new GroupManager(canvas);

            window.showToast = (message, type = 'info') => {{
                const colors = {{'info': '#3b82f6', 'success': '#22c55e', 'warning': '#f59e0b', 'error': '#ef4444'}};
                emitEvent('show_toast_backend', {{ message, type, color: colors[type] || colors.info }});
            }};
            
            const nodes = {self.serialize_nodes()};
            nodes.forEach(node => {{
                if (node.type === 'text' || node.type === 'file') {{
                    const card = canvas.addCard(node);
                    window.cardResizer.addResizeHandles(card, node);
                    window.connectionManager.addAnchors(card, node);
                }} else if (node.type === 'group') {{
                    const groupKonva = canvas.addGroup(node);
                    window.groupManager.registerGroup(groupKonva, node);
                    window.cardResizer.addGroupResizeHandles(groupKonva, node);
                }}
            }});
            
            nodes.forEach(node => {{
                if ((node.type === 'text' || node.type === 'file') && node.parent_id) {{
                    const groupInfo = window.groupManager.groups.get(node.parent_id);
                    if (groupInfo) groupInfo.members.add(node.id);
                }}
            }});
            
            const edges = {self.serialize_edges()};
            edges.forEach(edge => {{
                const fromNode = nodes.find(n => n.id === edge.fromNode);
                const toNode = nodes.find(n => n.id === edge.toNode);
                if (fromNode && toNode) canvas.addEdge(edge, fromNode, toNode);
            }});
            
            canvas.stage.on('dblclick', (e) => {{
                if (e.target === canvas.stage) {{
                    const pointer = canvas.stage.getPointerPosition();
                    emitEvent('canvas_dblclick', canvas.screenToWorld(pointer.x, pointer.y));
                }}
            }});
        }}
        '''
        ui.run_javascript(init_script)

    def _setup_events(self):
        event_map = {
            'card_moved_backend': self.handlers.on_card_moved,
            'group_moved_backend': self.handlers.on_group_moved,
            'canvas_dblclick': self.handlers.on_canvas_dblclick,
            'card_dblclick_backend': self.handlers.on_card_dblclick,
            'create_group_at_center': self.handlers.on_create_group_at_center,
            'card_content_saved_backend': self.handlers.on_card_content_saved,
            'viewport_changed_backend': self.handlers.on_viewport_changed,
            'card_resized_backend': self.handlers.on_card_resized,
            'edge_create_backend': self.handlers.on_edge_create,
            'edge_label_click_backend': self.handlers.on_edge_label_click,
            'card_grouped_backend': self.handlers.on_card_grouped,
            'card_ungrouped_backend': self.handlers.on_card_ungrouped,
            'group_resized_backend': self.handlers.on_group_resized,
            'create_group_with_cards_backend': self.handlers.on_create_group_with_cards,
            'delete_nodes_backend': self.handlers.on_delete_nodes,
            'delete_edges_backend': self.handlers.on_delete_edges,
            'toggle_group_collapse_backend': self.handlers.on_toggle_group_collapse,
            'group_edit_click_backend': self.handlers.on_group_edit_click,
            'restore_node_backend': self.handlers.on_restore_node,
            'restore_edge_backend': self.handlers.on_restore_edge,
            'create_sub_whiteboard_backend': self.handlers.on_create_sub_whiteboard,
            'navigate_to_sub_backend': self.handlers.on_navigate_to_sub,
            'paste_nodes_backend': self.handlers.on_paste_nodes,
            'toggle_export_backend': self.handlers.on_toggle_export,
            'show_toast_backend': lambda e: ui.notify(e.args['message'], type=e.args['type'], color=e.args['color'])
        }
        for event, handler in event_map.items():
            ui.on(event, handler)

    async def _render_toolbar_and_dialogs(self):
        with ui.dialog() as self.upload_dialog:
            with ui.card().classes('w-[500px] p-6'):
                ui.label('Add Image or File').classes('text-xl font-bold mb-4')
                ui.upload(on_upload=self.handlers.handle_upload, auto_upload=True)
                with ui.row().classes('w-full justify-end mt-4'):
                    ui.button('Cancel', on_click=self.upload_dialog.close).props('flat')
        
        self.toolbar = BoardToolbar(
            on_upload=self.upload_dialog.open,
            on_export=self.export_linear_doc,
            on_undo=lambda: ui.run_javascript('if (window.undoManager) window.undoManager.undo()'),
            on_redo=lambda: ui.run_javascript('if (window.undoManager) window.undoManager.redo()'),
            on_zoom_in=lambda: ui.run_javascript('window.canvas.zoomIn()'),
            on_zoom_out=lambda: ui.run_javascript('window.canvas.zoomOut()'),
            on_reset_view=lambda: ui.run_javascript('window.canvas.resetView()'),
            on_toggle_pan=lambda: ui.run_javascript('window.canvas.togglePanMode()')
        )
        self.toolbar.render()

    @ui.refreshable
    def render_breadcrumbs(self):
        """Render breadcrumb navigation in top-left"""
        with ui.element('div').classes('fixed top-4 left-20 z-[9999] flex items-center gap-1 bg-white/80 backdrop-blur-md shadow-lg rounded-full px-3 py-1 border border-slate-200/50'):
            ui.button(icon='home', on_click=lambda: ui.navigate.to('/')).props('flat round dense size=sm color=grey-8')
            if self.current_wb and self.current_wb.parent_id:
                ui.icon('chevron_right', color='grey-4', size='16px')
                ui.button(icon='arrow_upward', on_click=lambda: ui.navigate.to(f'/?id={self.current_wb.parent_id}')).props('flat round dense size=sm color=grey-8').tooltip('Parent Board')
            ui.icon('chevron_right', color='grey-4', size='16px')
            with ui.row().classes('items-center gap-1 no-wrap flex-nowrap'):
                ui.label(self.current_wb.name).classes('text-xs font-bold text-slate-700 truncate max-w-[150px] flex-shrink')
                ui.button(icon='edit', on_click=self._open_rename_dialog).props('flat round dense size=xs color=grey-5').classes('flex-shrink-0')

    async def _open_rename_dialog(self):
        with ui.dialog() as dialog, ui.card().classes('w-80'):
            ui.label('Rename Whiteboard').classes('text-lg font-bold mb-2')
            name_input = ui.input('New Name', value=self.current_wb.name).classes('w-full mb-4')
            async def save_name():
                new_name = name_input.value.strip()
                if new_name:
                    self.current_wb.name = new_name
                    await BoardService.save_whiteboard(self.current_wb)
                    ui.notify(f'Board renamed to "{new_name}"')
                    self.render_breadcrumbs.refresh()
                    if self.on_whiteboard_create:
                        for cb in (self.on_whiteboard_create if isinstance(self.on_whiteboard_create, list) else [self.on_whiteboard_create]):
                            if callable(cb): await cb()
                    dialog.close()
            with ui.row().classes('w-full justify-end gap-2'):
                ui.button('Cancel', on_click=dialog.close).props('flat color=grey')
                ui.button('Save', on_click=save_name).props('flat color=primary')
        dialog.open()

    def serialize_node(self, node):
        return json.dumps({
            'id': node.id, 'type': node.type, 'x': node.x, 'y': node.y, 'width': node.width, 'height': node.height,
            'text': node.text, 'file': node.file, 'color': node.color, 'parent_id': node.parent_id,
            'sub_whiteboard_id': node.sub_whiteboard_id, 'tags': node.tags if hasattr(node, 'tags') else []
        })
    
    def serialize_nodes(self):
        return json.dumps([
            {
                'id': n.id, 'type': n.type, 'x': n.x, 'y': n.y, 'width': n.width, 'height': n.height,
                'text': n.text, 'file': n.file, 'color': n.color, 'parent_id': n.parent_id,
                'collapsed': n.collapsed if hasattr(n, 'collapsed') else False,
                'sub_whiteboard_id': n.sub_whiteboard_id, 'tags': n.tags if hasattr(n, 'tags') else [],
                'exclude_from_export': n.exclude_from_export if hasattr(n, 'exclude_from_export') else False,
                'title': n.get_title(), 'preview': n.get_preview()
            } for n in self.nodes
        ])
    
    def serialize_edges(self):
        return json.dumps([{'id': e.id, 'fromNode': e.fromNode, 'toNode': e.toNode, 'color': e.color} for e in self.edges])
