# Hermes Sidebar for Obsidian

A tiny desktop-only Obsidian plugin that opens a right-sidebar panel and asks [Hermes Agent](https://hermes-agent.nousresearch.com/) questions about the active note.

It does not write to your note by default. It calls the local Hermes CLI and renders the answer in the sidebar.

## Requirements

- Desktop Obsidian. Mobile is not supported because the plugin uses Node child processes.
- Hermes Agent installed and configured.
- The `hermes` CLI must either be on Obsidian's `PATH` or configured in this plugin's settings as an absolute path.

## Install for local testing

Clone the repository:

```bash
git clone git@github.com:dnc1994/obsidian-hermes-sidebar.git
```

Copy or symlink the plugin folder into your vault:

```bash
mkdir -p /path/to/your/vault/.obsidian/plugins
cp -R obsidian-hermes-sidebar /path/to/your/vault/.obsidian/plugins/hermes-sidebar
```

Then in Obsidian:

1. Settings → Community plugins
2. Disable Safe mode / Restricted mode if needed
3. Reload installed plugins or restart Obsidian
4. Enable `Hermes Sidebar`
5. Command palette → `Hermes: Open sidebar`

## Configure Hermes command

By default the plugin runs:

```text
hermes
```

If Obsidian cannot find `hermes`, open:

```text
Settings → Hermes Sidebar → Hermes command
```

Set it to the absolute path of your Hermes executable, for example:

```text
/Users/you/.local/bin/hermes
```

You can find the path in a terminal with:

```bash
command -v hermes
```

## Usage

1. Open a Markdown note.
2. Open the Hermes sidebar.
3. Type a question.
4. Click `Ask Hermes`, or press `Cmd+Enter` / `Ctrl+Enter` in the question box.

Preset buttons:

- Key takeaways
- Critique
- Follow-up questions
- Claims / evidence / implications

Answers are kept in the sidebar only unless you explicitly copy them.

## Commands

- `Hermes: Open sidebar`
- `Hermes: Ask about current note`

## Notes

- The plugin passes the active note path to Hermes and asks Hermes to read the note if needed.
- Hermes uses your normal Hermes model/provider/tool configuration.
- The plugin does not maintain its own API keys or model settings.
- The plugin does not currently stream partial output; the answer appears when Hermes finishes.
