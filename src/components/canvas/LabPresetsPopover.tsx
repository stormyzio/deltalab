import { type ChangeEvent, useEffect, useRef, useState } from 'react'
import {
  Check,
  Copy,
  Download,
  FilePlus2,
  FlaskConical,
  Merge,
  Pencil,
  Save,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import type { CanvasNode } from '../../../shared/chemistry.ts'
import {
  LAB_TP_PRESETS,
  type LabPresetDefinition,
  type SavedWorkbenchRecord,
} from '@/lib/lab-presets'
import { formatRelativeSavedTime, summarizeWorkbenchNodes } from '@/lib/workbench-io'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ChemText } from '@/components/ui/chem-text'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface LabPresetsPopoverProps {
  savedWorkbenches: SavedWorkbenchRecord[]
  activeWorkbenchId: string | null
  currentNodes: CanvasNode[]
  onLoadPreset: (preset: LabPresetDefinition) => void
  onSaveCurrentWorkbench: (name: string) => void
  onUpdateSavedWorkbench: (id: string) => void
  onRenameSavedWorkbench: (id: string, nextName: string) => void
  onDuplicateSavedWorkbench: (id: string) => void
  onNewWorkbench: () => void
  onLoadSavedWorkbench: (record: SavedWorkbenchRecord) => void
  onDeleteSavedWorkbench: (id: string) => void
  onExportCurrentWorkbench: (customName?: string) => void
  onExportSavedWorkbench: (record: SavedWorkbenchRecord) => void
  onImportWorkbenchFile: (file: File, mode?: 'replace' | 'merge') => void
}

export function LabPresetsPopover({
  savedWorkbenches,
  activeWorkbenchId,
  currentNodes,
  onLoadPreset,
  onSaveCurrentWorkbench,
  onUpdateSavedWorkbench,
  onRenameSavedWorkbench,
  onDuplicateSavedWorkbench,
  onNewWorkbench,
  onLoadSavedWorkbench,
  onDeleteSavedWorkbench,
  onExportCurrentWorkbench,
  onExportSavedWorkbench,
  onImportWorkbenchFile,
}: LabPresetsPopoverProps) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'benches' | 'presets'>('benches')
  const [saveName, setSaveName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const editInputRef = useRef<HTMLInputElement>(null)

  const currentNodeCount = currentNodes.length
  const activeBench =
    savedWorkbenches.find((b) => b.id === activeWorkbenchId) ?? null

  useEffect(() => {
    if (editingId) {
      editInputRef.current?.focus()
      editInputRef.current?.select()
    }
  }, [editingId])

  const handleSave = () => {
    const trimmed = saveName.trim()
    if (!trimmed || currentNodeCount === 0) return
    onSaveCurrentWorkbench(trimmed)
    setSaveName('')
  }

  const startRename = (rec: SavedWorkbenchRecord) => {
    setEditingId(rec.id)
    setEditingName(rec.name)
  }

  const commitRename = () => {
    if (!editingId) return
    const trimmed = editingName.trim()
    if (trimmed) {
      onRenameSavedWorkbench(editingId, trimmed)
    }
    setEditingId(null)
    setEditingName('')
  }

  const triggerFilePicker = (mode: 'replace' | 'merge') => {
    setImportMode(mode)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
      fileInputRef.current.click()
    }
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    onImportWorkbenchFile(file, importMode)
    setOpen(false)
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.deltalab.json,application/json"
        onChange={handleFileChange}
        className="hidden"
        aria-hidden="true"
      />

      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setEditingId(null)
        }}
      >
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <FlaskConical className="h-3.5 w-3.5 shrink-0" strokeWidth={1.6} />
            <span className="hidden max-w-[140px] truncate sm:inline">
              {activeBench ? activeBench.name : 'Paillasses'}
            </span>
            <span className="sm:hidden">TP</span>
          </Button>
        </PopoverTrigger>

        <PopoverContent align="end" className="w-[380px] p-0">
          {/* Header tabs + New blank workbench */}
          <div className="flex items-center justify-between gap-2 border-b border-border/70 px-3 pt-2">
            <div role="tablist" aria-label="Gestion des paillasses" className="flex gap-4">
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'benches'}
                onClick={() => setTab('benches')}
                className={cn(
                  '-mb-px shrink-0 whitespace-nowrap border-b-2 pb-2 text-[11.5px] font-medium',
                  tab === 'benches'
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                Mes paillasses
                {savedWorkbenches.length > 0 && (
                  <span className="ml-1.5 text-[10.5px] tabular-nums text-muted-foreground">
                    {savedWorkbenches.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'presets'}
                onClick={() => setTab('presets')}
                className={cn(
                  '-mb-px shrink-0 whitespace-nowrap border-b-2 pb-2 text-[11.5px] font-medium',
                  tab === 'presets'
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                TP guidés
                <span className="ml-1.5 text-[10.5px] tabular-nums text-muted-foreground">
                  {LAB_TP_PRESETS.length}
                </span>
              </button>
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={currentNodeCount === 0 && !activeBench}
                  onClick={() => {
                    onNewWorkbench()
                    setOpen(false)
                  }}
                  aria-label="Nouvelle paillasse vierge"
                  className="-mt-1.5 h-6 w-6 text-muted-foreground hover:text-foreground"
                >
                  <FilePlus2 className="h-3.5 w-3.5" strokeWidth={1.6} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Nouvelle paillasse vierge</TooltipContent>
            </Tooltip>
          </div>

          {tab === 'benches' ? (
            <div className="p-3">
              {/* Active workbench status & quick update */}
              {activeBench && (
                <div className="mb-3 flex items-center justify-between gap-2 border-b border-border/60 pb-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-foreground">
                      {activeBench.name}
                    </p>
                    <p className="mt-0.5 truncate text-[10.5px] tabular-nums text-muted-foreground">
                      {summarizeWorkbenchNodes(currentNodes)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={currentNodeCount === 0}
                          onClick={() => onUpdateSavedWorkbench(activeBench.id)}
                          className="h-7 gap-1 px-2 text-[11px] font-medium text-foreground hover:bg-accent"
                        >
                          <Save className="h-3 w-3" strokeWidth={1.7} />
                          <span>Mettre à jour</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        Enregistrer l’état actuel dans « {activeBench.name} »
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              )}

              {/* Save as new workbench */}
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={saveName}
                  maxLength={60}
                  onChange={(e) => setSaveName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSave()
                  }}
                  placeholder={
                    activeBench
                      ? 'Sauver sous un nouveau nom…'
                      : 'Nommer la paillasse actuelle…'
                  }
                  aria-label="Nom de la paillasse à sauvegarder"
                  className="h-7 min-w-0 flex-1 rounded-md border border-border bg-card px-2 text-[11.5px] text-foreground placeholder:text-muted-foreground focus-visible:border-zinc-500 focus-visible:outline-none"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={currentNodeCount === 0 || saveName.trim().length === 0}
                  onClick={handleSave}
                  className="h-7 shrink-0 gap-1 px-2.5 text-[11px]"
                >
                  <Save className="h-3 w-3" strokeWidth={1.7} />
                  <span>Sauver</span>
                </Button>
              </div>

              {/* Portable file import / export strip */}
              <div className="mt-2.5 flex items-center justify-between gap-1.5 border-b border-border/60 pb-2.5">
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={currentNodeCount === 0}
                    onClick={() =>
                      onExportCurrentWorkbench(saveName.trim() || undefined)
                    }
                    className="h-7 gap-1.5 px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                  >
                    <Download className="h-3.5 w-3.5" strokeWidth={1.6} />
                    <span>Exporter</span>
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => triggerFilePicker('replace')}
                    className="h-7 gap-1.5 px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                  >
                    <Upload className="h-3.5 w-3.5" strokeWidth={1.6} />
                    <span>Importer</span>
                  </Button>

                  {currentNodeCount > 0 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => triggerFilePicker('merge')}
                          className="h-7 gap-1 px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                        >
                          <Merge className="h-3.5 w-3.5" strokeWidth={1.6} />
                          <span>Fusionner</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        Importer un fichier en l’ajoutant à la paillasse actuelle
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>

                <span className="shrink-0 text-[10px] text-muted-foreground">
                  .deltalab.json
                </span>
              </div>

              {/* Saved workbenches list */}
              <div className="mt-2 max-h-[42vh] overflow-y-auto">
                {savedWorkbenches.length === 0 ? (
                  <p className="py-4 text-center text-[11px] leading-relaxed text-muted-foreground">
                    Aucune paillasse enregistrée. Sauvegardez votre paillasse ou
                    glissez un fichier .deltalab.json sur le plan de travail.
                  </p>
                ) : (
                  <ul className="divide-y divide-border/40">
                    {savedWorkbenches.map((rec) => {
                      const isActive = rec.id === activeWorkbenchId
                      const isEditing = editingId === rec.id
                      const dateLabel = formatRelativeSavedTime(
                        rec.updatedAt ?? rec.savedAt,
                      )

                      return (
                        <li
                          key={rec.id}
                          className={cn(
                            'group flex items-center justify-between gap-1.5 py-2 first:pt-1 last:pb-0',
                          )}
                        >
                          {isEditing ? (
                            <div className="flex min-w-0 flex-1 items-center gap-1">
                              <input
                                ref={editInputRef}
                                type="text"
                                value={editingName}
                                maxLength={60}
                                onChange={(e) => setEditingName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') commitRename()
                                  if (e.key === 'Escape') setEditingId(null)
                                }}
                                aria-label="Nouveau nom de la paillasse"
                                className="h-6 min-w-0 flex-1 rounded border border-zinc-500 bg-card px-1.5 text-[11.5px] text-foreground focus-visible:outline-none"
                              />
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={commitRename}
                                aria-label="Valider le renommage"
                                className="h-6 w-6 text-foreground"
                              >
                                <Check className="h-3.5 w-3.5" strokeWidth={1.8} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => setEditingId(null)}
                                aria-label="Annuler le renommage"
                                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                              >
                                <X className="h-3.5 w-3.5" strokeWidth={1.7} />
                              </Button>
                            </div>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  onLoadSavedWorkbench(rec)
                                  setOpen(false)
                                }}
                                className="min-w-0 flex-1 rounded px-1 py-0.5 text-left hover:bg-accent/50"
                              >
                                <div className="flex items-baseline gap-1.5">
                                  <span className="truncate text-xs font-medium text-foreground">
                                    {rec.name}
                                  </span>
                                  {isActive && (
                                    <span className="shrink-0 text-[10px] text-muted-foreground">
                                      · active
                                    </span>
                                  )}
                                </div>
                                <p className="mt-0.5 truncate text-[10.5px] tabular-nums text-muted-foreground">
                                  {summarizeWorkbenchNodes(rec.nodes)}
                                  {dateLabel ? ` · ${dateLabel}` : ''}
                                </p>
                              </button>

                              <div className="flex shrink-0 items-center gap-0.5">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon-sm"
                                      onClick={() => startRename(rec)}
                                      aria-label={`Renommer ${rec.name}`}
                                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                    >
                                      <Pencil className="h-3 w-3" strokeWidth={1.6} />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="bottom">Renommer</TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon-sm"
                                      onClick={() => onExportSavedWorkbench(rec)}
                                      aria-label={`Exporter ${rec.name}`}
                                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                    >
                                      <Download className="h-3 w-3" strokeWidth={1.6} />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="bottom">Exporter</TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon-sm"
                                      onClick={() => onDuplicateSavedWorkbench(rec.id)}
                                      aria-label={`Dupliquer ${rec.name}`}
                                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                    >
                                      <Copy className="h-3 w-3" strokeWidth={1.6} />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="bottom">Dupliquer</TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon-sm"
                                      onClick={() => onDeleteSavedWorkbench(rec.id)}
                                      aria-label={`Supprimer ${rec.name}`}
                                      className="h-6 w-6 text-muted-foreground hover:text-red-400"
                                    >
                                      <Trash2 className="h-3 w-3" strokeWidth={1.6} />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="bottom">Supprimer</TooltipContent>
                                </Tooltip>
                              </div>
                            </>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </div>
          ) : (
            <div className="max-h-[58vh] overflow-y-auto p-3">
              <ul className="divide-y divide-border/40">
                {LAB_TP_PRESETS.map((preset) => (
                  <li key={preset.id} className="py-1 first:pt-0 last:pb-0">
                    <button
                      type="button"
                      onClick={() => {
                        onLoadPreset(preset)
                        setOpen(false)
                      }}
                      className="flex w-full flex-col rounded-md px-2 py-1.5 text-left hover:bg-accent/60"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-xs font-medium text-foreground">
                          <ChemText value={preset.titleFr} />
                        </span>
                        <span className="shrink-0 whitespace-nowrap text-[10px] text-muted-foreground">
                          {preset.categoryFr}
                        </span>
                      </div>
                      <span className="mt-0.5 text-[10.5px] leading-snug text-muted-foreground">
                        <ChemText value={preset.subtitleFr} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </>
  )
}
