import * as vscode from 'vscode';

/**
 * Reference implementation for switching to a model slug from config.
 * This pattern should be followed for the debug mode command.
 */
async function switchToModelSlugFromConfig(configKey: string): Promise<void> {
  const config = vscode.workspace.getConfiguration('cursor');
  const modelSlug = config.get<string>(configKey);
  
  if (!modelSlug) {
    vscode.window.showErrorMessage(`No model slug configured for ${configKey}`);
    return;
  }

  // Execute the command to switch to the model slug
  // This is a reference to how model slug switching works
  await vscode.commands.executeCommand('cursor.chat.switchModel', modelSlug);
}

/**
 * Switches the chat mode to debug mode.
 * If no chat is open, opens a new one.
 * If a chat is open, creates a new chat.
 */
async function switchChatToDebugMode(): Promise<void> {
  const config = vscode.workspace.getConfiguration('cursor');
  const debugModelSlug = config.get<string>('chat.debugModelSlug', '');

  if (!debugModelSlug) {
    vscode.window.showErrorMessage(
      'Debug model slug not configured. Please set cursor.chat.debugModelSlug in settings.'
    );
    return;
  }

  try {
    // Check if there's an active chat
    // This is a placeholder - adjust based on actual Cursor API
    const activeChat = await vscode.commands.executeCommand('cursor.chat.getActiveChat');
    const hasActiveChat = activeChat !== undefined && activeChat !== null;

    if (hasActiveChat) {
      // Create a new chat
      await vscode.commands.executeCommand('cursor.chat.newChat');
    } else {
      // Open a new chat if none exists
      await vscode.commands.executeCommand('cursor.chat.openChat');
    }

    // Switch to debug mode using the model slug from config
    // Reference the pattern used in switchToModelSlugFromConfig
    await vscode.commands.executeCommand('cursor.chat.switchModel', debugModelSlug);
    
    // Set chat mode to debug
    await vscode.commands.executeCommand('cursor.chat.setMode', 'debug');

    vscode.window.showInformationMessage('Switched chat to debug mode');
  } catch (error) {
    vscode.window.showErrorMessage(
      `Failed to switch chat to debug mode: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export function activate(context: vscode.ExtensionContext) {
  // Register the command to switch chat to debug mode
  const switchToDebugModeCommand = vscode.commands.registerCommand(
    'cursor.switchChatToDebugMode',
    switchChatToDebugMode
  );

  context.subscriptions.push(switchToDebugModeCommand);
}

export function deactivate() {}
