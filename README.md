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

### 🔄 Drag & Drop Reordering
- **Organize**: Drag items up and down to reorder them. The order in the list determines the order in the copied output.

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

1.  **Gather**: Right-click files or selections and choose **Add to Context**.
2.  **Annotate**: Use the chatbox to add custom instructions.
3.  **Organize**: Drag items to arrange them logically.
4.  **Export**: Click the **Copy** icon and paste it where you need it!

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Release Notes

### 0.0.3
- **New UI**: Migrated to a custom Webview for a better experience.
- **Chatbox**: Added ability to add text notes.
- **Drag & Drop**: Added support for reordering items.
- **Token Calculator**: Added real-time token estimation.

### 0.0.2
- Added `README.md` documentation.
- Improved navigation and selection support.
- Added individual item deletion.

### 0.0.1
- Initial release.
