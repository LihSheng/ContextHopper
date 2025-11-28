---
description: How to publish the extension to the VS Code Marketplace
---

This workflow automatically publishes the extension to the VS Code Marketplace when changes are pushed to the `main` branch.

## Prerequisites

1.  **VS Code Marketplace Publisher Account**: You must have a publisher account.
2.  **Personal Access Token (PAT)**:
    - Go to [Azure DevOps](https://dev.azure.com/).
    - Create a PAT with `Marketplace > Manage` scope.
3.  **GitHub Secret**:
    - Go to your GitHub repository settings.
    - Navigate to `Secrets and variables > Actions`.
    - Create a new repository secret named `VSCE_PAT`.
    - Paste your PAT as the value.

## Usage

1.  Push changes to the `main` branch.
2.  The "Publish Extension" workflow will automatically run.
3.  It will install dependencies, run tests, and publish the new version.

## Note

Ensure you update the `version` in `package.json` before pushing to `main`, otherwise the publish step will fail if the version already exists.
