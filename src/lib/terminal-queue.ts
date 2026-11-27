/** Hands commands from chat to the Daytona terminal, which may not be mounted yet. */
const pending: string[] = [];
export const TERMINAL_EVENT = "whiterchat:terminal-command";

export function queueTerminalCommands(commands: string[]) {
  pending.push(...commands.map((c) => c.trim()).filter(Boolean));
  window.dispatchEvent(new Event(TERMINAL_EVENT));
}

export function takeTerminalCommands(): string[] {
  return pending.splice(0, pending.length);
}
