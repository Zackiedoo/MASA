import { useState, type FormEvent } from 'react';
import { Modal } from '../shared/Modal';
import { Field } from '../shared/Field';
import { ErrorBox } from '../shared/States';
import { ProfileAvatar } from '../shared/Avatar';
import { AVATARS, AVATAR_COLORS, saveProfile } from '../../services/userService';
import { useToast } from '../../contexts/ToastContext';
import type { UserProfile } from '../../types';
import { validateBio, validateNickname } from '../../utils/validation';
import { explainError } from '../../lib/database';

export function EditProfileModal({ open, onClose, profile }: { open: boolean; onClose: () => void; profile: UserProfile }) {
  const toast = useToast();
  const [nickname, setNickname] = useState(profile.nickname);
  const [bio, setBio] = useState(profile.bio ?? '');
  const [avatar, setAvatar] = useState(profile.avatar);
  const [color, setColor] = useState(profile.avatarColor);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault(); setErr(null);
    const v = validateNickname(nickname) || validateBio(bio);
    if (v) return setErr(v);
    setBusy(true);
    try { await saveProfile(profile.uid, { nickname, bio, avatar, avatarColor: color }); toast('Profile saved.'); onClose(); }
    catch (x) { setErr(x instanceof Error && !/permission/i.test(x.message) ? x.message : explainError(x)); }
    finally { setBusy(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit profile">
      <form onSubmit={submit} className="space-y-5">
        {err && <ErrorBox message={err} />}
        <div className="flex justify-center"><ProfileAvatar avatar={avatar} color={color} size={96} /></div>
        <fieldset><legend className="mb-2 text-sm font-semibold">Character</legend>
          <div className="grid grid-cols-6 gap-2">{Object.entries(AVATARS).map(([k, emoji]) => (
            <button type="button" key={k} onClick={() => setAvatar(k)} aria-pressed={avatar === k} aria-label={k} className={`grid aspect-square place-items-center rounded-2xl border text-2xl ${avatar === k ? 'border-primary bg-primary/10 ring-2 ring-primary/30' : 'border-[rgb(var(--line))]'}`}>{emoji}</button>
          ))}</div>
        </fieldset>
        <fieldset><legend className="mb-2 text-sm font-semibold">Circle colour</legend>
          <div className="flex flex-wrap items-center gap-2">
            {AVATAR_COLORS.map((c) => <button type="button" key={c} onClick={() => setColor(c)} aria-label={`Colour ${c}`} aria-pressed={color === c} className={`h-9 w-9 rounded-full border-2 ${color === c ? 'border-ink' : 'border-white/70'}`} style={{ background: c }} />)}
            <label className="ml-1 flex items-center gap-2 text-xs text-muted">Custom<input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-9 cursor-pointer rounded-full border-0 bg-transparent p-0" /></label>
          </div>
        </fieldset>
        <Field label="Nickname" hint="Shown on your Freedom Wall posts (unless anonymous) and in group chats.">{(id) => <input id={id} className="field" value={nickname} maxLength={30} onChange={(e) => setNickname(e.target.value)} required />}</Field>
        <Field label={`Bio (${bio.length}/500)`}>{(id) => <textarea id={id} className="field" value={bio} maxLength={500} onChange={(e) => setBio(e.target.value)} placeholder="Tell people a little about you" />}</Field>
        <div className="flex justify-end gap-2"><button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button></div>
      </form>
    </Modal>
  );
}
