import markdown
from typing import List, Dict, Set, Optional
from collections import defaultdict
import re

class NarrativeExporter:
    """
    Exports whiteboard content as a linear document based on narrative flow.
    Uses topological sort on connections, with spatial fallbacks.
    """
    def __init__(self, nodes: List[Dict], edges: List[Dict]):
        # Index nodes by ID for O(1) lookup
        self.nodes = {n['id']: n for n in nodes}
        self.edges = edges
        
        # Build adjacency graph and hierarchy
        self.adj = defaultdict(list)
        self.children = defaultdict(list)
        self.in_degree = defaultdict(int)
        
        for edge in edges:
            from_id = edge['fromNode']
            to_id = edge['toNode']
            if from_id in self.nodes and to_id in self.nodes:
                self.adj[from_id].append(to_id)
                self.in_degree[to_id] += 1
                
        for node in nodes:
            parent_id = node.get('parent_id')
            if parent_id and parent_id in self.nodes:
                self.children[parent_id].append(node['id'])

        # Index edge data for label lookup
        self.edge_map = {(e['fromNode'], e['toNode']): e for e in edges}
        
    def get_order(self) -> List[Dict]:
        """
        Returns a list of node objects in narrative order.
        1. Start with orphan nodes (no parent_id).
        2. Follow parent-child hierarchy and connections via DFS.
        """
        visited = set()
        order = []
        path = set()
        
        # Sort candidates (orphans first, then spatial)
        candidates = list(self.nodes.values())
        candidates.sort(key=lambda n: (0 if n.get('parent_id') is None else 1, n['y'], n['x']))
        
        def visit(node_id):
            if node_id in visited:
                return
            if node_id in path: # Cycle detection
                return
            
            node = self.nodes[node_id]

            # 0. Contextual Group Placement: If referenced node is in a group, ensure group is visited first
            parent_id = node.get('parent_id')
            if parent_id and parent_id in self.nodes and parent_id not in visited:
                visit(parent_id)
                # After visiting parent, this node should have been visited as a child.
                # If so, return. If not (weird graph state), proceed.
                if node_id in visited:
                    return

            # Filter Empty Groups
            if node.get('type') == 'group':
                children = self.children.get(node_id, [])
                if not children:
                    visited.add(node_id) # Mark visited so we don't process again
                    return

            path.add(node_id)
            visited.add(node_id)
            order.append(node)
            
            # 1. Visit children first (if group)
            child_ids = self.children.get(node_id, [])
            children = [self.nodes[cid] for cid in child_ids if cid in self.nodes]
            children.sort(key=lambda n: (n['y'], n['x']))
            for child in children:
                visit(child['id'])
                
            # 2. Visit outgoing connections
            adj_ids = self.adj.get(node_id, [])
            neighbors = [self.nodes[nid] for nid in adj_ids if nid in self.nodes]
            neighbors.sort(key=lambda n: (n['y'], n['x']))
            for neighbor in neighbors:
                visit(neighbor['id'])
                
            path.remove(node_id)

        # Iterate and Visit
        for node in candidates:
            if node['id'] not in visited and node.get('parent_id') is None:
                visit(node['id'])
                
        # Safety catch for remaining unvisited nodes (if any logic missed them)
        for node in candidates:
            if node['id'] not in visited:
                visit(node['id'])
        
        return order

    def generate_html(self, whiteboard_name: str) -> str:
        ordered_nodes = self.get_order()
        
        # 1. Table of Contents
        toc_html = "<div class='toc'><h2>Table of Contents</h2><ul>"
        for node in ordered_nodes:
            title = self._get_title(node)
            if title:
                toc_html += f"<li><a href='#{node['id']}'>{title}</a></li>"
        toc_html += "</ul></div>"
        
        # 2. Content Body & Tag Collection
        body_html = ""
        tag_map = defaultdict(list)
        rendered_full = set() # Track nodes rendered with full content
        
        for node in ordered_nodes:
            body_html += self._render_node(node, rendered_full)
            
            # Collect tags
            tags = node.get('tags', [])
            title = self._get_title(node)
            for tag in tags:
                tag_map[tag].append({'id': node['id'], 'title': title})
            
        # 3. Tag Index
        tag_index_html = ""
        if tag_map:
            tag_index_html = "<div class='tag-index'><h2>Tag Index</h2><div class='tag-list'>"
            for tag in sorted(tag_map.keys()):
                refs = tag_map[tag]
                links = [f"<a href='#{ref['id']}'>{ref['title']}</a>" for ref in refs]
                tag_index_html += f"<div class='tag-item'><strong>#{tag}</strong>: {', '.join(links)}</div>"
            tag_index_html += "</div></div>"
            
        # Full HTML Template
        return f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>{whiteboard_name}</title>
    <style>
        body {{
            max-width: 800px;
            margin: 0 auto;
            padding: 40px;
            font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #333;
        }}
        h1, h2, h3 {{ color: #2c3e50; page-break-after: avoid; }}
        a {{ color: #3498db; text-decoration: none; }}
        a:hover {{ text-decoration: underline; }}
        .node-section {{
            margin-bottom: 2em;
            padding-bottom: 2em;
            border-bottom: 1px solid #eee;
        }}
        .node-meta {{
            font-size: 0.9em;
            color: #555;
            margin-bottom: 0.5em;
            background: #f9f9f9;
            padding: 8px;
            border-radius: 4px;
        }}
        .ref-group {{ margin-bottom: 4px; }}
        img {{ max-width: 100%; height: auto; display: block; margin: 1em 0; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }}
        pre {{
            background: #f8f9fa;
            padding: 1em;
            border-radius: 4px;
            overflow-x: auto;
        }}
        blockquote {{
            border-left: 4px solid #3498db;
            margin: 0;
            padding-left: 1em;
            color: #555;
        }}
        .toc {{
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 40px;
        }}
        .toc ul {{ list-style-type: none; padding-left: 0; }}
        .toc li {{ margin-bottom: 8px; }}
        
        .tag-index {{
            margin-top: 60px;
            padding-top: 20px;
            border-top: 2px solid #333;
            page-break-before: always;
        }}
        .tag-item {{ margin-bottom: 0.5em; }}
        
        @media print {{
            body {{ padding: 0; }}
            .toc {{ display: none; }}
            a {{ text-decoration: none; color: #000; }}
            .node-section {{ break-inside: avoid; }}
        }}
    </style>
</head>
<body>
    <h1>{whiteboard_name}</h1>
    {toc_html}
    <main>
        {body_html}
    </main>
    {tag_index_html}
</body>
</html>
"""

    def _get_title(self, node):
        node_type = node.get('type')
        if node_type == 'text':
            # Extract first line or use explicit title if available
            text = node.get('text') or ''
            lines = text.strip().split('\\n')
            if lines and lines[0]:
                return lines[0].replace('#', '').strip()
            return "Untitled Note"
        elif node_type == 'file':
            # Use filename as title if possible
            path = node.get('file', '')
            if path:
                return path.split('/')[-1].split('_', 1)[-1] # Remove uuid prefix if present
            return "Untitled Image"
        elif node_type == 'group':
            return node.get('text') or "Untitled Group"
            
        return "Untitled Section"

    def _render_node(self, node, rendered_full: Set[str]):
        node_id = node['id']
        title = self._get_title(node)
        node_type = node.get('type')
        
        # If already rendered fully elsewhere, just provide a link
        if node_id in rendered_full:
            return f"""
            <div class="node-section" id="{node_id}-link">
                <p><strong>See above:</strong> <a href="#{node_id}">{title}</a></p>
            </div>
            """
        
        rendered_full.add(node_id)
        
        content_html = ""
        
        if node_type == 'text':
            content = node.get('text') or ''
            # Convert Markdown to HTML
            content_html = markdown.markdown(
                content, 
                extensions=['fenced_code', 'tables', 'nl2br']
            )
        elif node_type == 'file':
            content_html = self._render_image(node)
        elif node_type == 'group':
            # For groups, list children as links if they exist
            child_ids = self.children.get(node_id, [])
            if child_ids:
                content_html = "<div class='group-members'><strong>Group Members:</strong><ul>"
                for cid in child_ids:
                    child = self.nodes.get(cid)
                    if child:
                        child_title = self._get_title(child)
                        content_html += f"<li><a href='#{cid}'>{child_title}</a></li>"
                content_html += "</ul></div>"
        
        # Determine "See Also" links (outgoing connections)
        # Group links by label
        links_by_label = defaultdict(list)
        outgoing_ids = self.adj.get(node_id, [])
        
        for to_id in outgoing_ids:
            if to_id in self.nodes:
                target = self.nodes[to_id]
                edge_data = self.edge_map.get((node_id, to_id), {})
                label = edge_data.get('label') or "See also"
                links_by_label[label].append(target)
        
        links_html = ""
        if links_by_label:
            links_html = "<div class='node-meta'>"
            for label, targets in links_by_label.items():
                target_links = []
                for target in targets:
                    target_title = self._get_title(target)
                    target_links.append(f"<a href='#{target['id']}'>{target_title}</a>")
                links_html += f"<div class='ref-group'><strong>{label}:</strong> {', '.join(target_links)}</div>"
            links_html += "</div>"


        # Add tags to meta
        tags = node.get('tags', [])
        tags_html = ""
        if tags:
             tags_html = f"<div class='node-meta'><strong>Tags:</strong> {', '.join(['#'+t for t in tags])}</div>"

        # Determine if we should render a section title
        # If it's a markdown node and starts with a header, we skip the section title to avoid doubling
        show_section_title = True
        if node_type == 'text' and content_html.strip().startswith(('<h1', '<h2', '<h3')):
            show_section_title = False

        header_html = f"<h2>{title}</h2>" if show_section_title else ""

        return f"""
        <div class="node-section" id="{node_id}">
            {header_html}
            {content_html}
            {links_html}
            {tags_html}
        </div>
        """

    def _render_image(self, node):
        """Embed image as base64 to ensure offline portability"""
        import base64
        import os
        
        file_path = node.get('file', '')
        if not file_path:
            return "<p><em>[Missing file path]</em></p>"
            
        # Convert web path (/static/uploads/...) to OS path
        # Assuming run.py is in project root
        project_root = os.getcwd() 
        # file_path is likely "/static/uploads/filename"
        # remove leading slash
        rel_path = file_path.lstrip('/')
        abs_path = os.path.join(project_root, 'app', rel_path)
        
        try:
            with open(abs_path, "rb") as image_file:
                encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
                
            # Determine mime type
            ext = os.path.splitext(abs_path)[1].lower()
            mime_type = "image/png" # default
            if ext in ['.jpg', '.jpeg']: mime_type = "image/jpeg"
            elif ext == '.gif': mime_type = "image/gif"
            elif ext == '.webp': mime_type = "image/webp"
            elif ext == '.svg': mime_type = "image/svg+xml"
            
            return f'<img src="data:{mime_type};base64,{encoded_string}" alt="{self._get_title(node)}">'
        except Exception as e:
            print(f"Error embedding image {abs_path}: {e}")
            return f"<p><em>[Image not found: {self._get_title(node)}]</em></p>"
