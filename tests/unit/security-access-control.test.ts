import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import {
  loginOwner,
  validateSession,
  revokeSession,
  guardOwnerRoute,
} from '../../apps/web/src/lib/server-auth';

test('Security & Access Control: guardOwnerRoute returns 401 when no session cookie or header is present', () => {
  const req = new NextRequest('http://localhost:3000/api/v1/owner/overview', {
    method: 'GET',
  });

  const authResponse = guardOwnerRoute(req);
  assert.ok(authResponse, 'Should return an unauthorized response');
  assert.equal(authResponse.status, 401);
});

test('Security & Access Control: loginOwner rejects invalid email', async () => {
  const result = await loginOwner({
    email: 'unauthorized_attacker@hacker.io',
    password: 'PlatformSecret2026!',
    otp: '123456',
  });

  assert.ok('error' in result);
  assert.equal(result.status, 401);
  assert.match(result.error, /unauthorized/i);
});

test('Security & Access Control: loginOwner rejects invalid password', async () => {
  const result = await loginOwner({
    email: 'saumya@gmail.com',
    password: 'WrongPasswordAttempt!',
    otp: '123456',
  });

  assert.ok('error' in result);
  assert.equal(result.status, 401);
  assert.match(result.error, /invalid password/i);
});

test('Security & Access Control: loginOwner rejects invalid MFA OTP token', async () => {
  const result = await loginOwner({
    email: 'saumya@gmail.com',
    password: 'PlatformSecret2026!',
    otp: '00000000', // Invalid OTP
  });

  assert.ok('error' in result);
  assert.equal(result.status, 401);
  assert.match(result.error, /invalid mfa/i);
});

test('Security & Access Control: loginOwner issues cryptographically secure session on valid credentials', async () => {
  const result = await loginOwner({
    email: 'saumya@gmail.com',
    password: 'PlatformSecret2026!',
    otp: '123456',
  });

  assert.ok(!('error' in result), 'Login must succeed');
  assert.ok(result.token, 'Must return session token');
  assert.equal(result.token.length, 64, 'Token must be a 256-bit hex string');
  assert.ok(result.csrf, 'Must return CSRF token');
  assert.equal(result.user.email, 'saumya@gmail.com');
  assert.equal(result.user.role, 'owner');

  // Verify session can be validated via Cookie
  const reqWithCookie = new NextRequest('http://localhost:3000/api/v1/owner/overview', {
    headers: {
      cookie: `jodo_session=${result.token}`,
    },
  });

  const sessionFromCookie = validateSession(reqWithCookie);
  assert.ok(sessionFromCookie);
  assert.equal(sessionFromCookie.user.email, 'saumya@gmail.com');

  // Verify session can be validated via Bearer Authorization Header
  const reqWithBearer = new NextRequest('http://localhost:3000/api/v1/owner/overview', {
    headers: {
      authorization: `Bearer ${result.token}`,
    },
  });

  const sessionFromBearer = validateSession(reqWithBearer);
  assert.ok(sessionFromBearer);
  assert.equal(sessionFromBearer.sessionId, result.sessionId);

  // Guard must permit GET requests with valid session
  const allowed = guardOwnerRoute(reqWithCookie);
  assert.equal(allowed, null, 'Must allow authenticated GET request');
});

test('Security & Access Control: revokeSession invalidates active session immediately', async () => {
  const session = await loginOwner({
    email: 'saumya@gmail.com',
    password: 'PlatformMaster2026!',
    otp: '123456',
  });

  assert.ok(!('error' in session));

  const req = new NextRequest('http://localhost:3000/api/v1/owner/institutions', {
    headers: {
      cookie: `jodo_session=${session.token}`,
    },
  });

  // Verify session is valid before logout
  assert.ok(validateSession(req));

  // Revoke session
  const revoked = revokeSession(req);
  assert.equal(revoked, true);

  // Verify session is no longer recognized
  assert.equal(validateSession(req), null);

  // Guard must now block the request
  const blocked = guardOwnerRoute(req);
  assert.ok(blocked);
  assert.equal(blocked.status, 401);
});
