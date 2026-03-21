import { redirect } from "next/navigation"
import { isAdminAuthenticated } from "@lib/data/admin"
import AdminLoginForm from "@modules/admin/components/login-form"

export default async function AdminLoginPage({
  params,
}: {
  params: Promise<{ countryCode: string }>
}) {
  const { countryCode } = await params
  const authenticated = await isAdminAuthenticated()

  if (authenticated) {
    redirect(`/${countryCode}/admin/orders`)
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Orders HQ
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Mobile order management
          </p>
        </div>
        <AdminLoginForm countryCode={countryCode} />
      </div>
    </div>
  )
}
