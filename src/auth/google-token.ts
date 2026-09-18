import { UnauthorizedException } from '@nestjs/common';

type GoogleTokenInfo = {
  aud?: string;
  email?: string;
  email_verified?: string | boolean;
  name?: string;
  sub?: string;
};

function audiences() {
  return [
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_ANDROID_CLIENT_ID,
    process.env.GOOGLE_IOS_CLIENT_ID,
  ]
    .map((v) => v?.trim())
    .filter((v): v is string => !!v);
}

export function googleConfigured() {
  return audiences().length > 0;
}

export async function verifyGoogleIdToken(idToken: string) {
  const allowed = audiences();
  if (!allowed.length) {
    throw new UnauthorizedException('Google sign-in isn’t ready yet. Use email.');
  }

  const res = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
  );
  const data = (await res.json()) as GoogleTokenInfo;
  if (!res.ok || !data.email || !data.sub) {
    throw new UnauthorizedException('Google sign-in didn’t finish. Try again.');
  }
  if (!data.aud || !allowed.includes(data.aud)) {
    throw new UnauthorizedException('Google sign-in didn’t finish. Try again.');
  }
  const verified = data.email_verified === true || data.email_verified === 'true';
  if (!verified) {
    throw new UnauthorizedException('That Google email isn’t verified.');
  }
  return {
    email: data.email.toLowerCase(),
    name: (data.name || data.email.split('@')[0]).slice(0, 80),
    googleId: data.sub,
  };
}
