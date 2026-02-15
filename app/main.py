from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from nicegui import ui, app as nicegui_app
from app.database import init_db
from app.ui.layout import create_layout
from dotenv import load_dotenv
import os

load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(lifespan=lifespan)

# Mount static files directory for serving JS/CSS
static_dir = os.path.join(os.path.dirname(__file__), 'static')
app.mount('/static', StaticFiles(directory=static_dir), name='static')

# Define the UI layout and pages
@ui.page('/')
async def main_page(id: str = None):
    ui.add_head_html('''
        <style>
            html, body { 
                margin: 0; 
                padding: 0; 
                overflow: hidden; 
                height: 100vh;
                width: 100vw;
            }
            #q-app { height: 100vh; width: 100vw; overflow: hidden; }
            .nicegui-content { padding: 0 !important; height: 100vh; overflow: hidden; display: flex; flex-direction: column; }
        </style>
    ''')
    await create_layout(whiteboard_id=id)

ui.run_with(
    app,
    title='Nomad Telescope',
    storage_secret='secret-key',  # Replace with a real secret in production
)
