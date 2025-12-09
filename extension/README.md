# Cursor Chat Debug Mode Command

This extension adds a VSCode command to switch the chat mode to debug mode.

## Features

- **Switch Chat to Debug Mode**: Command `cursor.switchChatToDebugMode` that:
  - Opens a new chat if no chat is currently open
  - Creates a new chat if one is already open
  - Switches to debug mode using the model slug from configuration

## Configuration

Set the debug model slug in your VSCode settings:

```json
{
  "cursor.chat.debugModelSlug": "your-debug-model-slug"
}
```

## Implementation Notes

The implementation references the pattern used for switching to a model slug from a config variable (see `switchToModelSlugFromConfig` function in `extension.ts`).

### Command Names

The actual Cursor command names may need to be adjusted based on Cursor's actual API:
- `cursor.chat.getActiveChat` - Check if chat is active
- `cursor.chat.newChat` - Create a new chat
- `cursor.chat.openChat` - Open a chat
- `cursor.chat.switchModel` - Switch to a model slug
- `cursor.chat.setMode` - Set chat mode to debug

These command names are placeholders and should be verified against Cursor's actual command API.

## Usage

1. Configure the debug model slug in settings
2. Run the command "Cursor: Switch Chat to Debug Mode" from the command palette
3. The chat will open/create and switch to debug mode
