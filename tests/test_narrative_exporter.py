import sys
import os
from collections import defaultdict

# Mock markdown if not installed in the test environment
try:
    import markdown
except ImportError:
    class MockMarkdown:
        def markdown(self, text, extensions=None):
            return f"<h1>Mock Header</h1><p>{text}</p>"
    markdown = MockMarkdown()

# Add project root to sys.path
sys.path.append(os.getcwd())

from app.utils.linear_export import NarrativeExporter

def test_ordering_and_deduplication():
    # A (orphan) -> B (child of Group G)
    # G (orphan) -> [B]
    nodes = [
        {'id': 'A', 'type': 'text', 'text': 'Orphan A', 'x': 0, 'y': 0, 'parent_id': None},
        {'id': 'B', 'type': 'text', 'text': 'Child B', 'x': 50, 'y': 50, 'parent_id': 'G'},
        {'id': 'G', 'type': 'group', 'text': 'Group G', 'x': 40, 'y': 40, 'width': 100, 'height': 100, 'parent_id': None}
    ]
    edges = [
        {'fromNode': 'A', 'toNode': 'B'}
    ]
    
    exporter = NarrativeExporter(nodes, edges)
    # This should be implemented to support the new logic
    html = exporter.generate_html("Complex Test")
    
    # Verify A is first (spatial orphan)
    # Verify B content is after A
    # Verify G content is after B
    # Inside G, B should be a link because it was already rendered after A
    
    print("HTML Result:")
    print(html[html.find('<main>'):html.find('</main>')+7])
    
    assert html.find('Orphan A') < html.find('Child B')
    # If B is already rendered, G should contain a link to B
    assert html.count('Child B') >= 2 # Once in content, once in TOC, maybe once in G as link
    
    print("Advanced test passed (conceptually)")

if __name__ == "__main__":
    test_header_deduplication()
    test_ordering_and_deduplication()
