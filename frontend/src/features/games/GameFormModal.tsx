import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { MAX_GAME_NAME_LENGTH, MAX_TAG_LENGTH, normalizeTags } from '../../lib/validation'
import type { Game } from '../../types'
import { Alert, Button, Input, Modal, Textarea } from '../../components/ui'

export function GameFormModal({
  open,
  onClose,
  groupId,
  game,
  tagSuggestions,
}: {
  open: boolean
  onClose: () => void
  groupId: string
  /** null = 新增 */
  game: Game | null
  /** 群组内已有标签池，用于联想 */
  tagSuggestions: string[]
}) {
  // 由父组件通过 key 重挂载来重置表单状态
  const [name, setName] = useState(game?.name ?? '')
  const [description, setDescription] = useState(game?.description ?? '')
  const [tags, setTags] = useState<string[]>(game?.tags ?? [])
  const [tagInput, setTagInput] = useState('')
  const [tagError, setTagError] = useState('')
  const [error, setError] = useState('')
  const queryClient = useQueryClient()

  const availableSuggestions = tagSuggestions.filter((tag) => !tags.includes(tag))

  const mutation = useMutation({
    mutationFn: () => {
      const input = { name, description: description || undefined, tags }
      return game ? api.updateGame(groupId, game.id, input) : api.createGame(groupId, input)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['games', groupId] })
      onClose()
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : '保存失败，请重试'),
  })

  const addTagByName = (raw: string) => {
    const tag = raw.trim()
    if (!tag) return
    if (tag.length > MAX_TAG_LENGTH) {
      setTagError(`每个标签最多 ${MAX_TAG_LENGTH} 个字符`)
      return
    }
    if (tags.includes(tag)) return
    setTags([...tags, tag])
    setTagError('')
  }

  const addTag = () => {
    addTagByName(tagInput)
    setTagInput('')
  }

  const onTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === '、') {
      e.preventDefault()
      addTag()
    }
  }

  const removeTag = (tag: string) => setTags(tags.filter((t) => t !== tag))

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const normalized = normalizeTags(tags)
    if (normalized.error) {
      setError(normalized.error)
      return
    }
    setError('')
    mutation.mutate()
  }

  return (
    <Modal open={open} onClose={onClose} title={game ? '编辑桌游' : '新增桌游'}>
      <form onSubmit={onSubmit} className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <Input
          label="名称"
          name="game-name"
          placeholder="例如：卡坦岛"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={MAX_GAME_NAME_LENGTH}
          autoFocus
        />
        <div>
          <label htmlFor="game-tags" className="mb-1.5 block text-sm font-medium text-ink">
            标签
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {tags.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1 rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1 text-sm text-primary">
                {tag}
                <button
                  type="button"
                  aria-label={`移除标签 ${tag}`}
                  onClick={() => removeTag(tag)}
                  className="text-primary/70 hover:text-danger"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </span>
            ))}
            <input
              id="game-tags"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={onTagKeyDown}
              onBlur={addTag}
              placeholder={tags.length ? '' : '输入标签后回车，如：策略'}
              className="h-9 w-32 flex-1 rounded-lg border border-line bg-surface px-3 text-sm placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          {availableSuggestions.length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-muted">已有标签（点击添加）</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {availableSuggestions.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    aria-label={`添加已有标签 ${tag}`}
                    onClick={() => addTagByName(tag)}
                    className="rounded-md border border-dashed border-line px-2 py-0.5 text-xs text-muted transition-colors hover:border-primary/60 hover:text-primary"
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            </div>
          )}
          {tagError && <p className="mt-1 text-xs text-danger">{tagError}</p>}
        </div>
        <Textarea
          label="描述"
          name="game-description"
          placeholder="选填，一句话介绍"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={200}
        />
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" className="flex-1" loading={mutation.isPending} disabled={!name.trim()}>
            保存
          </Button>
        </div>
      </form>
    </Modal>
  )
}
