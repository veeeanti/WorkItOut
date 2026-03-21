# WorkItOut! | Yet another Workshop mod manager, nothing special here.

# Getting Started

## Quick Start

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Development Mode
```bash
pnpm run dev
```

This will start both:
- Electron application
- Vite dev server (on http://localhost:5173)
- Hot module reloading

### 3. Building for Production
```bash
pnpm run build
```

Builds the React app and Electron main process.

### 4. Creating Distribution Packages
```bash
pnpm run dist
```

Creates installer packages (Portable and Installer executables as well as "preinstalled" zips for Windows and AppImage on Linux (not fully supported yet, sorry!)).

## Configuration

### Adding Games

1. Open the application
2. Go to **Game Configuration** tab
3. Enter the **Game Name** and **Installation Path**
  - The installation path should always point to the **mods folder** and not to the actual game directory. For example, Rivals of Aether's mods folder is located at ``%LOCALAPPDATA%\RivalsofAether\workshop``. Garry's Mod's addons folder is ``[Garry's Mod Folder]\garrysmod\addons``.
4. Click **+ Add Game**, now just download and install after download is finished.

Example:
- **Game Name**: `Skyrim`
- **Installation Path**: `C:\Program Files (x86)\Steam\steamapps\common\Skyrim`

The configuration is saved to `config.json` in the project root.

## API Endpoints

The app connects to my website to download mods I've uploaded:

- **My website page**: "https://vee-anti.xyz/workshop"
- **API endpoint it pulls from**: "https://vee-anti.xyz/api/workshop"
  - It pulls a .json file from the API response, which contains an array of mods with their details.

The expected API response format:
```json
{
  "mods": [
    {
      "id": "mod-1",
      "name": "Awesome Mod",
      "description": "A great mod",
      "author": "Author Name",
      "version": "1.0.0",
      "downloadUrl": "https://example.com/mod.zip",
      "imageUrl": "https://example.com/image.jpg"
    }
  ]
}
```

## Features

### Browse & Search
- Automatically fetches mods from your API
- Displays mod information with icons
- View detailed descriptions

### Download Mods
- Click any mod to select it
- Click "Download" to save it locally
- Files are stored in `./mods-download/`

### Install to Games
- Select a configured game from the dropdown
- Click "Install" to install the mod in that game's installation path
- Installation paths are configured in Game Configuration
- It should extract the mod zip place the files correctly

### Page Scraping
- Automatically scrapes my website upon launch, or can be set to refresh automatically
- Extracts mod details from HTML
- Updates mod list when you refresh

## Troubleshooting

### config.json Issues
Delete `config.json` to reset it. A new one will be created with defaults.

### API Not Responding
Check your internet connection and verify ``https://vee-anti.xyz/api/workshop`` is accessible. You can test the API response in a browser or with ``curl``.

## Development Tips

### Adding API Calls
All API interactions go through `ModService` in `src/services/modService.ts`.

### Updating UI
React components are located in `src/components/`. Should support hot reloading.

### Changing Styling
Current design is ripped straight from my website, but feel free to customize it. CSS files are in `src/styles/`. Should support hot reloading.

### IPC Communication
New IPC handlers are added in `src/main.ts`. Invoke from React using:
```typescript
await window.ipcRenderer.invoke('handler-name', arg1, arg2)
```

## Next Steps

1. Add your game installations in Game Configuration
2. Click "Refresh Mods List" to populate mods
3. Download and install mods to your games
4. Check your game to make sure the mods are working correctly

## Issues & Contributions

If you encounter any issues or have suggestions for improvements, please open an issue here on the repo.
However, the odds that I will see them and respond on time are pretty low. You are more than welcome to fork and make your own changes. Go nuts with it.
Though if you want to get in touch with me regarding the project or for any other reason (adding mods / addons to the website, etc.) you can reach out to me on Discord (vee.anti) directly or in the UnionCrax Discord server.

===================

~veeλnti<3
https://vee-anti.xyz/ - My personal website! Learn more about me and check out what I do. ^^
https://union-crax.xyz/ - Check out our library of games! We take requests for games, and we have a Discord server with a friendly and helpful community to hang out with and chat. 