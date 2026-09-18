import React from 'react'

export default function ProductSkeleton() {
  return (
    <div className="card-surface overflow-hidden">
      <div className="aspect-square animate-pulse bg-paper-line/60 dark:bg-night-line/60" />
      <div className="flex flex-col gap-2 p-4">
        <div className="h-3 w-1/3 animate-pulse rounded bg-paper-line/60 dark:bg-night-line/60" />
        <div className="h-4 w-4/5 animate-pulse rounded bg-paper-line/60 dark:bg-night-line/60" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-paper-line/60 dark:bg-night-line/60" />
        <div className="mt-2 h-9 w-full animate-pulse rounded-full bg-paper-line/60 dark:bg-night-line/60" />
      </div>
    </div>
  )
}
