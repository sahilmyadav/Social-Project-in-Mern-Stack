# Fix GitHub Copilot Chat Issue

## Issue
"Chat took too long to get ready" error in VS Code

## Root Causes & Solutions

### 1. **Re-authenticate GitHub** (Most Common Fix)
1. Press `Cmd + Shift + P` to open Command Palette
2. Type: `GitHub Copilot: Sign Out`
3. Press Enter
4. Then type: `GitHub Copilot: Sign In`
5. Complete the authentication in the browser

### 2. **Add these settings to VS Code**
Open Settings (JSON) with `Cmd + Shift + P` → "Preferences: Open User Settings (JSON)"

Add these settings before the closing `}`:

```json
  "github.copilot.advanced": {
    "debug.useNodeFetcher": true,
    "debug.useElectronFetcher": true
  },
  "http.proxyStrictSSL": false,
  "github.copilot.chat.useProjectTemplates": false
```

### 3. **Clear VS Code Cache**
Run these commands in Terminal:

```bash
# Close VS Code first, then run:
rm -rf ~/Library/Application\ Support/Code/Cache/*
rm -rf ~/Library/Application\ Support/Code/CachedData/*
rm -rf ~/Library/Application\ Support/Code/CachedExtensionVSIXs/*
```

### 4. **Reinstall Copilot Extensions**
1. Press `Cmd + Shift + X` to open Extensions
2. Find `GitHub Copilot` and `GitHub Copilot Chat`
3. Click the gear icon → Uninstall (for both)
4. Restart VS Code
5. Install both extensions again

### 5. **Check Network/Firewall**
Make sure these domains are not blocked:
- `api.github.com`
- `copilot-proxy.githubusercontent.com`
- `api.githubcopilot.com`

### 6. **Reload VS Code Window**
Press `Cmd + Shift + P` → Type: `Developer: Reload Window`

---

## Quick Fix Command (Run in Terminal)

```bash
# Re-authenticate and reload
code --disable-extensions && code
```

Then re-enable extensions after VS Code restarts.

---

## If Problem Persists

1. Check GitHub Status: https://www.githubstatus.com/
2. Check your GitHub Copilot subscription is active
3. Try VS Code Insiders: https://code.visualstudio.com/insiders/
