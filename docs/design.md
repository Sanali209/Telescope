# Heptabase Clone Design Document

## 1. Overview
This document outlines the design for a visual knowledge management application inspired by Heptabase. The core philosophy is to provide an infinite canvas for thinking, learning, and organizing ideas visually.

## 2. Core Features

### 2.1 Visual Whiteboards
- **Concept**: An infinite canvas where users can place and organize cards.
- **Functionality**:
    - Pan and zoom capabilities.
    - Drag and drop interface for cards.
    - Grouping of cards into sections or clusters.
    - Visual connections (lines/arrows) between cards to represent relationships.

### 2.2 Cards
- **Concept**: The atomic unit of information.
- **Content**: Supports Markdown text, images, code blocks, and other media.
- **Behavior**:
    - Cards can exist on multiple whiteboards simultaneously.
    - Editing a card updates it everywhere.
    - Double-clicking a card opens a focused editor view.

### 2.3 Card Grouping
- **Concept**: Organize related cards visually.
- **Functionality**:
    - Create a "section" or "group" container on the whiteboard.
    - Drag cards into the group.
    - Moving the group moves all contained cards.

### 2.4 Bi-Directional Linking
- **Concept**: Linking thoughts together.
- **Functionality**:
    - `[[WikiLink]]` syntax to link to other cards.
    - "Backlinks" section in each card showing what links to it.

### 2.5 Whiteboard Export
- **Concept**: Portable data.
- **Functionality**:
    - Export the entire whiteboard to a single Markdown file.
    - Structure:
        - Title of Whiteboard.
        - List of cards (as headers or blocks).
        - Connections represented as links or list items.

### 2.6 Sidebar Navigation
- **Left Sidebar**:
    - **Inbox**: Quick capture of thoughts.
    - **Whiteboards**: List of all whiteboards.
    - **All Cards**: A library view of all created cards.
    - **Tags**: Filter cards by tags.

## 3. User Interface (UI) Design

### 3.1 Layout
- **Left Sidebar (250px)**:
    - Dark/Light mode toggle.
    - Navigation menu.
    - Collapsible.
- **Main Canvas (Flex/Grow)**:
    - The infinite whiteboard area.
    - Zoom controls in the bottom right.
    - Toolbar (Text, Shape, Image, Connection) floating at the bottom center or top.
- **Right Sidebar (Optional/Collapsible)**:
    - Card details/Info panel.
    - Outliner view of the current whiteboard.

### 3.2 Visual Style
- **Theme**: Clean, minimalist, modern.
- **Colors**:
    - Background: Off-white/Light Gray (Light Mode), Dark Grey (Dark Mode).
    - Accents: Blue or Purple for active states and selection.
    - Text: High contrast for readability.
- **Typography**: Sans-serif fonts (Inter, Roboto) for a clean look.
- **Interactions**:
    - Smooth transitions for zooming and panning.
    - Hover effects on cards and buttons.
    - Subtle shadows to give depth to cards on the canvas.

## 4. Technical Architecture

### 4.1 Backend (FastAPI)
- **Framework**: FastAPI for high performance and easy API definition.
- **Database**: MongoDB with Beanie ODM for asynchronous database operations.
    - **Collections**: `cards`, `whiteboards`, `links`, `tags`.
- **Logging**: Loguru for structured and easy logging.

### 4.2 Frontend (NiceGUI)
- **Integration**: NiceGUI mounted on the FastAPI app using `ui.run_with(app)`. This allows both standard API endpoints and the UI to run on the same server instance/port.
- **Framework**: NiceGUI for building the UI in Python.
- **State Management**: Leveraging NiceGUI's binding capabilities and potentially a global state store.
- **Interactivity**:
    - Using NiceGUI's drag-and-drop primitives or integrating a JS library (like interacting.js or simply raw DOM events via NiceGUI's `ui.element` capabilities) for the whiteboard canvas.

### 4.3 Data Models
- **Card**:
    - `id`: UUID
    - `title`: String
    - `content`: String (Markdown)
    - `created_at`: Datetime
    - `updated_at`: Datetime
- **Whiteboard**:
    - `id`: UUID
    - `name`: String
    - `cards`: List of objects `{ card_id, x, y, width, height }`

## 5. Future Considerations
- **Real-time Collaboration**: Using WebSockets (supported by NiceGUI).
- **AI Integration**: Summary generation, auto-tagging.
- **Mobile Support**: Responsive design adjustments.
