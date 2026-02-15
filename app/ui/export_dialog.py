from nicegui import ui
from app.utils.export import export_whiteboard_to_markdown

def open_export_dialog():
    async def download_markdown():
        content = await export_whiteboard_to_markdown("dummy_id")
        ui.download(content.encode('utf-8'), 'whiteboard_export.md')
        dialog.close()

    with ui.dialog() as dialog, ui.card():
        ui.label('Export Whiteboard')
        ui.label('Download the current whiteboard as a Markdown file.')
        with ui.row().classes('justify-end w-full'):
            ui.button('Cancel', on_click=dialog.close).props('flat')
            ui.button('Download', on_click=download_markdown)
    
    dialog.open()
