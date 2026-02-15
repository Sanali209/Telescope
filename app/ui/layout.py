from nicegui import ui
from app.ui.whiteboard_list import WhiteboardList
from app.ui.whiteboard import WhiteboardView

async def create_layout(whiteboard_id: str = None):
    # Sidebar
    from nicegui import app
    is_mini = app.storage.user.get('drawer_mini', True)
    
    with ui.left_drawer(value=True).classes('bg-slate-100 border-r border-slate-200 transition-all duration-300 overflow-hidden') \
            .props(f'{"mini" if is_mini else ""} width={60 if is_mini else 300}') as drawer:
        
        state = {'mini': is_mini}
        
        def toggle_drawer():
            state['mini'] = not state['mini']
            app.storage.user['drawer_mini'] = state['mini']
            if state['mini']:
                drawer.props('mini width=60')
            else:
                drawer.props(remove='mini')
                drawer.props('width=300')

        # Drawer Toggle (Icon only)
        with ui.row().classes('w-full items-center justify-start px-2 py-4'):
             ui.button(icon='menu', on_click=toggle_drawer).props('flat round dense color=grey-8')

        with ui.column().classes('w-full px-2'):
            # Whiteboard List
            wb_list = WhiteboardList()
            await wb_list.render()

    # Main Content
    with ui.column().classes('w-full flex-grow p-0 m-0 overflow-hidden'):
        view = WhiteboardView(whiteboard_id=whiteboard_id)
        view.on_whiteboard_create = wb_list.refresh
        await view.render()
