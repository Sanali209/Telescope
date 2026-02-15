from nicegui import ui
from app.models.whiteboard import Whiteboard
from app.models.folder import Folder
from typing import List, Optional, Dict
import asyncio

class WhiteboardList:
    def __init__(self):
        self.container = None
        self.folders: List[Folder] = []
        self.whiteboards: List[Whiteboard] = []

    async def render(self):
        self.container = ui.column().classes('w-full gap-0')
        await self.refresh()

    async def refresh(self):
        self.container.clear()
        
        # Fetch data
        self.folders = await Folder.find_all().sort(+Folder.order).to_list()
        self.whiteboards = await Whiteboard.find_all().sort(+Whiteboard.order).to_list()
        
        # Group whiteboards
        wb_by_folder: Dict[Optional[str], List[Whiteboard]] = {f.id: [] for f in self.folders}
        wb_by_folder[None] = []
        
        for wb in self.whiteboards:
            if wb.folder_id in wb_by_folder:
                wb_by_folder[wb.folder_id].append(wb)
            else:
                # Fallback for orphaned whiteboards or if folder deleted
                wb_by_folder[None].append(wb)

        with self.container:
            # 1. Folders Section
            # We use a sortable list for folders themselves? User said "rearrange witeboards", but usually folders too.
            # For simplicity, render folders first, then root whiteboards.
            
            for folder in self.folders:
                # We wrap in a row to potentially allowing sorting of folders themselves later, 
                # or just to provide a clean container for the row context.
                with ui.row().classes('w-full items-center group no-wrap flex-nowrap pl-2 pr-2 py-0 hover:bg-slate-200 transition-colors') as folder_row:
                    folder_row.props(f'data-folder-id="{folder.id}"')
                    
                    # Folder Expansion
                    with ui.expansion('', icon='folder').classes('w-full text-sm text-slate-700').props('header-class="p-0 min-h-8 w-full group/exp" hide-expand-icon') as expansion:
                        # Custom header with slot
                        with expansion.add_slot('header'):
                            with ui.row().classes('w-full items-center no-wrap flex-nowrap cursor-pointer gap-2'):
                                # Icon
                                ui.icon('folder', size='xs').classes('text-slate-500 flex-shrink-0')
                                # Label (Double click to rename)
                                lbl = ui.label(folder.name).classes('text-body2 text-slate-700 truncate flex-grow select-none')
                                # Prevent toggle when clicking name
                                lbl.on('click.stop', lambda: None)
                                lbl.on('dblclick.stop', lambda _, f=folder: self.rename_folder_dialog(f))
                                
                                # Edit Button (Right aligned, always visible but subtle)
                                with ui.button(icon='more_vert').props('flat round dense size=sm').classes('text-slate-300 hover:text-slate-700 transition-colors flex-shrink-0') as edit_btn:
                                    edit_btn.on('click.stop', lambda: None)
                                    with ui.menu():
                                        ui.menu_item('Rename', on_click=lambda f=folder: self.rename_folder_dialog(f))
                                        ui.menu_item('Delete', on_click=lambda f=folder: self.delete_folder(f), auto_close=True).classes('text-red')

                                # Expand icon (chevron) - Always visible
                                ui.icon('expand_more').classes('text-slate-400 transition-transform duration-200 flex-shrink-0')

                        # Content (Whiteboards in folder)
                        with ui.element('div').classes('w-full pl-4') as drop_zone:
                             await self.render_sortable_whiteboards(wb_by_folder[folder.id], folder_id=folder.id)

            # 2. Root Whiteboards Section
            await self.render_sortable_whiteboards(wb_by_folder[None], folder_id=None)

            ui.separator().classes('my-2')
            
            # Action Buttons
            with ui.row().classes('w-full px-2 gap-2'):
                ui.button(on_click=self.create_whiteboard, icon='note_add').props('flat round dense size=sm').tooltip('New Whiteboard')
                ui.button(on_click=self.create_folder, icon='create_new_folder').props('flat round dense size=sm').tooltip('New Folder')

    async def render_sortable_whiteboards(self, whiteboards: List[Whiteboard], folder_id: Optional[str]):
        # Manual SortableJS implementation
        # 1. Ensure SortableJS is loaded (idempotent)
        ui.add_head_html('<script src="https://cdnjs.cloudflare.com/ajax/libs/Sortable/1.15.2/Sortable.min.js"></script>')
        
        fid_str = str(folder_id) if folder_id else "root"
        container_id = f"sortable-{fid_str}"
        
        # Container for the sortable list
        # We give it a unique ID for JS to find
        with ui.element('div').classes('w-full min-h-8 p-1 space-y-1').props(f'id="{container_id}"') as container:
            for wb in whiteboards:
                with ui.row().classes('w-full items-center group/wb no-wrap flex-nowrap py-1 px-2 cursor-pointer hover:bg-slate-200 transition-colors rounded relative-position draggable-item') as row:
                    # We store the ID in the DOM for JS retrieval
                    row.props(f'data-id="{wb.id}"')
                    
                    with ui.link(target=f'/?id={wb.id}').classes('flex-grow no-underline text-slate-700 hover:text-blue-600 overflow-hidden flex flex-row items-center flex-nowrap gap-2'):
                         ui.icon('dashboard', size='xs').classes('flex-shrink-0 text-slate-400')
                         ui.label(wb.name or "Untitled").classes('truncate text-sm select-none flex-grow min-w-0 whitespace-nowrap')

                    # Delete button (visible on hover)
                    # Use click.stop to prevent triggering row click if we add one later
                    ui.button(icon='close', on_click=lambda w=wb: self.delete_wb(w)).props('flat round dense size=xs color=red').classes('opacity-0 group-hover/wb:opacity-100 transition-opacity flex-shrink-0').on('click', lambda: None)

        # Initialize SortableJS for this container
        
        init_script = f'''
            if (typeof Sortable !== 'undefined') {{
                const el = document.getElementById('{container_id}');
                if (el) {{
                    new Sortable(el, {{
                        group: 'whiteboards',
                        animation: 150,
                        ghostClass: 'opacity-50', 
                        onEnd: function (evt) {{
                            const itemId = evt.item.getAttribute('data-id');
                            const targetIdStr = evt.to.id; 
                            
                            // Dispatch a standard DOM CustomEvent. 
                            // NiceGUI's ui.on() can listen to this if we specify the 'detail' argument.
                            el.dispatchEvent(new CustomEvent('drag_end', {{
                                detail: {{
                                    item_id: itemId,
                                    to_container_id: targetIdStr,
                                    new_index: evt.newIndex
                                }},
                                bubbles: true,
                            }}));
                        }}
                    }});
                }}
            }}
        '''
        ui.run_javascript(init_script)
        
        # Attach the event listener to this specific container
        # We specify ['detail'] to tell NiceGUI to extract the 'detail' property from the event object
        container.on('drag_end', self.handle_manual_drag_end, ['detail'])

    async def handle_manual_drag_end(self, e):
        # e.args: { detail: { item_id, to_container_id, new_index } }
        print(f"DEBUG: Drag End Event Received: {e.args}")
        data = e.args['detail']
        wb_id = data['item_id']
        to_container = data['to_container_id']
        new_index = data['new_index']
        
        # Parse folder ID from container ID "sortable-{fid}"
        target_folder_id = None
        if to_container.startswith("sortable-"):
            fid_part = to_container[len("sortable-"):]
            target_folder_id = None if fid_part == "root" else fid_part
        else:
            print(f"ERROR: Unknown container ID format: {to_container}")
            return

        print(f"DEBUG: Parsed Target Folder ID: {target_folder_id} (type: {type(target_folder_id)})")

        # 1. Update WB
        wb = await Whiteboard.get(wb_id)
        if not wb: 
            print(f"ERROR: Whiteboard not found in DB: {wb_id}")
            return
        
        print(f"DEBUG: Moving Whiteboard '{wb.name}' (ID: {wb.id}) from Folder '{wb.folder_id}' to Folder '{target_folder_id}' at index {new_index}")

        # Update folder_id
        wb.folder_id = target_folder_id
        await wb.save() # Save immediately to test basic update
        print(f"DEBUG: Saved WB {wb.id} with new folder_id: {wb.folder_id}")

        # 2. Reorder logic
        # We need to re-fetch items in the target folder to get the current list
        target_folder_id_val = target_folder_id 
        
        items_in_target = await Whiteboard.find(Whiteboard.folder_id == target_folder_id_val).sort(+Whiteboard.order).to_list()
        print(f"DEBUG: Items in target folder BEFORE reorder (count: {len(items_in_target)}): {[w.name for w in items_in_target]}")
        
        # Filter out the moved wb if it was already in this folder (reorder case)
        # We need to filter by ID string comparison to be safe
        items_in_target = [w for w in items_in_target if str(w.id) != str(wb.id)]
        
        # Insert at new position
        if new_index < 0: new_index = 0
        if new_index > len(items_in_target): new_index = len(items_in_target)
        
        items_in_target.insert(new_index, wb)
        print(f"DEBUG: Items in target folder AFTER insert (count: {len(items_in_target)}): {[w.name for w in items_in_target]}")
        
        # Save all with new order
        for idx, w in enumerate(items_in_target):
            w.order = idx
            w.folder_id = target_folder_id_val
            await w.save()
            # print(f"DEBUG: Updated order for {w.name} to {idx}")
            
        print("DEBUG: All items saved with new order.")
        ui.notify('Order updated')
        
        # Refresh to sync UI state and ensure IDs are clean
        await self.refresh() 

    # Button Actions
    async def create_whiteboard(self):
        new_wb = Whiteboard(name="New Whiteboard", order=9999) # Put at end
        await new_wb.save()
        await self.refresh()
        ui.navigate.to(f'/?id={new_wb.id}')

    async def create_folder(self):
        new_folder = Folder(name="New Folder", order=len(self.folders))
        await new_folder.save()
        await self.refresh()

    async def delete_wb(self, wb: Whiteboard):
        await wb.delete()
        ui.notify(f'Whiteboard "{wb.name}" deleted')
        await self.refresh()

    async def delete_folder(self, folder: Folder):
        # Move children to root instead of deleting? Or delete?
        # User said "remove whiteboard tree...". Usually delete folder deletes content or warns.
        # Let's move children to root to be safe.
        children = await Whiteboard.find(Whiteboard.folder_id == folder.id).to_list()
        for child in children:
            child.folder_id = None
            await child.save()
        
        await folder.delete()
        ui.notify(f'Folder "{folder.name}" deleted')
        await self.refresh()
    
    async def rename_folder_dialog(self, folder: Folder):
        with ui.dialog() as dialog, ui.card():
            ui.label('Rename Folder')
            name_input = ui.input('Name', value=folder.name).classes('w-full')
            with ui.row().classes('w-full justify-end'):
                ui.button('Cancel', on_click=dialog.close).props('flat')
                async def save():
                    folder.name = name_input.value
                    await folder.save()
                    dialog.close()
                    # Small delay to allow dialog to cleanup before refreshing parent
                    # This prevents the "Cannot read properties of undefined (reading 'props')" error
                    # which happens if the input component is unmounted too quickly during parent refresh
                    await asyncio.sleep(0.1)
                    await self.refresh()
                ui.button('Save', on_click=save)
        dialog.open()
