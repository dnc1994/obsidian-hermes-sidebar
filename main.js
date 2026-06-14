const {
  Plugin,
  ItemView,
  Notice,
  MarkdownRenderer,
  ButtonComponent,
  PluginSettingTab,
  Setting,
} = require("obsidian");
const { execFile } = require("child_process");

const VIEW_TYPE_HERMES_SIDEBAR = "hermes-sidebar-view";
const DEFAULT_SETTINGS = {
  hermesCommand: "hermes",
};

class HermesSidebarPlugin extends Plugin {
  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.registerView(
      VIEW_TYPE_HERMES_SIDEBAR,
      (leaf) => new HermesSidebarView(leaf, this)
    );

    this.addSettingTab(new HermesSidebarSettingTab(this.app, this));

    this.addRibbonIcon("message-square", "Open Hermes Sidebar", () => {
      this.activateView();
    });

    this.addCommand({
      id: "open-hermes-sidebar",
      name: "Open sidebar",
      callback: () => this.activateView(),
    });

    this.addCommand({
      id: "ask-hermes-about-current-note",
      name: "Ask about current note",
      callback: async () => {
        await this.activateView();
        const view = this.getView();
        if (view) view.focusQuestion();
      },
    });
  }

  onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_HERMES_SIDEBAR);
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async activateView() {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_HERMES_SIDEBAR);
    let leaf = leaves[0];

    if (!leaf) {
      leaf = this.app.workspace.getRightLeaf(false);
      await leaf.setViewState({ type: VIEW_TYPE_HERMES_SIDEBAR, active: true });
    }

    this.app.workspace.revealLeaf(leaf);
  }

  getView() {
    const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_HERMES_SIDEBAR)[0];
    if (!leaf) return null;
    return leaf.view instanceof HermesSidebarView ? leaf.view : null;
  }

  getActiveNoteInfo() {
    const file = this.app.workspace.getActiveFile();
    if (!file) return null;

    const adapter = this.app.vault.adapter;
    const vaultBasePath = typeof adapter.getBasePath === "function" ? adapter.getBasePath() : "";
    const absolutePath = vaultBasePath ? `${vaultBasePath}/${file.path}` : file.path;

    return {
      file,
      basename: file.basename,
      relativePath: file.path,
      absolutePath,
      vaultBasePath,
    };
  }

  buildPrompt(noteInfo, question) {
    return [
      "You are being invoked from an Obsidian sidebar to answer a question about the active note.",
      "",
      `Current note path: ${noteInfo.absolutePath}`,
      `Current note relative path: ${noteInfo.relativePath}`,
      "",
      `User question: ${question}`,
      "",
      "Instructions:",
      "- Read the note if needed.",
      "- Answer concisely but with enough substance to be useful.",
      "- Do not modify any files unless the user explicitly asks you to.",
      "- Do not create sidecar notes for this request.",
      "- If you cite or summarize the note, distinguish what the note says from your own analysis.",
    ].join("\n");
  }

  askHermes(noteInfo, question, onData) {
    return new Promise((resolve, reject) => {
      const prompt = this.buildPrompt(noteInfo, question);
      const home = process.env.HOME || process.env.USERPROFILE || "";
      const pathParts = [
        process.env.PATH || "",
        "/opt/homebrew/bin",
        "/usr/local/bin",
        home ? `${home}/.local/bin` : "",
      ].filter(Boolean);

      const child = execFile(
        this.settings.hermesCommand || DEFAULT_SETTINGS.hermesCommand,
        ["chat", "--quiet", "-q", prompt],
        {
          cwd: noteInfo.vaultBasePath || home || process.cwd(),
          maxBuffer: 1024 * 1024 * 10,
          env: {
            ...process.env,
            PATH: Array.from(new Set(pathParts)).join(":"),
            HERMES_SOURCE: "obsidian-sidebar",
          },
        },
        (error, stdout, stderr) => {
          if (error) {
            const message = [
              `Hermes command failed: ${error.message}`,
              stderr ? `\nStderr:\n${stderr}` : "",
              stdout ? `\nStdout:\n${stdout}` : "",
            ].join("");
            reject(new Error(message));
            return;
          }
          resolve(stdout.trim());
        }
      );

      child.stdout?.on("data", (chunk) => onData?.(chunk.toString()));
      child.stderr?.on("data", (chunk) => onData?.(chunk.toString(), true));
    });
  }
}

class HermesSidebarSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Hermes Sidebar" });

    new Setting(containerEl)
      .setName("Hermes command")
      .setDesc(
        "Command or absolute path used to run Hermes. Use 'hermes' if it is on PATH, or an absolute path such as /Users/you/.local/bin/hermes."
      )
      .addText((text) =>
        text
          .setPlaceholder("hermes")
          .setValue(this.plugin.settings.hermesCommand)
          .onChange(async (value) => {
            this.plugin.settings.hermesCommand = value.trim() || DEFAULT_SETTINGS.hermesCommand;
            await this.plugin.saveSettings();
          })
      );
  }
}

class HermesSidebarView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.lastAnswer = "";
    this.isRunning = false;
  }

  getViewType() {
    return VIEW_TYPE_HERMES_SIDEBAR;
  }

  getDisplayText() {
    return "Hermes";
  }

  getIcon() {
    return "message-square";
  }

  async onOpen() {
    this.render();
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => this.updateActiveNoteLabel())
    );
    this.registerEvent(
      this.app.workspace.on("file-open", () => this.updateActiveNoteLabel())
    );
  }

  async onClose() {}

  render() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("hermes-sidebar-view");

    const title = contentEl.createDiv({ cls: "hermes-sidebar-title", text: "Hermes" });
    title.setAttr("aria-label", "Hermes Sidebar");

    this.noteEl = contentEl.createDiv({ cls: "hermes-sidebar-note" });

    const presets = contentEl.createDiv({ cls: "hermes-sidebar-controls" });
    this.addPreset(presets, "Key takeaways", "What are the key takeaways from this note?");
    this.addPreset(presets, "Critique", "What should I be skeptical about in this note?");
    this.addPreset(presets, "Follow-ups", "What follow-up questions should I ask about this note?");
    this.addPreset(
      presets,
      "Claims/evidence",
      "Extract the key claims, evidence, assumptions, and implications from this note."
    );

    this.questionEl = contentEl.createEl("textarea", {
      cls: "hermes-sidebar-question",
      attr: { placeholder: "Ask Hermes about the active note..." },
    });
    this.questionEl.value = "What are the key takeaways and what follow-up questions should I ask?";

    const buttonRow = contentEl.createDiv({ cls: "hermes-sidebar-button-row" });
    new ButtonComponent(buttonRow)
      .setButtonText("Ask Hermes")
      .setCta()
      .onClick(() => this.submit());

    new ButtonComponent(buttonRow)
      .setButtonText("Copy answer")
      .onClick(() => this.copyAnswer());

    new ButtonComponent(buttonRow)
      .setButtonText("Clear")
      .onClick(() => this.clearAnswer());

    this.statusEl = contentEl.createDiv({ cls: "hermes-sidebar-status" });
    this.outputEl = contentEl.createDiv({ cls: "hermes-sidebar-output" });

    this.questionEl.addEventListener("keydown", (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        this.submit();
      }
    });

    this.updateActiveNoteLabel();
    this.setStatus("Ready. Cmd/Ctrl+Enter submits.");
  }

  addPreset(parent, label, question) {
    new ButtonComponent(parent)
      .setButtonText(label)
      .onClick(() => {
        this.questionEl.value = question;
        this.questionEl.focus();
      });
  }

  focusQuestion() {
    this.questionEl?.focus();
  }

  updateActiveNoteLabel() {
    const noteInfo = this.plugin.getActiveNoteInfo();
    if (!this.noteEl) return;
    this.noteEl.setText(noteInfo ? `Active note: ${noteInfo.relativePath}` : "No active Markdown note.");
  }

  setStatus(text) {
    if (this.statusEl) this.statusEl.setText(text);
  }

  async submit() {
    if (this.isRunning) {
      new Notice("Hermes is already running.");
      return;
    }

    const noteInfo = this.plugin.getActiveNoteInfo();
    if (!noteInfo) {
      new Notice("Open a note before asking Hermes.");
      return;
    }

    const question = this.questionEl.value.trim();
    if (!question) {
      new Notice("Type a question first.");
      return;
    }

    this.isRunning = true;
    this.lastAnswer = "";
    this.outputEl.empty();
    this.outputEl.createDiv({ text: "Hermes is thinking…" });
    this.setStatus(`Running on ${noteInfo.relativePath}…`);

    try {
      const answer = await this.plugin.askHermes(noteInfo, question);
      this.lastAnswer = answer;
      await this.renderMarkdown(answer || "_(Hermes returned an empty answer.)_");
      this.setStatus("Done.");
    } catch (error) {
      this.lastAnswer = "";
      this.outputEl.empty();
      this.outputEl.createDiv({ cls: "hermes-sidebar-error", text: error.message });
      this.setStatus("Hermes failed.");
      new Notice("Hermes failed. See sidebar for details.");
    } finally {
      this.isRunning = false;
    }
  }

  async renderMarkdown(markdown) {
    this.outputEl.empty();
    await MarkdownRenderer.renderMarkdown(markdown, this.outputEl, "", this);
  }

  async copyAnswer() {
    if (!this.lastAnswer) {
      new Notice("No Hermes answer to copy yet.");
      return;
    }
    await navigator.clipboard.writeText(this.lastAnswer);
    new Notice("Hermes answer copied.");
  }

  clearAnswer() {
    this.lastAnswer = "";
    this.outputEl.empty();
    this.setStatus("Cleared.");
  }
}

module.exports = HermesSidebarPlugin;
