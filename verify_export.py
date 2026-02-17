import sys
import os
sys.path.append(os.getcwd())

from app.utils.linear_export import NarrativeExporter

# Mock node with standard newline
nodes = [{
    'id': '1',
    'type': 'text',
    'text': '# My Title\nThis is the body content.',
    'x': 0, 'y': 0, 'width': 100, 'height': 100
}]
edges = []

exporter = NarrativeExporter(nodes, edges)
html = exporter.generate_html("Test Board")

print("-" * 20)
print("Generated HTML snippet:")
print(html[:500]) 
print("-" * 20)

passed = True

if "My Title" in html:
    print("PASS: 'My Title' found in HTML")
else:
    print("FAIL: 'My Title' NOT found")
    passed = False

# specific check for title in TOC link
if ">My Title</a>" in html:
     print("PASS: Title correctly extracted for TOC link")
else:
     print(f"FAIL: Title link looks wrong. Expected '>My Title</a>'.")
     passed = False

if passed:
    print("\nALL CHECKS PASSED")
else:
    print("\nSOME CHECKS FAILED")
