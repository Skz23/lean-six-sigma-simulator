/**
 * Enregistrement d'un fichier généré : via la capacité « downloads » quand
 * l'application tourne dans un artifact claude.ai, sinon via un lien de téléchargement.
 */
type Downloads = { save: (r: { filename: string; data: Blob | string }) => Promise<unknown> }
type ClaudeHost = { use: (name: string) => Promise<unknown> }

export async function saveFile(filename: string, data: Blob): Promise<void> {
  const host = (window as unknown as { claude?: ClaudeHost }).claude
  if (host?.use) {
    const dl = (await host.use('downloads')) as Downloads | null
    if (dl) {
      try {
        await dl.save({ filename, data })
      } catch (e) {
        const code = (e as { code?: string }).code
        if (code !== 'declined') throw new Error(`Téléchargement impossible (${code ?? 'erreur'})`)
      }
      return
    }
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(data)
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
