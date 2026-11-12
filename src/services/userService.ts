import { patch } from '../lib/database';
import { cleanText, isHexColor, validateBio, validateNickname } from '../utils/validation';

export const AVATARS: Record<string, string> = {
  fox: '🦊', panda: '🐼', owl: '🦉', cat: '🐱', koala: '🐨', frog: '🐸', lion: '🦁', robot: '🤖', astronaut: '🧑‍🚀', wizard: '🧙', ninja: '🥷', alien: '👽',
};
export const AVATAR_COLORS = ['#F2D98D', '#D4AF37', '#800020', '#4A0015', '#BFD8C0', '#B8CCE8', '#E8C5D6', '#D9D2E9', '#FFD6A5', '#CFCFCF'];

export async function saveProfile(uid: string, v: { nickname: string; bio: string; avatar: string; avatarColor: string }) {
  const nickErr = validateNickname(v.nickname);
  if (nickErr) throw new Error(nickErr);
  const bioErr = validateBio(v.bio);
  if (bioErr) throw new Error(bioErr);
  if (!(v.avatar in AVATARS)) throw new Error('Pick one of the available characters.');
  if (!isHexColor(v.avatarColor)) throw new Error('Pick a valid colour.');
  await patch({
    [`users/${uid}/nickname`]: cleanText(v.nickname),
    [`users/${uid}/bio`]: cleanText(v.bio, { multiline: true }),
    [`users/${uid}/avatar`]: v.avatar,
    [`users/${uid}/avatarColor`]: v.avatarColor,
  });
}

export const clearMustChangePassword = (uid: string) => patch({ [`users/${uid}/mustChangePassword`]: false });
