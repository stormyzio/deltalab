import { type RefObject, useEffect, useRef } from 'react'

interface InfiniteScrollSentinelProps {
  hasMore: boolean
  onLoadMore: () => void
  scrollRootRef?: RefObject<HTMLElement | null>
  loadedCount: number
  totalCount: number
  rootMargin?: string
}

/**
 * Invisible sentinel that automatically triggers `onLoadMore` well before
 * the user reaches the bottom of a scrollable list.
 */
export function InfiniteScrollSentinel({
  hasMore,
  onLoadMore,
  scrollRootRef,
  loadedCount,
  totalCount,
  rootMargin = '650px 0px',
}: InfiniteScrollSentinelProps) {
  const sentinelRef = useRef<HTMLDivElement>(null)
  const onLoadMoreRef = useRef(onLoadMore)
  useEffect(() => {
    onLoadMoreRef.current = onLoadMore
  }, [onLoadMore])

  useEffect(() => {
    if (!hasMore) return
    const el = sentinelRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onLoadMoreRef.current()
        }
      },
      {
        root: scrollRootRef?.current ?? null,
        rootMargin,
      },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, loadedCount, rootMargin, scrollRootRef])

  if (!hasMore) return null

  return (
    <div
      ref={sentinelRef}
      aria-hidden="true"
      className="flex h-10 items-center justify-center text-[10.5px] tabular-nums text-muted-foreground/70"
    >
      {loadedCount} / {totalCount}
    </div>
  )
}
