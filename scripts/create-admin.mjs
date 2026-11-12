// Creates the FIRST administrator (there is no way to self-register as admin, by design).
//
//   1. Download a service-account key (Firebase Console → Project settings → Service accounts). Keep it OUT of git.
//   2. Run:
//        FIREBASE_SERVICE_ACCOUNT_FILE=./serviceAccount.json \
//        FIREBASE_DATABASE_URL=https://<project>-default-rtdb.firebaseio.com \
//        npm run admin:create -- admin01 "Site Administrator"
//   The script prints a one-time temporary password; you are forced to change it at first login.
import { readFileSync } from 'node:fs';
import { randomInt } from 'node:crypto';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';

const [loginId, ...nameParts] = process.argv.slice(2);
const fullName = nameParts.join(' ') || 'Administrator';
const file = process.env.FIREBASE_SERVICE_ACCOUNT_FILE;
const databaseURL = process.env.FIREBASE_DATABASE_URL;
const domain = process.env.LOGIN_EMAIL_DOMAIN || 'masa-login.example.com';
if (!loginId || !file || !databaseURL) {
  console.error('Usage: FIREBASE_SERVICE_ACCOUNT_FILE=… FIREBASE_DATABASE_URL=… npm run admin:create -- <loginId> "<Full Name>"');
  process.exit(1);
}
if (!/^[A-Za-z0-9-]{3,20}$/.test(loginId)) { console.error('Login ID must be 3–20 letters, digits or dashes.'); process.exit(1); }

initializeApp({ credential: cert(JSON.parse(readFileSync(file, 'utf8'))), databaseURL });
const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const password = Array.from({ length: 14 }, () => chars[randomInt(chars.length)]).join('');

const user = await getAuth().createUser({ email: `${loginId.toLowerCase()}@${domain}`, password, displayName: fullName });
await getAuth().setCustomUserClaims(user.uid, { role: 'admin' });
await getDatabase().ref(`users/${user.uid}`).set({
  studentId: loginId, fullName, nickname: fullName.split(' ')[0].slice(0, 30).padEnd(2, '_'), bio: '', role: 'admin',
  avatar: 'owl', avatarColor: '#F2D98D', createdAt: Date.now(), isActive: true, mustChangePassword: true,
});
await getDatabase().ref('settings').update({ termsVersion: '1.0', freedomWall: { requireApproval: false } });
console.log(`\nAdministrator created.\n  Login ID: ${loginId}\n  Temporary password: ${password}\n`);
process.exit(0);
