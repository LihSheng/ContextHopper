---
description: How to publish the extension to the VS Code Marketplace
---

# Publishing Context Hopper to VS Code Marketplace

## Prerequisites
1.  **Microsoft Account**: You need a Microsoft account to sign in to Azure DevOps and the Marketplace.
2.  **Publisher ID**: You need to create a publisher on the [VS Code Marketplace Management Portal](https://marketplace.visualstudio.com/manage).
    -   Go to the portal and sign in.
    -   Click **Create publisher**.
    -   Enter a unique **ID** (e.g., `LihSheng`) and a **Name**.
    -   **Important**: Update your `package.json`'s `publisher` field to match this ID exactly.

## Step 1: Get a Personal Access Token (PAT)
1.  Go to [Azure DevOps](https://dev.azure.com/) and sign in.
2.  Click **User settings** (icon next to your profile) > **Personal access tokens**.
3.  Click **New Token**.
4.  **Name**: "VS Code Marketplace" (or similar).
5.  **Organization**: "All accessible organizations".
6.  **Scopes**: select **Custom defined**.
    -   Scroll to **Marketplace** and check **Acquire** and **Manage**.
7.  Click **Create**.
8.  **COPY THE TOKEN**. You won't see it again.

## Step 2: Login with VSCE
Open your terminal in the project directory and run:

```bash
npx vsce login <your-publisher-id>
```

It will ask for your Personal Access Token. Paste the token you copied.

## Step 3: Publish
Once logged in, run:

```bash
npx vsce publish
```

This will package and upload your extension to the Marketplace. It usually takes a few minutes for verification before it appears online.

## Step 4: Verify
Visit your extension's page on the Marketplace (link will be provided in the output) or search for "Context Hopper" in VS Code extensions view.
