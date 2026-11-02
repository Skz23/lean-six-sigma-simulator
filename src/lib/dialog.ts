/**
 * Boîtes de dialogue natives avec repli : dans un cadre intégré (iframe) où
 * confirm()/alert() sont bloqués, l'action est confirmée d'office (les versions
 * de scénario permettent d'annuler).
 */
const embedded = (() => {
  try {
    return window.self !== window.top
  } catch {
    return true
  }
})()

export function ask(message: string): boolean {
  if (embedded) return true
  return window.confirm(message)
}

export function notify(message: string): void {
  if (embedded) {
    console.warn(message)
    return
  }
  window.alert(message)
}
