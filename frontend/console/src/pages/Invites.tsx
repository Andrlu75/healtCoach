import { useEffect, useState } from 'react'
import { Plus, Trash2, Copy, Check } from 'lucide-react'
import { onboardingApi } from '../api/data'
import type { InviteLink } from '../types'
import dayjs from 'dayjs'

export default function Invites() {
  const [invites, setInvites] = useState<InviteLink[]>([])
  const [loading, setLoading] = useState(true)
  const [maxUses, setMaxUses] = useState('1')
  const [creating, setCreating] = useState(false)
  const [copied, setCopied] = useState<number | null>(null)

  useEffect(() => {
    loadInvites()
  }, [])

  const loadInvites = () => {
    setLoading(true)
    onboardingApi.getInvites()
      .then(({ data }) => setInvites(data))
      .finally(() => setLoading(false))
  }

  const createInvite = async () => {
    setCreating(true)
    try {
      await onboardingApi.createInvite({ max_uses: Number(maxUses) || 1 })
      loadInvites()
    } finally {
      setCreating(false)
    }
  }

  const deleteInvite = async (id: number) => {
    await onboardingApi.deleteInvite(id)
    setInvites((list) => list.filter((x) => x.id !== id))
  }

  const copyLink = (invite: InviteLink) => {
    navigator.clipboard.writeText(invite.invite_url)
    setCopied(invite.id)
    setTimeout(() => setCopied(null), 2000)
  }

  if (loading) return <div className="text-muted-foreground">Загрузка...</div>

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Инвайт-ссылки</h1>

      {/* Create */}
      <div className="bg-card rounded-xl border border-border p-4 mb-6 flex items-end gap-3">
        <div>
          <label className="text-xs text-muted-foreground">Макс. использований</label>
          <input
            type="number"
            min="1"
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
            className="mt-1 w-24 px-3 py-2 text-sm bg-background text-foreground border border-border rounded-lg"
          />
        </div>
        <button
          onClick={createInvite}
          disabled={creating}
          className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground text-sm rounded-lg hover:bg-primary/90 disabled:opacity-50"
        >
          <Plus size={16} />
          {creating ? 'Создание...' : 'Создать инвайт'}
        </button>
      </div>

      {/* List */}
      {invites.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-8 text-center text-muted-foreground">
          Инвайты не созданы
        </div>
      ) : (
        <div className="space-y-2">
          {invites.map((inv) => (
            <div key={inv.id} className="bg-card rounded-xl border border-border p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <code className="text-sm bg-muted px-2 py-0.5 rounded text-secondary-foreground truncate max-w-xs">
                    {inv.invite_url}
                  </code>
                  <button
                    onClick={() => copyLink(inv)}
                    className="p-1 text-muted-foreground hover:text-primary"
                  >
                    {copied === inv.id ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                  </button>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span>Использований: {inv.uses_count}/{inv.max_uses}</span>
                  <span>Создан: {dayjs(inv.created_at).format('DD.MM.YY')}</span>
                  {!inv.is_active && (
                    <span className="text-red-400">Неактивен</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => deleteInvite(inv.id)}
                className="p-2 text-muted-foreground hover:text-red-400"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
