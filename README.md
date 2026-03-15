
# Context Bridge 🚀

**Context Bridge** is a VS Code extension designed to streamline the workflow between local development and Large Language Models (LLMs). It "compiles" your project into a single structured text file and "spreads" AI-generated code back into your file system.

## ✨ Features

* **Project Compilation**: Aggregates your source code into a single context file, perfect for pasting into ChatGPT, Claude, or Gemini.
* **Smart Filtering**: Automatically ignores binary files, `node_modules`, `.git`, and build artifacts.
* **Project Configuration**: Save project-specific ignore rules in a `.compiladorai` file.
* **Versioned Output**: Keep track of your prompts and project states with timestamped logs.
* **Project Spreading**: Take a multi-file response from an AI and instantly extract it back into your project structure with built-in Path Traversal protection.
* **Staged Diff Export**: Pull `git diff --staged` directly from the sidebar to share only what is staged.
* **Sidebar Integration**: Easy access to configuration, ignore lists, and execution.

## 🛠 Usage

### Project Configuration

You can define which folders and files to ignore directly in the sidebar and click **💾 Salvar no Projeto**. This creates a `.compiladorai` file inside `.compile_history`:

```json
{
  "ignoreFiles": [".env", "package-lock.json", "src/types/generated.ts"],
  "ignoreFolders": ["temp", "dist", "src/db/generated/prisma"],
  "exclude": [".env", "package-lock.json", "src/types/generated.ts", "temp", "dist", "src/db/generated/prisma"]
}

```

`exclude` is kept for backward compatibility, but `ignoreFiles` and `ignoreFolders` are now the recommended fields.

Current config path: `.compile_history/.compiladorai` (legacy root `.compiladorai` is still read for compatibility).

### Compiling (Code to Context)

1. Open the **Context Bridge** tab in the Activity Bar.
2. Set your output path (default: `logs/project_out.txt`).
3. Click **🚀 Compilar para IA**.
4. Copy the content and feed your favorite LLM.

### Spreading (AI to Code)

1. Paste the AI's response into your input file (default: `logs/project_in.txt`).
2. Ensure the AI uses the format:
`--- START: path/to/file.ts ---`
`[CODE CONTENT]`
`--- END: path/to/file.ts ---`
3. Click **📂 Espalhar no Projeto**.

### Staged Diff (Git to Context)

1. Stage your changes with Git (`git add ...`).
2. Open the **4. Git (Staged)** section in the sidebar.
3. Click **🧩 Git Diff (staged)**.
4. Copy the output with **📋 Copiar Diff**.

## ⚙️ Requirements

* VS Code 1.109.0+
