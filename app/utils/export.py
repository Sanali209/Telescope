from app.models.whiteboard import Whiteboard
from app.models.card import Card
from app.models.group import Group
import json

async def export_whiteboard_to_markdown(whiteboard_id: str) -> str:
    # Fetch all cards and groups
    cards = await Card.find_all().to_list()
    groups = await Group.find_all().to_list()
    
    markdown_content = f"# Whiteboard Export\n\n"
    
    # Process groups first
    group_map = {str(g.id): g for g in groups}
    cards_by_group = {str(g.id): [] for g in groups}
    ungrouped_cards = []
    
    for card in cards:
        if card.group_id and card.group_id in group_map:
            cards_by_group[card.group_id].append(card)
        else:
            ungrouped_cards.append(card)
            
    # Write grouped cards
    for group in groups:
        markdown_content += f"## Group: {group.title}\n\n"
        for card in cards_by_group[str(group.id)]:
            markdown_content += f"### {card.title or 'Untitled'}\n\n"
            markdown_content += f"{card.content}\n\n"
            markdown_content += f"---\n\n"
        markdown_content += f"\n"
        
    # Write ungrouped cards
    if ungrouped_cards:
        markdown_content += f"## Ungrouped Cards\n\n"
        for card in ungrouped_cards:
            markdown_content += f"### {card.title or 'Untitled'}\n\n"
            markdown_content += f"{card.content}\n\n"
            markdown_content += f"---\n\n"
        
    return markdown_content
