import os
import shutil
import json
import zipfile
import tempfile
import asyncio
from typing import List, Dict, Any
from datetime import datetime

from app.models.whiteboard import Whiteboard
from app.models.folder import Folder
from app.models.canvas_node import CanvasNode
from app.models.canvas_edge import CanvasEdge
from app.models.card_library import LibraryCard

class DataService:
    """Service for exporting and importing all application data"""
    
    STATIC_UPLOADS_DIR = os.path.join(os.getcwd(), 'app', 'static', 'uploads')
    
    @staticmethod
    async def export_all_data() -> str:
        """
        Exports all DB collections and static uploads to a zip file.
        Returns the path to the zip file.
        """
        # Create a temporary directory
        with tempfile.TemporaryDirectory() as temp_dir:
            # 1. Export Database Collections
            data = {
                "version": "1.0",
                "timestamp": datetime.now().isoformat(),
                "whiteboards": [w.dict() for w in await Whiteboard.find_all().to_list()],
                "folders": [f.dict() for f in await Folder.find_all().to_list()],
                "nodes": [n.dict() for n in await CanvasNode.find_all().to_list()],
                "edges": [e.dict() for e in await CanvasEdge.find_all().to_list()],
                "library_cards": [c.dict() for c in await LibraryCard.find_all().to_list()]
            }
            
            # Serialize UUIDs and IDs to strings
            def json_serial(obj):
                if hasattr(obj, 'isoformat'):
                    return obj.isoformat()
                return str(obj)

            with open(os.path.join(temp_dir, 'database.json'), 'w', encoding='utf-8') as f:
                json.dump(data, f, default=json_serial, indent=2)
            
            # 2. Copy Uploads
            temp_uploads = os.path.join(temp_dir, 'uploads')
            if os.path.exists(DataService.STATIC_UPLOADS_DIR):
                shutil.copytree(DataService.STATIC_UPLOADS_DIR, temp_uploads)
            else:
                os.makedirs(temp_uploads)
                
            # 3. Zip it all
            zip_filename = f"telescope_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip"
            zip_path = os.path.join(tempfile.gettempdir(), zip_filename)
            
            shutil.make_archive(zip_path.replace('.zip', ''), 'zip', temp_dir)
            
            return zip_path

    @staticmethod
    async def import_all_data(zip_file_obj) -> bool:
        """
        Imports data from a zip file, REPLACING current state.
        zip_file_obj: file-like object or bytes from upload
        """
        try:
            with tempfile.TemporaryDirectory() as temp_dir:
                # Save uploaded file to temp zip
                zip_path = os.path.join(temp_dir, 'import.zip')
                with open(zip_path, 'wb') as f:
                    f.write(zip_file_obj.read())
                
                # Extract
                with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                    zip_ref.extractall(temp_dir)
                
                # Check for database.json
                db_path = os.path.join(temp_dir, 'database.json')
                if not os.path.exists(db_path):
                    raise Exception("Invalid backup: database.json missing")
                
                # 1. Restore Database (Clear then Insert)
                with open(db_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                # Clear existing
                await Whiteboard.delete_all()
                await Folder.delete_all()
                await CanvasNode.delete_all()
                await CanvasEdge.delete_all()
                await LibraryCard.delete_all()
                
                # Insert new (Bulk insert if supported, or loop)
                # Beanie .insert_many()
                if data.get('whiteboards'):
                    await Whiteboard.insert_many([Whiteboard(**d) for d in data['whiteboards']])
                if data.get('folders'):
                    await Folder.insert_many([Folder(**d) for d in data['folders']])
                if data.get('nodes'):
                    # Some nodes referencing parent_ids that don't exist yet? 
                    # IDs are preserved, so order shouldn't matter for Mongo/Beanie insert usually.
                    await CanvasNode.insert_many([CanvasNode(**d) for d in data['nodes']])
                if data.get('edges'):
                    await CanvasEdge.insert_many([CanvasEdge(**d) for d in data['edges']])
                if data.get('library_cards'):
                    await LibraryCard.insert_many([LibraryCard(**d) for d in data['library_cards']])
                
                # 2. Restore Uploads
                temp_uploads = os.path.join(temp_dir, 'uploads')
                if os.path.exists(temp_uploads):
                    # Clear existing uploads
                    if os.path.exists(DataService.STATIC_UPLOADS_DIR):
                        shutil.rmtree(DataService.STATIC_UPLOADS_DIR)
                    # Move new uploads
                    shutil.move(temp_uploads, DataService.STATIC_UPLOADS_DIR)
                else:
                    # If backup has no uploads, ensure dir exists empty
                    if not os.path.exists(DataService.STATIC_UPLOADS_DIR):
                        os.makedirs(DataService.STATIC_UPLOADS_DIR)
                        
            return True
        except Exception as e:
            print(f"Import Failed: {e}")
            raise e
