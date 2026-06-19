import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const appPassword = process.env.APP_PASSWORD;

  // Allow if no password is configured
  if (!appPassword) {
    return NextResponse.next();
  }

  // Skip auth for login page, auth API, static assets
  if (
    pathname === '/login' ||
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/static/') ||
    pathname === '/favicon.ico' ||
    pathname === '/logo.png'
  ) {
    return NextResponse.next();
  }

  const authCookie = request.cookies.get('auth_token')?.value;

  if (!authCookie) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Validate: hash APP_PASSWORD and compare with cookie
  const encoder = new TextEncoder();
  const data = encoder.encode(appPassword);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const expectedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  if (authCookie !== expectedHash) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo.png).*)'],
};
