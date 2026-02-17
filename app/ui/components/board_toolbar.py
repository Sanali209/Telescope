from nicegui import ui
from typing import Callable, Any

class BoardToolbar:
    """Toolbar component for the whiteboard"""
    def __init__(
        self, 
        on_upload: Callable, 
        on_export: Callable,
        on_undo: Callable,
        on_redo: Callable,
        on_zoom_in: Callable,
        on_zoom_out: Callable,
        on_reset_view: Callable,
        on_toggle_pan: Callable
    ):
        self.on_upload = on_upload
        self.on_export = on_export
        self.on_undo = on_undo
        self.on_redo = on_redo
        self.on_zoom_in = on_zoom_in
        self.on_zoom_out = on_zoom_out
        self.on_reset_view = on_reset_view
        self.on_toggle_pan = on_toggle_pan

    def render(self):
        with ui.element('div').classes('fixed top-4 left-1/2 -translate-x-1/2 z-[9999] p-1'):
            # Reduced padding (px-6->px-4, py-2->py-1.5) and gap (gap-4->gap-2)
            with ui.row().classes('bg-white/80 backdrop-blur-md shadow-2xl rounded-full px-4 py-1.5 gap-2 items-center border border-slate-200/50'):
                # Removed 'add' button
                
                ui.button(
                    icon='folder',
                    on_click=lambda: ui.run_javascript('''
                        const center = window.canvas.screenToWorld(
                            window.innerWidth / 2,
                            window.innerHeight / 2
                        );
                        emitEvent('create_group_at_center', {
                            x: center.x - 250,
                            y: center.y - 200,
                            width: 500,
                            height: 400
                        });
                    ''')
                ).props('round flat dense size=sm color=grey-9').tooltip('Add Group')
                
                # Image/File Upload
                ui.button(
                    icon='image',
                    on_click=self.on_upload
                ).props('round flat dense size=sm color=grey-9').tooltip('Add Image/File')
                
                ui.separator().props('vertical')
                
                ui.button(
                    icon='pan_tool',
                    on_click=self.on_toggle_pan
                ).props('round flat dense size=sm color=grey-9').tooltip('Toggle Pan/Select Mode (P)')
                
                ui.separator().props('vertical')
                
                # Undo / Redo buttons
                ui.button(
                    icon='undo',
                    on_click=self.on_undo
                ).props('round flat dense size=sm color=grey-9').tooltip('Undo (Ctrl+Z)')
                
                ui.button(
                    icon='redo',
                    on_click=self.on_redo
                ).props('round flat dense size=sm color=grey-9').tooltip('Redo (Ctrl+Shift+Z)')
                
                ui.button(icon='print', on_click=self.on_export).props('flat round dense size=sm color=grey-9').tooltip('Export as Linear Document')
                
                ui.separator().props('vertical')
                
                ui.button(
                    icon='zoom_in',
                    on_click=self.on_zoom_in
                ).props('round flat dense size=sm color=grey-9').tooltip('Zoom In')
                
                ui.button(
                    icon='zoom_out',
                    on_click=self.on_zoom_out
                ).props('round flat dense size=sm color=grey-9').tooltip('Zoom Out')
                
                ui.button(
                    icon='center_focus_strong',
                    on_click=self.on_reset_view
                ).props('round flat dense size=sm color=grey-9').tooltip('Reset View')
