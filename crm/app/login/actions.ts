'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, createSessionCookieValue } from '@/lib/auth';

export async function login(formData: FormData) {
  const password = String(formData.get('password') ?? '');
  const next = String(formData.get('next') ?? '/inbox');
  const expected = process.env.CRM_OWNER_PASSWORD;

  if (!expected || password !== expected) {
    redirect(`/login?error=1&next=${encodeURIComponent(next)}`);
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, await createSessionCookieValue(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  redirect(next || '/inbox');
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect('/login');
}
