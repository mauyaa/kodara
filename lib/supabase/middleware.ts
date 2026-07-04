import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { Database } from '@/generated/database.types'
import { getPublicSupabaseConfig } from '@/lib/supabase/config'

export async function updateSession(request: NextRequest) {
  const { url, key } = getPublicSupabaseConfig()
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient<Database>(
    url,
    key,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Protect all landlord routes. If there is no user and the route is not an auth route, redirect to login.
  // We assume the root `/` redirects to dashboard. The dashboard itself is under `/(landlord)/dashboard`.
  // Because route groups don't show up in pathname, we check the actual path.
  const protectedRoutes = ['/dashboard', '/properties', '/tenants', '/payments', '/maintenance', '/settings']
  const isProtectedRoute = protectedRoutes.some((route) => request.nextUrl.pathname.startsWith(route)) || request.nextUrl.pathname === '/'

  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // If the user is logged in and tries to access /login or /signup, redirect to dashboard.
  if (user && (request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/signup'))) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
