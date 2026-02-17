from typing import List, Optional, Dict, Any
from app.models.whiteboard import Whiteboard
from app.models.canvas_node import CanvasNode
from app.models.canvas_edge import CanvasEdge
from beanie.operators import Or

class BoardService:
    @staticmethod
    async def get_whiteboard_by_id(whiteboard_id: str) -> Optional[Whiteboard]:
        return await Whiteboard.find_one(Whiteboard.id == whiteboard_id)

    @staticmethod
    async def get_first_whiteboard() -> Optional[Whiteboard]:
        return await Whiteboard.find().sort("+created_at").first_or_none()

    @staticmethod
    async def create_whiteboard(name: str, parent_id: Optional[str] = None) -> Whiteboard:
        wb = Whiteboard(name=name, parent_id=parent_id)
        await wb.save()
        return wb

    @staticmethod
    async def save_whiteboard(whiteboard: Whiteboard) -> Whiteboard:
        await whiteboard.save()
        return whiteboard

    @staticmethod
    async def get_edge_by_id(edge_id: str) -> Optional[CanvasEdge]:
        return await CanvasEdge.get(edge_id)

    @staticmethod
    async def get_nodes(whiteboard_id: str) -> List[CanvasNode]:
        return await CanvasNode.find(CanvasNode.whiteboard_id == whiteboard_id).to_list()

    @staticmethod
    async def get_edges(whiteboard_id: str) -> List[CanvasEdge]:
        return await CanvasEdge.find(CanvasEdge.whiteboard_id == whiteboard_id).to_list()

    @staticmethod
    async def save_node(node: CanvasNode) -> CanvasNode:
        await node.save()
        return node

    @staticmethod
    async def save_edge(edge: CanvasEdge) -> CanvasEdge:
        await edge.save()
        return edge

    @staticmethod
    async def delete_nodes_and_edges(node_ids: List[str], whiteboard_id: str) -> Dict[str, int]:
        deleted_nodes = 0
        deleted_edges = 0
        
        for node_id in node_ids:
            node = await CanvasNode.find_one(CanvasNode.id == node_id)
            if node:
                await node.delete()
                deleted_nodes += 1
            
            edges = await CanvasEdge.find(
                CanvasEdge.whiteboard_id == whiteboard_id,
                Or(
                    CanvasEdge.fromNode == node_id,
                    CanvasEdge.toNode == node_id
                )
            ).to_list()
            
            for edge in edges:
                await edge.delete()
                deleted_edges += 1
                
        return {"nodes": deleted_nodes, "edges": deleted_edges}

    @staticmethod
    async def delete_edge(edge_id: str, whiteboard_id: str) -> bool:
        # Use find_one to match the id field specifically
        edge = await CanvasEdge.find_one(CanvasEdge.id == edge_id)
        
        if edge and edge.whiteboard_id == whiteboard_id:
            await edge.delete()
            return True
        return False

    @staticmethod
    async def export_to_json_canvas(whiteboard: Whiteboard) -> Dict[str, Any]:
        nodes = await BoardService.get_nodes(whiteboard.id)
        edges = await BoardService.get_edges(whiteboard.id)
        
        return {
            "nodes": [
                {
                    "id": n.id,
                    "type": n.type,
                    "x": n.x,
                    "y": n.y,
                    "width": n.width,
                    "height": n.height,
                    "text": n.text,
                    "file": n.file,
                    "url": n.url,
                    "text": n.text,
                    "file": n.file,
                    "url": n.url,
                    "color": n.color,
                    "exclude_from_export": n.exclude_from_export if hasattr(n, 'exclude_from_export') else False
                }
                for n in nodes
            ],
            "edges": [
                {
                    "id": e.id,
                    "fromNode": e.fromNode,
                    "toNode": e.toNode,
                    "fromSide": e.fromSide,
                    "toSide": e.toSide,
                    "label": e.label,
                    "color": e.color
                }
                for e in edges
            ]
        }

    @staticmethod
    async def import_from_json_canvas(whiteboard: Whiteboard, data: Dict[str, Any]):
        # Clear existing
        await CanvasNode.find(CanvasNode.whiteboard_id == whiteboard.id).delete()
        await CanvasEdge.find(CanvasEdge.whiteboard_id == whiteboard.id).delete()
        
        for node_data in data.get("nodes", []):
            node = CanvasNode(**node_data, whiteboard_id=whiteboard.id)
            await node.save()
            
        for edge_data in data.get("edges", []):
            edge = CanvasEdge(**edge_data, whiteboard_id=whiteboard.id)
            await edge.save()
