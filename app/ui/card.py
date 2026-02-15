from nicegui import ui
from app.models.card import Card as CardModel

class CardView:
    def __init__(self, card: CardModel, on_move=None):
        self.card = card
        self.on_move = on_move

    async def save_content(self):
        self.card.content = self.content_input.value
        await self.card.save()
        self.view_mode.visible = True
        self.edit_mode.visible = False
        self.md_view.content = self.card.content
        ui.notify('Card saved')

    def render(self):
        card_id = f'card-{self.card.id}'
        # Use p-0 to remove Quasar's default card padding which causes offsets
        with ui.card().style(f'position: absolute; left: {self.card.x}px; top: {self.card.y}px; width: {self.card.width}px; height: {self.card.height}px; pointer-events: auto;') \
                .classes('shadow-lg select-none group flex flex-col z-10 p-0 overflow-hidden border-0') \
                .props(f'id={card_id}') as self.card_container:
            
            # Drag handle (header)
            with ui.row().classes('w-full bg-slate-50 p-2 border-b border-slate-100 cursor-move justify-between items-center drag-handle'):
                ui.label(self.card.title or "Untitled").classes('text-xs font-bold truncate text-slate-800')
                with ui.row().classes('gap-1'):
                     ui.button(icon='edit', on_click=lambda: self.toggle_edit()).props('flat round dense size=xs')
                     ui.button(icon='close', on_click=self.delete_card).props('flat round dense size=xs color=red')

            # Content Area
            with ui.scroll_area().classes('w-full h-full relative'):
                # View Mode
                with ui.column().classes('w-full p-3') as self.view_mode:
                    self.md_view = ui.markdown(self.card.content).classes('text-sm text-slate-700')
                    self.view_mode.on('dblclick.stop.prevent', self.toggle_edit)

                # Edit Mode
                with ui.column().classes('w-full h-full p-3') as self.edit_mode:
                    self.content_input = ui.textarea(value=self.card.content).classes('w-full h-full text-sm font-mono').props('borderless')
                    with ui.row().classes('w-full justify-end mt-2'):
                         ui.button('Save', on_click=self.save_content).props('flat size=sm color=primary')
                self.edit_mode.visible = False
            
        return self.card_container

    def toggle_edit(self):
        self.view_mode.visible = False
        self.edit_mode.visible = True
    
    async def delete_card(self):
        await self.card.delete()
        self.card_container.delete()
