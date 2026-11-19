import { Trash2 } from 'lucide-react'
import { Button } from './ui'
import { api } from '../lib/api'
import { useAction } from '../lib/hooks'

export default function DeleteEmptyCatalogMaster({ kind, id, label, invalidate = [], onDeleted }: { kind: string; id: number; label: string; invalidate?: string[]; onDeleted?: () => void }) {
  const remove = useAction(() => api.del(`/api/admin/empty-catalog-masters/${kind}/${id}`), {
    success: `${label} deleted`, invalidate: ['brands', 'categories', 'subcategories', 'catalog-types', ...invalidate], onSuccess: onDeleted,
  })
  return <Button size="sm" variant="ghost" title="Delete only if unused" busy={remove.isPending} icon={<Trash2 className="h-4 w-4" />}
    onClick={() => { if (window.confirm(`Delete ${label} only if it is empty and unused?`)) remove.mutate() }}>Delete empty</Button>
}
