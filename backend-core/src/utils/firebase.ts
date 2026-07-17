import jwt from 'jsonwebtoken';

const GOOGLE_CERT_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken-system%40system.gserviceaccount.com';

interface DecodedToken {
  iss: string;
  aud: string;
  auth_time: number;
  sub: string;
  iat: number;
  exp: number;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
  [key: string]: any;
}

// In-memory cache for public keys
let publicKeysCache: Record<string, string> = {};
let cacheExpiry = 0;

async function getPublicKeys(): Promise<Record<string, string>> {
  const now = Date.now();
  if (Object.keys(publicKeysCache).length > 0 && now < cacheExpiry) {
    return publicKeysCache;
  }

  try {
    const res = await fetch(GOOGLE_CERT_URL);
    if (!res.ok) {
      throw new Error(`Failed to fetch certificates from Google: ${res.statusText}`);
    }
    const data = await res.json();
    
    // Cache public keys for 1 hour
    publicKeysCache = data;
    cacheExpiry = now + 3600 * 1000;
    
    return publicKeysCache;
  } catch (error) {
    console.error('Error fetching Google certificates:', error);
    throw error;
  }
}

export async function verifyFirebaseIdToken(token: string, projectId: string): Promise<DecodedToken> {
  const decodedHeader = jwt.decode(token, { complete: true });
  if (!decodedHeader || typeof decodedHeader === 'string' || !decodedHeader.header.kid) {
    throw new Error('Invalid Firebase ID token format');
  }

  const kid = decodedHeader.header.kid;
  const publicKeys = await getPublicKeys();
  const cert = publicKeys[kid];

  if (!cert) {
    throw new Error('Firebase ID token signed by unknown public key');
  }

  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      cert,
      {
        algorithms: ['RS256'],
        audience: projectId,
        issuer: `https://securetoken.google.com/${projectId}`,
      },
      (err, decoded) => {
        if (err) {
          reject(new Error(`Token verification failed: ${err.message}`));
        } else {
          resolve(decoded as DecodedToken);
        }
      }
    );
  });
}
