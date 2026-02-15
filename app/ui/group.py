from nicegui import ui
from app.models.group import Group as GroupModel

class GroupView:
    def __init__(self, group: GroupModel, on_move=None):
        self.group = group
        self.on_move = on_move

    async def handle_drag_end(self, e):
        detail = e.args['detail']
        new_x = detail['x']
        new_y = detail['y']
        
        dx = new_x - self.group.x
        dy = new_y - self.group.y
        
        self.group.x = new_x
        self.group.y = new_y
        await self.group.save()
        
        if self.on_move:
            if asyncio.iscoroutinefunction(self.on_move):
                 await self.on_move(self.group, dx, dy)
            else:
                 self.on_move(self.group, dx, dy)

    def render(self):
        group_id = f'group-{self.group.id}'
        
        with ui.card().style(f'position: absolute; left: {self.group.x}px; top: {self.group.y}px; width: {self.group.width}px; height: {self.group.height}px; pointer-events: auto;') \
                .classes('bg-slate-200 border-2 border-dashed border-slate-400 opacity-80 shadow-sm group-container p-0 overflow-hidden') \
                .props(f'id={group_id}') as self.group_container:
            
            # Drag handle for the group (a small header area)
            with ui.row().classes('w-full h-8 bg-slate-100 p-2 border-b border-slate-200 cursor-move items-center drag-handle'):
                ui.label(self.group.title).classes('text-xs font-bold text-slate-600')

            # Listen to custom move event and extract 'detail'
            self.group_container.on('card_moved', self.handle_drag_end, ['detail'])
            
        return self.group_container
