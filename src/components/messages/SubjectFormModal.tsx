import { useState, type FormEvent } from 'react';
import { Modal } from '../shared/Modal';
import { Field } from '../shared/Field';
import { ErrorBox } from '../shared/States';
import { saveSubject, removeSlotsAndAdd } from '../../services/adminService';
import { explainError } from '../../lib/database';
import { cleanText } from '../../utils/validation';
import { DAYS } from '../../utils/format';
import { useToast } from '../../contexts/ToastContext';
import type { Day, Subject } from '../../types';

interface Props {
  open: boolean; onClose: () => void; actorUid: string;
  /** professors create subjects for themselves; admins pick a professor */
  professor?: { id: string; name: string };
  professors?: Array<{ id: string; name: string }>;
  existing?: Subject;
}

/** Create / edit a subject group (with optional first meeting times). */
export function SubjectFormModal({ open, onClose, actorUid, professor, professors, existing }: Props) {
  const toast = useToast();
  const [code, setCode] = useState(existing?.subjectCode ?? '');
  const [name, setName] = useState(existing?.subjectName ?? '');
  const [desc, setDesc] = useState(existing?.description ?? '');
  const [profId, setProfId] = useState(existing?.professorId ?? professor?.id ?? professors?.[0]?.id ?? '');
  const [slotDays, setSlotDays] = useState<Day[]>([]);
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('10:30');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault(); setErr(null);
    const p = professor ?? professors?.find((x) => x.id === profId);
    if (!p) return setErr('Select a professor.');
    if (code.trim().length < 2 || name.trim().length < 2) return setErr('Enter a subject code and name.');
    if (slotDays.length && end <= start) return setErr('End time must be after start time.');
    setBusy(true);
    try {
      const id = await saveSubject(actorUid, { id: existing?.id, subjectCode: cleanText(code).toUpperCase().slice(0, 30), subjectName: cleanText(name).slice(0, 120), professorId: p.id, professorName: p.name, description: cleanText(desc).slice(0, 500) });
      if (!existing && slotDays.length) await removeSlotsAndAdd(id, slotDays.map((d) => ({ day: d, startTime: start, endTime: end })));
      toast(existing ? 'Subject updated.' : 'Subject created.'); onClose();
    } catch (x) { setErr(explainError(x)); } finally { setBusy(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title={existing ? 'Edit subject' : 'New subject'}>
      <form onSubmit={submit} className="space-y-4">
        {err && <ErrorBox message={err} />}
        <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
          <Field label="Code">{(id) => <input id={id} className="field" value={code} onChange={(e) => setCode(e.target.value)} placeholder="IT101" required />}</Field>
          <Field label="Subject name">{(id) => <input id={id} className="field" value={name} onChange={(e) => setName(e.target.value)} required />}</Field>
        </div>
        {professors && <Field label="Professor">{(id) => <select id={id} className="field" value={profId} onChange={(e) => setProfId(e.target.value)}>{professors.length === 0 && <option value="">No professor accounts yet</option>}{professors.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>}</Field>}
        <Field label="Description (optional)">{(id) => <textarea id={id} className="field min-h-20" value={desc} maxLength={500} onChange={(e) => setDesc(e.target.value)} />}</Field>
        {!existing && (
          <fieldset className="space-y-2 rounded-2xl bg-primary/6 p-3"><legend className="px-1 text-sm font-semibold">Meeting days (optional)</legend>
            <div className="flex flex-wrap gap-2">{DAYS.map((d) => <button type="button" key={d} className="chip" aria-pressed={slotDays.includes(d)} onClick={() => setSlotDays((l) => l.includes(d) ? l.filter((x) => x !== d) : [...l, d])}>{d}</button>)}</div>
            <div className="grid grid-cols-2 gap-2"><input className="field" type="time" aria-label="Start" value={start} onChange={(e) => setStart(e.target.value)} /><input className="field" type="time" aria-label="End" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
          </fieldset>
        )}
        <div className="flex justify-end gap-2"><button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button></div>
      </form>
    </Modal>
  );
}
