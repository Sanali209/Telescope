from nicegui import ui
from typing import List, Callable, Any, Set

class BoardSearch:
    """Search and filter interface for the whiteboard"""
    def __init__(self, nodes: List[Any]):
        self.nodes = nodes
        self.render_tags_refreshable = ui.refreshable(self._render_tags)

    def render(self):
        with ui.element('div').classes('fixed top-4 right-4 z-[9999] flex flex-col gap-2 items-end'):
            # Search Bar
            with ui.row().classes('bg-white/90 backdrop-blur-md shadow-xl rounded-full px-4 py-1 items-center border border-slate-200/50'):
                ui.icon('search').classes('text-slate-400')
                search_input = ui.input(placeholder='Search cards...') \
                    .props('borderless dense') \
                    .classes('w-48 transition-all focus:w-64')
                
                def handle_search(e):
                    query = (e.value or '').lower().replace('"', '\\"')
                    ui.run_javascript(f'if (window.canvas) window.canvas.filterNodes("{query}")')
                
                search_input.on_value_change(handle_search)
                
                ui.button(icon='close', on_click=lambda: search_input.set_value('')).props('flat round dense color=grey-5').classes('scale-75')
            
            # Tag Quick Filter
            self.render_tags_refreshable()

    def _render_tags(self):
        all_tags: Set[str] = set()
        for node in self.nodes:
            if hasattr(node, 'tags') and node.tags:
                all_tags.update(node.tags)
        
        if all_tags:
            with ui.row().classes('gap-2'):
                for tag in sorted(list(all_tags)):
                    def filter_by_tag(t=tag):
                        ui.run_javascript(f'if (window.canvas) window.canvas.filterByTag("{t}")')
                    
                    ui.chip(tag, icon='local_offer', on_click=filter_by_tag, selectable=True) \
                        .classes('bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100 transition-colors')
                
                ui.button(icon='filter_list_off', on_click=lambda: ui.run_javascript('if (window.canvas) window.canvas.clearFilters()')) \
                    .props('flat round dense color=grey-5')

    def refresh_tags(self, new_nodes: List[Any]):
        self.nodes = new_nodes
        self.render_tags_refreshable.refresh()
