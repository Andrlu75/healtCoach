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

  if (loading) return <div className="text-gray-500">Загрузка...</div>

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Инвайт-ссылки</h1>

      {/* Create */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex items-end gap-3">
        <div>
          <label className="text-xs text-gray-500">Макс. использований</label>
          <input
            type="number"
            min="1"
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
            className="mt-1 w-24 px-3 py-2 text-sm border border-gray-300 rounded-lg"
          />
        </div>
        <button
          onClick={createInvite}
          disabled={creating}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <Plus size={16} />
          {creating ? 'Создание...' : 'Создать инвайт'}
        </button>
      </div>

      {/* List */}
      {invites.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
          Инвайты не созданы
        </div>
      ) : (
        <div className="space-y-2">
          {invites.map((inv) => (
            <div key={inv.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <code className="text-sm bg-gray-50 px-2 py-0.5 rounded text-gray-700 truncate max-w-xs">
                    {inv.invite_url}
                  </code>
                  <button
                    onClick={() => copyLink(inv)}
                    className="p-1 text-gray-400 hover:text-blue-600"
                  >
                    {copied === inv.id ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                  </button>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                  <span>Использований: {inv.uses_count}/{inv.max_uses}</span>
                  <span>Создан: {dayjs(inv.created_at).format('DD.MM.YY')}</span>
                  {!inv.is_active && (
                    <span className="text-red-500">Неактивен</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => deleteInvite(inv.id)}
                className="p-2 text-gray-400 hover:text-red-500"
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
