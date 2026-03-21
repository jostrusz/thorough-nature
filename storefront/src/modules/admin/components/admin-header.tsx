"use client"

import { useRouter } from "next/navigation"
import { adminLogout } from "@lib/data/admin"

export default function AdminHeader({
  title,
  countryCode,
  showBack,
  backHref,
}: {
  title: string
  countryCode: string
  showBack?: boolean
  backHref?: string
}) {
  const router = useRouter()

  const handleLogout = async () => {
    await adminLogout()
    router.push(`/${countryCode}/admin`)
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-lg dark:border-slate-800 dark:bg-slate-900/80">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          {showBack && (
            <button
              onClick={() =>
                backHref ? router.push(backHref) : router.back()
              }
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
          )}
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
            {title}
          </h1>
        </div>
        {!showBack && (
          <button
            onClick={handleLogout}
            className="rounded-lg px-3 py-1.5 text-sm text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            Logout
          </button>
        )}
      </div>
    </header>
  )
}
