# Nomad Telescope

A visual thinking and note-taking application inspired by Heptabase, built with **FastAPI**, **NiceGUI**, and **MongoDB (Beanie)**. It features an infinite canvas, whiteboard organization with folders, and powerful export capabilities.

## Features

-   **Infinite Canvas**: Pan, zoom, and organize your thoughts visually using Konva.js.
-   **Card System**: Create text cards, file cards, and group them logically.
-   **Whiteboard Management**:
    -   Organize whiteboards into **Folders**.
    -   Drag-and-drop reordering for both folders and whiteboards.
    -   Sidebar navigation with search and filter capabilities.
-   **Export**:
    -   Export whiteboards to HTML (linear document format).
    -   **Exclusion**: Mark specific cards to be excluded from the export.
-   **Search & Filter**:
    -   Filter cards by text content or tags directly on the canvas.
    -   Visual fade-out effect for non-matching items.

## Tech Stack

-   **Backend**: Python, FastAPI, Beanie (ODM for MongoDB).
-   **Frontend**: NiceGUI (Vue.js wrapper), Konva.js (Canvas), TailwindCSS.
-   **Database**: MongoDB.

## Prerequisites

-   Python 3.8+
-   MongoDB (running locally on port 27017)

## Setup

1.  **Clone the repository**:
    ```bash
    git clone <repository-url>
    cd nomad-telescope
    ```

2.  **Create a virtual environment**:
    ```bash
    python -m venv .venv
    ```

3.  **Activate the virtual environment**:
    -   Windows: `.venv\Scripts\activate`
    -   Unix/MacOS: `source .venv/bin/activate`

4.  **Install dependencies**:
    ```bash
    pip install -r requirements.txt
    ```

## Running the Application

You can run the application using the helper script:

```bash
python run.py
```

Or directly with `uvicorn` (useful for development with reload):

```bash
uvicorn app.main:app --reload --port 8080
```

The application will be available at [http://localhost:8080](http://localhost:8080).

## Project Structure

```
nomad-telescope/
├── app/
│   ├── main.py              # Application entry point
│   ├── models/              # Beanie ODM Models
│   │   ├── whiteboard.py
│   │   ├── folder.py
│   │   ├── canvas_node.py   # Card data structure
│   │   └── ...
│   ├── services/            # Business logic (BoardService)
│   ├── ui/                  # NiceGUI Interfaces
│   │   ├── layout.py        # Main sidebar layout
│   │   ├── whiteboard.py    # Canvas view
│   │   ├── whiteboard_list.py # Sidebar list & folder logic
│   │   └── components/      # Reusable UI components
│   └── static/
│       └── js/              # Client-side JavaScript
│           └── infinite_canvas.js # Core Konva.js wrapper
├── run.py                   # Convenience runner script
├── requirements.txt         # Project dependencies
└── README.md                # This file
```

## Usage Tips

-   **Creating Content**: Double-click on the canvas to create a text card.
-   **Context Menu**: Right-click on the canvas or cards for more options.
-   **Folders**: Use the sidebar to create folders. Drag whiteboards into folders to organize them.
-   **Exporting**: Click the export button in the whiteboard header. Toggle the "printer" icon on cards to exclude them from the export.
