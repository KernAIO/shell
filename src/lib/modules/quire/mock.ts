/**
 * The in-memory quire API.
 *
 * A module missing from the mock has a working page and no way to reach it in exactly the
 * environment used for demos and end-to-end tests. Keep it in step with the contract.
 */
const now = Date.now()
const iso = (msAgo = 0) => new Date(now - msAgo).toISOString()

interface MockNote {
  id: string
  workspaceId: string
  title: string
  body: string
  createdAt: string
  archivedAt: string | null
}

export function createMockQuireApi() {
  const notes: MockNote[] = [
    {
      id: '01920000-0000-7000-8000-00000005001',
      workspaceId: '',
      title: 'A first note',
      body: 'Everything here comes from src/lib/modules/quire/mock.ts',
      createdAt: iso(36e5),
      archivedAt: null,
    },
  ]

  return {
    notes: {
      list: async ({ workspaceId }: { workspaceId: string }) => ({
        items: notes.map((n) => ({ ...n, workspaceId })),
        nextCursor: null,
      }),
      create: async ({ workspaceId, title, body }: { workspaceId: string; title: string; body?: string }) => {
        const note: MockNote = {
          id: crypto.randomUUID(),
          workspaceId,
          title,
          body: body ?? '',
          createdAt: new Date().toISOString(),
          archivedAt: null,
        }
        notes.unshift(note)
        return note
      },
      remove: async ({ noteId }: { noteId: string }) => {
        const at = notes.findIndex((n) => n.id === noteId)
        if (at >= 0) notes.splice(at, 1)
        return { ok: true as const }
      },
      // behind the `archive` capability; the mock does not gate, the server does
      archive: async ({ noteId, archived }: { noteId: string; archived?: boolean }) => {
        const note = notes.find((n) => n.id === noteId)
        if (!note) throw new Error('Note not found')
        note.archivedAt = archived === false ? null : new Date().toISOString()
        return note
      },
    },
  }
}
