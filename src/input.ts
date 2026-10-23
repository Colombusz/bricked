export function isEditing(target: EventTarget | null = document.activeElement) {
  return target instanceof HTMLElement && (target.matches('input, textarea, select, [role="slider"]') || target.isContentEditable);
}
