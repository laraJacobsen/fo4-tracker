/** True when a key press is going to a text field and should not drive navigation. */
export function isTyping(target: EventTarget | null) {
  return target instanceof HTMLElement && target.matches('input:not([type=checkbox]), textarea, select');
}
