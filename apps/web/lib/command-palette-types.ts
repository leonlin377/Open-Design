export type CommandSection =
  | "Navigation"
  | "Studio"
  | "Theme"
  | "Help";

export type CommandAction = {
  id: string;
  title: string;
  subtitle?: string;
  hint?: string;
  shortcut?: string;
  section: CommandSection;
  run: () => void | Promise<void>;
  /**
   * When false, the command is visible in the palette but cannot be
   * executed (e.g. a studio-only command opened from a non-studio route).
   */
  disabled?: boolean;
};

export const COMMAND_SECTIONS: readonly CommandSection[] = [
  "Navigation",
  "Studio",
  "Theme",
  "Help"
] as const;
