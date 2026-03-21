import "server-only"
import { cookies } from "next/headers"

const ADMIN_COOKIE = "_medusa_admin_jwt"

export const getAdminToken = async (): Promise<string | undefined> => {
  const cookiesStore = await cookies()
  return cookiesStore.get(ADMIN_COOKIE)?.value
}

export const getAdminAuthHeaders = async (): Promise<
  { authorization: string } | {}
> => {
  const token = await getAdminToken()
  if (token) {
    return { authorization: `Bearer ${token}` }
  }
  return {}
}

export const setAdminToken = async (token: string) => {
  const cookiesStore = await cookies()
  cookiesStore.set(ADMIN_COOKIE, token, {
    maxAge: 60 * 60 * 24 * 7,
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  })
}

export const removeAdminToken = async () => {
  const cookiesStore = await cookies()
  cookiesStore.set(ADMIN_COOKIE, "", { maxAge: -1 })
}
