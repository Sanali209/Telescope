/**
 * Card Editor - Floating DOM editor for Markdown editing
 * Overlays the canvas when a card is double-clicked
 */

class CardEditor {
    constructor(canvas) {
        console.log('[CardEditor] Initializing...');
        this.canvas = canvas;
        this.activeCardId = null;
        this.editorEl = null;
        this.overlayEl = null;

        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.createEditor());
        } else {
            this.createEditor();
        }
    }

    createEditor() {
        console.log('[CardEditor] Creating editor DOM elements');
        // Create overlay backdrop
        this.overlayEl = document.createElement('div');
        this.overlayEl.id = 'card-editor-overlay';
        this.overlayEl.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.5);
            display: none;
            z-index: 10000;
            backdrop-filter: blur(2px);
        `;

        // Create editor container
        this.editorEl = document.createElement('div');
        this.editorEl.id = 'card-editor';
        this.editorEl.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 600px;
            max-width: 90vw;
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            display: none;
            flex-direction: column;
            z-index: 10001;
        `;

        // Header
        const header = document.createElement('div');
        header.style.cssText = `
            padding: 16px 20px;
            border-bottom: 1px solid #e2e8f0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;
        header.innerHTML = `
            <h3 style="margin: 0; font-size: 18px; font-weight: 600; color: #1e293b;">Edit Card</h3>
            <button id="close-editor" style="
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #64748b;
                padding: 0;
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 6px;
                transition: background 0.2s;
            ">&times;</button>
        `;

        // Title Input
        const titleContainer = document.createElement('div');
        titleContainer.style.cssText = 'padding: 20px 20px 0 20px;';

        const titleLabel = document.createElement('div');
        titleLabel.textContent = 'Title:';
        titleLabel.style.cssText = 'font-size: 12px; font-weight: 500; color: #64748b; margin-bottom: 8px;';

        this.titleInput = document.createElement('input');
        this.titleInput.id = 'card-title-editor';
        this.titleInput.placeholder = 'Card Title';
        this.titleInput.style.cssText = `
            width: 100%;
            padding: 8px 12px;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            font-size: 16px;
            font-weight: 600;
            color: #1e293b;
            outline: none;
            transition: border-color 0.2s;
            margin-bottom: 4px;
        `;

        this.titleInput.addEventListener('focus', () => {
            this.titleInput.style.borderColor = '#3b82f6';
        });

        this.titleInput.addEventListener('blur', () => {
            this.titleInput.style.borderColor = '#cbd5e1';
        });

        titleContainer.appendChild(titleLabel);
        titleContainer.appendChild(this.titleInput);

        // Content Label
        const contentLabel = document.createElement('div');
        contentLabel.textContent = 'Content:';
        contentLabel.style.cssText = 'padding: 10px 20px 0 20px; font-size: 12px; font-weight: 500; color: #64748b;';

        // Textarea
        const textareaContainer = document.createElement('div');
        textareaContainer.style.cssText = 'padding: 8px 20px 20px 20px; flex: 1;';

        this.textarea = document.createElement('textarea');
        this.textarea.id = 'card-content-editor';
        this.textarea.placeholder = 'Enter card content (Markdown supported)...';
        this.textarea.style.cssText = `
            width: 100%;
            height: 100%;
            min-height: 200px;
            padding: 12px;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            font-family: 'Monaco', 'Menlo', monospace;
            font-size: 14px;
            line-height: 1.6;
            resize: none;
            outline: none;
            transition: border-color 0.2s;
        `;

        this.textarea.addEventListener('focus', () => {
            this.textarea.style.borderColor = '#3b82f6';
        });

        this.textarea.addEventListener('blur', () => {
            this.textarea.style.borderColor = '#cbd5e1';
        });

        textareaContainer.appendChild(this.textarea);

        // Tags Input
        const tagsContainer = document.createElement('div');
        tagsContainer.style.cssText = 'padding: 0 20px 20px 20px;';

        const tagsLabel = document.createElement('div');
        tagsLabel.textContent = 'Tags (comma separated):';
        tagsLabel.style.cssText = 'font-size: 12px; font-weight: 500; color: #64748b; margin-bottom: 8px;';

        this.tagsInput = document.createElement('input');
        this.tagsInput.id = 'card-tags-editor';
        this.tagsInput.placeholder = 'e.g. urgent, idea, project-a';
        this.tagsInput.style.cssText = `
            width: 100%;
            padding: 8px 12px;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            font-size: 14px;
            outline: none;
            transition: border-color 0.2s;
        `;

        tagsContainer.appendChild(tagsLabel);
        tagsContainer.appendChild(this.tagsInput);

        // Color Selection
        const colorContainer = document.createElement('div');
        colorContainer.style.cssText = 'padding: 0 20px 20px 20px;';

        const colorLabel = document.createElement('div');
        colorLabel.textContent = 'Card Color:';
        colorLabel.style.cssText = 'font-size: 12px; font-weight: 500; color: #64748b; margin-bottom: 8px;';

        const presets = [
            { name: 'White', value: '#ffffff' },
            { name: 'Yellow', value: '#fef3c7' },
            { name: 'Red', value: '#fee2e2' },
            { name: 'Blue', value: '#dbeafe' },
            { name: 'Green', value: '#dcfce7' },
            { name: 'Gray', value: '#f1f5f9' }
        ];

        this.colorPresets = document.createElement('div');
        this.colorPresets.style.cssText = 'display: flex; gap: 10px;';
        this.selectedColor = '#ffffff';

        presets.forEach(p => {
            const btn = document.createElement('button');
            btn.title = p.name;
            btn.dataset.color = p.value;
            btn.style.cssText = `
                width: 28px;
                height: 28px;
                border-radius: 50%;
                background: ${p.value};
                border: 2px solid #e2e8f0;
                cursor: pointer;
                transition: transform 0.2s, border-color 0.2s;
            `;
            btn.addEventListener('click', () => {
                this.selectPreset(btn, p.value);
            });
            this.colorPresets.appendChild(btn);
        });

        colorContainer.appendChild(colorLabel);
        colorContainer.appendChild(this.colorPresets);

        // Footer with buttons
        const footer = document.createElement('div');
        footer.style.cssText = `
            padding: 16px 20px;
            border-top: 1px solid #e2e8f0;
            display: flex;
            justify-content: flex-end;
            gap: 12px;
        `;

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.cssText = `
            padding: 8px 16px;
            border: 1px solid #cbd5e1;
            background: white;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            color: #64748b;
            transition: all 0.2s;
        `;
        cancelBtn.addEventListener('click', () => this.close());

        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save';
        saveBtn.style.cssText = `
            padding: 8px 16px;
            border: none;
            background: #3b82f6;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            color: white;
            transition: all 0.2s;
        `;
        saveBtn.addEventListener('click', () => this.save());

        footer.appendChild(cancelBtn);
        footer.appendChild(saveBtn);

        // Assemble editor
        this.editorEl.appendChild(header);
        this.editorEl.appendChild(titleContainer);
        this.editorEl.appendChild(contentLabel);
        this.editorEl.appendChild(textareaContainer);
        this.editorEl.appendChild(tagsContainer);
        this.editorEl.appendChild(colorContainer);
        this.editorEl.appendChild(footer);

        // Add to DOM
        document.body.appendChild(this.overlayEl);
        document.body.appendChild(this.editorEl);
        console.log('[CardEditor] Editor elements added to DOM');

        // Event listeners
        this.overlayEl.addEventListener('click', () => this.close());
        header.querySelector('#close-editor').addEventListener('click', () => this.close());

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (this.editorEl.style.display === 'flex') {
                if (e.key === 'Escape') {
                    // Close suggestions if open, otherwise close editor
                    if (this.suggestionsEl && this.suggestionsEl.style.display === 'block') {
                        this.hideSuggestions();
                    } else {
                        this.close();
                    }
                } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    this.save();
                }
            }
        });

        // Setup Autocomplete
        this.setupAutocomplete();
    }

    setupAutocomplete() {
        // Create suggestions container
        this.suggestionsEl = document.createElement('ul');
        this.suggestionsEl.id = 'tag-suggestions';
        this.suggestionsEl.style.cssText = `
            position: absolute;
            background: white;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            list-style: none;
            padding: 4px 0;
            margin: 0;
            max-height: 200px;
            overflow-y: auto;
            z-index: 10002;
            display: none;
            width: 200px;
            font-family: 'Inter', sans-serif;
            font-size: 13px;
        `;
        document.body.appendChild(this.suggestionsEl);

        this.selectedIndex = -1;
        this.potentialTags = [];

        // Input event
        this.tagsInput.addEventListener('input', (e) => {
            this.handleInput(e);
        });

        // Keydown for navigation
        this.tagsInput.addEventListener('keydown', (e) => {
            if (this.suggestionsEl.style.display !== 'block') return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.selectedIndex = Math.min(this.selectedIndex + 1, this.suggestionsEl.children.length - 1);
                this.updateSelection();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.selectedIndex = Math.max(this.selectedIndex - 1, -1);
                this.updateSelection();
            } else if (e.key === 'Enter') {
                if (this.selectedIndex >= 0) {
                    e.preventDefault();
                    e.stopPropagation(); // Prevent saving card
                    this.selectSuggestion(this.suggestionsEl.children[this.selectedIndex].textContent);
                }
            } else if (e.key === 'Tab') {
                if (this.selectedIndex >= 0) {
                    e.preventDefault();
                    this.selectSuggestion(this.suggestionsEl.children[this.selectedIndex].textContent);
                }
            }
        });

        // Hide on blur (delayed to allow click)
        this.tagsInput.addEventListener('blur', () => {
            setTimeout(() => this.hideSuggestions(), 200);
        });
    }

    collectExistingTags() {
        console.log('[CardEditor] Collecting existing tags...');
        const tags = new Set();
        if (window.canvas) {
            console.log('[CardEditor] Window.canvas exists');
            if (window.canvas.layers && window.canvas.layers.card) {
                const cardGroups = window.canvas.layers.card.find('.card-group');
                console.log(`[CardEditor] Found ${cardGroups.length} card groups`);

                cardGroups.forEach(group => {
                    if (group.nodeData && group.nodeData.tags) {
                        group.nodeData.tags.forEach(t => tags.add(t));
                    }
                });
            } else {
                console.error('[CardEditor] Layers not found in canvas!');
            }

            // Check groups
            if (window.canvas.layers && window.canvas.layers.group) {
                const groupGroups = window.canvas.layers.group.find('.group-group');
                console.log(`[CardEditor] Found ${groupGroups.length} group groups`);

                groupGroups.forEach(group => {
                    if (group.nodeData && group.nodeData.tags) {
                        group.nodeData.tags.forEach(t => tags.add(t));
                    }
                });
            }
        } else {
            console.error('[CardEditor] window.canvas is undefined!');
        }
        const result = Array.from(tags).sort();
        console.log('[CardEditor] Final tags list:', result);
        return result;
    }

    handleInput(e) {
        const val = this.tagsInput.value;
        const cursorPos = this.tagsInput.selectionStart;

        // Find the current tag being typed (between commas)
        const textBeforeCursor = val.slice(0, cursorPos);
        const lastCommaIndex = textBeforeCursor.lastIndexOf(',');
        const currentTerm = textBeforeCursor.slice(lastCommaIndex + 1).trim();

        if (currentTerm.length < 1) {
            this.hideSuggestions();
            return;
        }

        // Filter tags
        const matches = this.potentialTags.filter(t =>
            t.toLowerCase().includes(currentTerm.toLowerCase()) &&
            t !== currentTerm // Don't suggest exact match if already typed
        );

        // Exclude tags already in this input
        const currentTags = val.split(',').map(t => t.trim());
        const filteredMatches = matches.filter(t => !currentTags.includes(t));

        if (filteredMatches.length > 0) {
            this.showSuggestions(filteredMatches, currentTerm);
        } else {
            this.hideSuggestions();
        }
    }

    showSuggestions(matches, query) {
        this.suggestionsEl.innerHTML = '';
        this.selectedIndex = 0; // Select first by default

        matches.forEach((tag, index) => {
            const li = document.createElement('li');
            li.textContent = tag;
            li.style.cssText = `
                padding: 6px 12px;
                cursor: pointer;
                color: #334155;
            `;

            // Highlight match
            if (index === 0) {
                li.style.background = '#eff6ff';
                li.style.color = '#2563eb';
            }

            li.addEventListener('mouseenter', () => {
                this.selectedIndex = index;
                this.updateSelection();
            });

            li.addEventListener('click', (e) => {
                e.preventDefault(); // Prevent blur
                this.selectSuggestion(tag);
            });

            this.suggestionsEl.appendChild(li);
        });

        // Position dropdown
        const rect = this.tagsInput.getBoundingClientRect();
        this.suggestionsEl.style.top = (rect.bottom + window.scrollY + 4) + 'px';
        this.suggestionsEl.style.left = (rect.left + window.scrollX) + 'px';
        this.suggestionsEl.style.width = rect.width + 'px';
        this.suggestionsEl.style.display = 'block';
    }

    hideSuggestions() {
        this.suggestionsEl.style.display = 'none';
        this.selectedIndex = -1;
    }

    updateSelection() {
        Array.from(this.suggestionsEl.children).forEach((li, index) => {
            if (index === this.selectedIndex) {
                li.style.background = '#eff6ff';
                li.style.color = '#2563eb';
            } else {
                li.style.background = 'white';
                li.style.color = '#334155';
            }
        });
    }

    selectSuggestion(tag) {
        const val = this.tagsInput.value;
        const cursorPos = this.tagsInput.selectionStart;
        const textBeforeCursor = val.slice(0, cursorPos);
        const textAfterCursor = val.slice(cursorPos);

        const lastCommaIndex = textBeforeCursor.lastIndexOf(',');
        const prefix = textBeforeCursor.slice(0, lastCommaIndex + 1);

        // Reconstruct with new tag
        const newText = prefix + (prefix.length > 0 ? ' ' : '') + tag + ', ' + textAfterCursor;

        this.tagsInput.value = newText;
        this.tagsInput.focus();

        // Move cursor to end of inserted tag
        const newCursorPos = prefix.length + (prefix.length > 0 ? 1 : 0) + tag.length + 2;
        this.tagsInput.setSelectionRange(newCursorPos, newCursorPos);

        this.hideSuggestions();
    }

    selectPreset(button, color) {
        // Reset all buttons
        this.colorPresets.querySelectorAll('button').forEach(btn => {
            btn.style.borderColor = '#e2e8f0';
            btn.style.transform = 'scale(1)';
        });

        // Set active button
        button.style.borderColor = '#3b82f6';
        button.style.transform = 'scale(1.2)';
        this.selectedColor = color;
    }

    open(cardId, currentText, tags = [], color = '#ffffff') {
        console.log('[CardEditor] Opening editor for card:', cardId, 'with text:', currentText, 'tags:', tags, 'color:', color);
        this.activeCardId = cardId;
        this.originalText = currentText || '';
        this.originalTags = tags || [];
        this.originalColor = color || '#ffffff';

        // Split title and body
        // Title = first line (cleaned of leading #)
        // Body = rest of text
        const lines = this.originalText.split('\n');
        let title = '';
        let body = '';

        if (lines.length > 0) {
            title = lines[0].replace(/^#+\s*/, '').trim();
            body = lines.slice(1).join('\n').trim();
        }

        this.titleInput.value = title;
        this.textarea.value = body;
        this.tagsInput.value = this.originalTags.join(', ');

        // Refresh autocomplete suggestions
        if (this.collectExistingTags) {
            this.potentialTags = this.collectExistingTags();
            console.log('[CardEditor] Collected potential tags:', this.potentialTags);
        }

        // Select color preset
        const colorValue = color || '#ffffff';
        const presetBtn = Array.from(this.colorPresets.querySelectorAll('button'))
            .find(btn => btn.dataset.color === colorValue);

        if (presetBtn) {
            this.selectPreset(presetBtn, colorValue);
        } else {
            // Default to white if match not found
            const whiteBtn = this.colorPresets.querySelector('button[data-color="#ffffff"]');
            if (whiteBtn) this.selectPreset(whiteBtn, '#ffffff');
        }

        this.overlayEl.style.display = 'block';
        this.editorEl.style.display = 'flex';
        this.textarea.focus();
        console.log('[CardEditor] Editor should be visible now');
    }

    close() {
        this.activeCardId = null;
        this.overlayEl.style.display = 'none';
        this.editorEl.style.display = 'none';
        this.titleInput.value = '';
        this.textarea.value = '';
        this.tagsInput.value = '';
    }

    save() {
        if (!this.activeCardId) return;

        const title = this.titleInput.value.trim();
        const body = this.textarea.value; // Don't trim body to preserve meaningful whitespace if desired, or trim if preferred.

        let newContent = '';
        if (title) {
            newContent = `# ${title}`;
            if (body) {
                newContent += `\n${body}`;
            }
        } else {
            newContent = body;
        }
        const newTags = this.tagsInput.value.split(',')
            .map(t => t.trim())
            .filter(t => t.length > 0);

        // Record undo action
        const tagsChanged = JSON.stringify(this.originalTags) !== JSON.stringify(newTags);
        const textChanged = this.originalText !== newContent;
        const colorChanged = this.originalColor !== this.selectedColor;

        if ((textChanged || tagsChanged || colorChanged) && window.undoManager) {
            window.undoManager.recordEdit(
                this.activeCardId,
                this.originalText,
                newContent,
                this.originalTags,
                newTags,
                this.originalColor,
                this.selectedColor
            );
        }

        // Emit save event
        this.canvas.emitEvent('card_content_saved', {
            id: this.activeCardId,
            content: newContent,
            tags: newTags,
            color: this.selectedColor
        });

        this.close();
    }
}

// Export
window.CardEditor = CardEditor;
