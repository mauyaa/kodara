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

  revalidatePath('/', 'layout')
  redirect(profile?.role === 'tenant' ? '/portal' : '/dashboard')
}

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

  const { error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  })

  if (signUpError) {
    redirect('/signup?error=' + encodeURIComponent(signUpError.message))
  }

  const { error: landlordError } = await supabase.rpc('register_as_landlord')

  if (landlordError) {
    redirect('/signup?error=' + encodeURIComponent(landlordError.message))
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
