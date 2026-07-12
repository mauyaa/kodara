'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  // type-casting here for convenience
  // in production, use zod to validate
  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error, data: signInData } = await supabase.auth.signInWithPassword(data)

  if (error) {
    redirect('/login?error=' + error.message)
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', signInData.user.id)
    .single()

  let role = profile?.role
  let justPromoted = false

  // Self-heals the case where signup()'s register_as_landlord() call never
  // ran because email confirmation was still pending at signup time (see
  // signup() below) -- the RPC itself rejects real tenants with tenancy
  // history, so this is a no-op for genuine tenant logins.
  if (role === 'tenant') {
    const { data: promoted } = await supabase.rpc('register_as_landlord')
    if (promoted) {
      role = promoted.role
      justPromoted = true
    }
  }

  revalidatePath('/', 'layout')
  if (justPromoted) {
    redirect('/onboarding')
  }
  redirect(role === 'tenant' ? '/portal' : '/dashboard')
}

// Web signup is landlord-only. Tenants can never complete
// accept_tenant_invitation without a Supabase-verified phone, which this
// email/password form never collects — the Flutter app's phone+OTP flow is
// the only real tenant onboarding path (see accept_tenant_invitation in
// supabase/migrations/20260701000000_core_schema.sql).
export async function signup(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirm_password') as string
  const fullName = (formData.get('full_name') as string)?.trim()

  if (password !== confirmPassword) {
    redirect('/signup?error=' + encodeURIComponent('Passwords do not match'))
  }

  if (!fullName || fullName.length < 2) {
    redirect('/signup?error=' + encodeURIComponent('Full name is required'))
  }

  const { error: signUpError, data: signUpData } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  })

  if (signUpError) {
    redirect('/signup?error=' + encodeURIComponent(signUpError.message))
  }

  // If the project requires email confirmation, signUp succeeds but returns
  // no session -- register_as_landlord() needs an authenticated caller, so
  // defer the promotion to the first login instead (see login()'s
  // self-healing promotion above).
  if (!signUpData.session) {
    redirect(
      '/login?message=' +
        encodeURIComponent('Account created. Check your email to confirm it, then sign in below.'),
    )
  }

  const { error: landlordError } = await supabase.rpc('register_as_landlord')
  if (landlordError) {
    redirect('/signup?error=' + encodeURIComponent(landlordError.message))
  }

  revalidatePath('/', 'layout')
  redirect('/onboarding')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
