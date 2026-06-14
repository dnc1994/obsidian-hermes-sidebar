# Hermes Sidebar for Obsidian

A tiny desktop-only Obsidian plugin that opens a right-sidebar panel and asks Hermes Agent questions about the active note.

It does not write to your clipping note. It calls the local Hermes CLI and renders the answer in the sidebar.

## Install for local testing

Copy this folder to:

```text
/Users/linghao/obsidian/Notes/.obsidian/plugins/hermes-sidebar
```

Then in Obsidian:

1. Settings → Community plugins
2. Reload installed plugins if needed
3. Enable `Hermes Sidebar`
4. Command palette → `Hermes: Open sidebar`

## Requirements

- macOS / desktop Obsidian
- Hermes CLI at `/Users/linghao/.local/bin/hermes`

## Usage

Open a note, open the Hermes sidebar, type a question, and click `Ask Hermes`.

Shortcut presets:

- Key takeaways
- Critique
- Follow-up questions
- Claims / evidence / implications

Answers are kept in the sidebar only unless you explicitly copy them.
