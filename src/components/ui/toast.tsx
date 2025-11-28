"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export interface ToastProps {
  id: string
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  onClose?: () => void
}

export function Toast({ title, description, action, onClose }: ToastProps) {
  return (
    <div
      className={cn(
        "group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border bg-background p-4 pr-8 shadow-lg transition-all animate-in slide-in-from-right-full"
      )}
    >
      <div className="grid gap-1 flex-1">
        <div className="text-sm font-semibold">{title}</div>
        {description && (
          <div className="text-sm text-muted-foreground">{description}</div>
        )}
      </div>
      {action && (
        <Button
          onClick={action.onClick}
          size="sm"
          className="ml-4 shrink-0"
        >
          {action.label}
        </Button>
      )}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute right-2 top-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6L6 18" />
            <path d="M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}

export function Toaster({ toasts }: { toasts: ToastProps[] }) {
  if (toasts.length === 0) return null;
  
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex max-h-screen w-full flex-col gap-2 md:max-w-[420px]">
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} />
      ))}
    </div>
  )
}
