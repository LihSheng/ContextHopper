# Context Hopper User Manual

Context Hopper is designed to help you quickly gather context from your codebase to feed into AI assistants (like ChatGPT, Claude, etc.). It calculates token sizes, optimizes your code (stripping comments/empty lines), and generates filesystem tree structures.

Here is a comprehensive guide to using and mastering Context Hopper.

---

## 1. Gathering Context (Adding Files & Folders)

### Adding Individual Files or Selected Code
1. Open any file in your VS Code editor.
2. **Right-click** anywhere in the editor and select **Context Hopper: Add to Context**.
   - *Tip:* If you highlight a specific block of code and select "Add to Context", it will only capture that specific block!
3. Alternatively, you can **Right-click** any file in the VS Code **Explorer** sidebar and click **Add to Context**.

### Adding Entire Folders
1. In the VS Code Explorer sidebar, **Right-click** on any folder.
2. Select **Add to Context**. 
3. This will recursively add all files inside the folder (excluding `node_modules` and `.git`).

---

## 2. Generating File Structures (Trees)

Context Hopper allows you to generate a visual text representation of your project's structure, which helps the AI understand your architecture.

### Method A: "Add File Structure"
Use this to generate a tree of **only the files you have already selected and added to Context Hopper**.
1. Open the Context Hopper view in your left-hand Activity Bar.
2. Click the **file tree icon** (Add File Structure) at the top of the Context Hopper panel.
3. A **QuickPick dialog** will appear at the top of your screen, listing the files you've added.
4. **Uncheck** any files you don't want to include in the tree, then press `Enter` (or click OK).
5. A text note containing the formatted tree will be added to your context list.

### Method B: "Add Folder Structure"
Use this to generate a tree for an **entire folder in your workspace**.
1. Open the normal VS Code **Explorer** view.
2. **Right-click** a folder and select **Add Folder Structure**.
3. A **QuickPick dialog** will pop up showing all files within that folder.
4. Use the checkboxes to exclude any files or build folders you don't want the AI to see, then confirm.
5. The folder tree will be added as a text note in your Context Hopper.

---

## 3. Managing the Context List

Open the **Context Hopper sidebar** (look for its icon in the Activity Bar) to view all gathered items.

### Annotating with Notes
- Use the **Chatbox** at the bottom of the Context Hopper sidebar to type custom instructions or prompts (e.g., *"Refactor this component to use React Hooks"*).
- Press `Enter` or click the Send button to add the note to your list.

### Batch Selection and Deletion
- **Click** an item to select it.
- Hold `Ctrl` (or `Cmd` on Mac) while clicking to select multiple specific items.
- Hold `Shift` while clicking to select a range of items.
- A batch-action bar will appear above the list. Click **Copy** to copy only the selected items, or **Delete** to remove them.

### Optimizing the Output
- Click the **Gear Icon** at the bottom of the Context Hopper panel.
- Toggle options like **Remove Comments** or **Remove Empty Lines**. 
- Applying these optimizations will reduce the total output size, saving tokens when feeding context to an AI!

---

## 4. Exporting to AI

1. Once you have all the files, snippets, tree structures, and notes you need, click the **Copy icon** at the top right of the Context Hopper panel.
2. The entire payload (with file names, line numbers, and contents clearly formatted) is now in your clipboard!
3. Paste it directly into your AI chat interface.

*Note:* Context Hopper automatically redacts potential secrets like API keys and passwords from the clipboard output by default. You can disable this in the VS Code Settings under `Context Hopper -> Redact Secrets` if needed.
