# Context Hopper

**Context Hopper** is a VS Code extension designed to streamline the process of gathering code context for external AI agents or documentation. It allows you to quickly collect files and code snippets into a structured list and copy them to your clipboard with a single click.

## Features

### 📋 Context List Sidebar
A dedicated sidebar view in the Activity Bar lets you manage your gathered context items.

### 🎯 Smart Selection
- **Add Files**: Right-click any file in the Explorer or Editor to add the entire file.
- **Add Code Blocks**: Select a specific block of code in the editor and "Add to Context" to capture only that segment.

### � Chatbox & Notes
- **Add Notes**: Type directly into the chatbox at the bottom of the sidebar to add text notes or instructions to your context.
- **Mix & Match**: Combine files and text notes in a single list.

### 🔄 Context Management
- **Clean Interface**: A polished, native VS Code style list.
- **Icons**: Clear distinction between files and notes.

### 📊 Token Calculator
- **Real-Time Count**: See the estimated total token count of your context at the bottom of the sidebar.

### �🚀 Navigation & Highlighting
- **Click to Open**: Clicking an item in the list instantly opens the file.
- **Auto-Scroll**: If you captured a specific code block, navigating to it will automatically scroll to and highlight the code.

### 🧹 Management
- **Individual Delete**: Remove specific items from the list using the trash icon.
- **Clear All**: Wipe the entire list with one click to start fresh.

### 📤 One-Click Export
- **Copy Context**: Click the copy button to place all gathered context into your clipboard.
- **Formatted Output**: The copied text is formatted with file paths and line numbers (for selections), making it ready to paste into any AI chat interface.

## Usage

For a detailed guide on how to gather context, generate file structures, use the Chatbox, and optimize tokens, please see our [User Manual](MANUAL.md).

1.  **Gather**: Right-click files or selections and choose **Add to Context**.
2.  **Structuring**: Use **Add File Structure** or **Add Folder Structure** to generate directory trees.
3.  **Annotate**: Use the chatbox to add custom instructions.
4.  **Export**: Click the **Copy** icon and paste it where you need it!

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Release Notes

### 0.0.14
- **Documentation**: Updated release notes to keep the README current.

### 0.0.13
- **Logo Update**: Added official extension logo.

### 0.0.12
- **Interactive File Structure Generation**: Added a QuickPick checklist when using "Add File Structure" or "Add Folder Structure", allowing users to select or unselect exactly which files to include in the context tree.

### 0.0.11
- **Refresh Button**: Added a refresh button to the Context Items view title bar to manually sync the view.
- **Empty State Message**: Added a helpful message when the context list is empty.

### 0.0.10
- **Add Folder Structure**: New context menu command to add a complete directory tree of any folder to your context.
- **Add File Structure**: Improved the "Add File Structure" command to visualize files currently in your list.
- **UI Fixes**: Fixed truncation issue where long text notes or structures were cut off (aka the "snippet" bug).


### 0.0.9
- **Multi-Select**: Added support for selecting multiple items using `Ctrl/Cmd` + Click or `Shift` + Click.
- **Batch Actions**: Added "Copy Selected" and "Delete Selected" buttons for batch operations.
- **Bug Fix**: Fixed a critical bug where adding items to the active context would also modify saved context groups.

### 0.0.8
- **Folder Support**: Added ability to add entire folders to context (recursively adds all files).

### 0.0.7
- **View Sync Fix**: Fixed an issue where the context list wouldn't update when switching back from other views.

### 0.0.6
- **Persistence**: Context items are now saved and restored across sessions.
- **Initial Load Fix**: Fixed a bug where items weren't visible immediately on startup.

### 0.0.5
- **Token Optimization 2.0**: Refined "Remove Empty Lines" logic (indentation-safe) and "Remove Comments" (safer regex).
- **Native UI**: Updated footer with native VS Code icons (Gear for settings, Zap for active state).
- **Bug Fixes**: Fixed an issue where enabling optimizations could increase token count.
- **CI/CD**: Added automated publishing workflow.

### 0.0.4
- **UI Polish**: Updated to match native VS Code style (compact list, hover effects).
- **Accurate Tokens**: Integrated `js-tiktoken` (GPT-4 tokenizer) for precise token counting.
- **Enhanced Chatbox**: Rounded UI, embedded send button, and auto-expanding input.
- **Icons**: Updated to monochrome SVGs that adapt to your theme.
- **UX Improvements**: Removed drag-and-drop for simplicity, restored Copy/Clear buttons to title bar.

### 0.0.3
- **New UI**: Migrated to a custom Webview for a better experience.
- **Chatbox**: Added ability to add text notes.
- **Token Calculator**: Added real-time token estimation.

### 0.0.2
- Added `README.md` documentation.
- Improved navigation and selection support.
- Added individual item deletion.

### 0.0.1
- Initial release.
