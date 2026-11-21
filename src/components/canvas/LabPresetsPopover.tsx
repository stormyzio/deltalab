import { useState } from 'react'
import { Bookmark, FlaskConical, FolderOpen, Save, Trash2 } from 'lucide-react'
import {
  LAB_TP_PRESETS,
  type LabPresetDefinition,
  type SavedWorkbenchRecord,
} from '@/lib/lab-presets'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'

interface LabPresetsPopoverProps {
  savedWorkbenches: SavedWorkbenchRecord[]
  currentNodeCount: number
  onLoadPreset: (preset: LabPresetDefinition) => void
  onSaveCurrentWorkbench: (name: string) => void
  onLoadSavedWorkbench: (record: SavedWorkbenchRecord) => void
  onDeleteSavedWorkbench: (id: string) => void
}

export function LabPresetsPopover({
  savedWorkbenches,
  currentNodeCount,
  onLoadPreset,
  onSaveCurrentWorkbench,
  onLoadSavedWorkbench,
  onDeleteSavedWorkbench,
}: LabPresetsPopoverProps) {
  const [open, setOpen] = useState(false)
  const [saveName, setSaveName] = useState('')

  const handleSave = () => {
    const trimmed = saveName.trim()
    if (!trimmed) return
    onSaveCurrentWorkbench(trimmed)
    setSaveName('')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <FlaskConical className="h-3.5 w-3.5 shrink-0" strokeWidth={1.6} />
          <span className="hidden sm:inline">TP & Paillasses</span>
          <span className="sm:hidden">TP</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="max-h-[72vh] overflow-y-auto p-3">
          {/* Guided TP presets */}
          <div>
            <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">
              TP prêts à lancer
            </p>
            <ul className="space-y-0.5">
              {LAB_TP_PRESETS.map((preset) => (
                <li key={preset.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onLoadPreset(preset)
                      setOpen(false)
                    }}
                    className="flex w-full flex-col rounded-md px-2 py-1.5 text-left hover:bg-accent/70"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-xs font-medium text-foreground">
                        {preset.titleFr}
                      </span>
                      <span className="shrink-0 whitespace-nowrap font-mono text-[9.5px] text-muted-foreground">
                        {preset.categoryFr}
                      </span>
                    </div>
                    <span className="mt-0.5 text-[10.5px] leading-snug text-muted-foreground">
                      {preset.subtitleFr}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <Separator className="my-3" />

          {/* Save & reload custom workbenches */}
          <div className="space-y-2">
            <p className="text-[11px] font-medium text-muted-foreground">
              Paillasses sauvegardées
            </p>

            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={saveName}
                maxLength={40}
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave()
                }}
                placeholder="Nommer la paillasse actuelle…"
                aria-label="Nom de la paillasse à sauvegarder"
                className="h-7 min-w-0 flex-1 rounded-md border border-border bg-card px-2 text-[11px] text-foreground placeholder:text-muted-foreground focus-visible:border-zinc-500 focus-visible:outline-none"
              />
              <Button
                size="sm"
                variant="secondary"
                disabled={currentNodeCount === 0 || saveName.trim().length === 0}
                onClick={handleSave}
                className="h-7 shrink-0 gap-1 px-2 text-[11px]"
              >
                <Save className="h-3 w-3" strokeWidth={1.7} />
                <span>Sauver</span>
              </Button>
            </div>

            {savedWorkbenches.length === 0 ? (
              <p className="py-1 text-[10.5px] text-muted-foreground">
                Aucune sauvegarde locale pour le moment.
              </p>
            ) : (
              <ul className="space-y-0.5">
                {savedWorkbenches.map((rec) => (
                  <li
                    key={rec.id}
                    className="flex items-center justify-between gap-1 rounded-md px-2 py-1 hover:bg-accent/50"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onLoadSavedWorkbench(rec)
                        setOpen(false)
                      }}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      <Bookmark
                        className="h-3 w-3 shrink-0 text-muted-foreground"
                        strokeWidth={1.6}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11.5px] font-medium text-foreground">
                          {rec.name}
                        </p>
                        <p className="font-mono text-[9.5px] tabular-nums text-muted-foreground">
                          {rec.nodeCount} élément{rec.nodeCount > 1 ? 's' : ''}
                        </p>
                      </div>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        onLoadSavedWorkbench(rec)
                        setOpen(false)
                      }}
                      aria-label={`Charger ${rec.name}`}
                      className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
                    >
                      <FolderOpen className="h-3 w-3" strokeWidth={1.6} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onDeleteSavedWorkbench(rec.id)}
                      aria-label={`Supprimer ${rec.name}`}
                      className="h-6 w-6 shrink-0 text-muted-foreground hover:text-red-400"
                    >
                      <Trash2 className="h-3 w-3" strokeWidth={1.6} />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
