from nicegui import ui
from typing import Optional, List, Dict, Any, Callable
import json

class Excalidraw(ui.element):
    def __init__(self, on_change: Optional[Callable] = None) -> None:
        super().__init__('iframe')
        self._props['src'] = '/static/excalidraw.html'
        self.style('height: 100vh; width: 100%; border: none;')
        self.on_change = on_change
        
        self.on('excalidraw_ready', self.handle_ready)
        self.on('excalidraw_change', self.handle_change)
        
        self.on('mount', self.init_communication)

    async def init_communication(self):
        # Inject script to listen for messages from the iframe (child)
        # and forward them to this component (parent server)
        js = f"""
        const handler = (event) => {{
            // Ensure security: check origin if needed, but here same origin usually
            if (event.data?.type === 'ready') {{
                getElement({self.id}).$emit('excalidraw_ready');
            }}
            if (event.data?.type === 'change') {{
                getElement({self.id}).$emit('excalidraw_change', event.data.data);
            }}
        }};
        window.addEventListener('message', handler);
        // Cleanup? 
        """
        await ui.run_javascript(js)

    async def handle_ready(self, _):
        if 'initialData' in self._props:
            data = self._props['initialData']
            # Send data TO the iframe
            # accessing contentWindow of the iframe element
            js = f"""
            const iframe = document.getElementById('c{self.id}');
            if (iframe && iframe.contentWindow) {{
                iframe.contentWindow.postMessage({{ type: 'load', data: {json.dumps(data)} }}, '*');
            }}
            """
            await ui.run_javascript(js)

    async def handle_change(self, e):
        if self.on_change:
            # e.args is the data object { elements: ..., appState: ... }
            elements = e.args.get('elements', [])
            state = e.args.get('appState', {})
            await self.on_change(elements, state)

    def set_data(self, data):
        self._props['initialData'] = data
