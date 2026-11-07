export type PaletteKeyboardEvent = Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey">;

export function isPageJumpShortcut(event: PaletteKeyboardEvent, isTypingTarget: boolean): boolean {
    return !isTypingTarget && event.key === "/";
}

export function shouldPageJumpHandleEscape(event: Pick<KeyboardEvent, "key">, isOpen: boolean, isTypingTarget: boolean): boolean {
    return isOpen && !isTypingTarget && event.key === "Escape";
}

export function isCatalogSearchShortcut(event: PaletteKeyboardEvent, isTypingTarget: boolean): boolean {
    return !isTypingTarget && event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey);
}
