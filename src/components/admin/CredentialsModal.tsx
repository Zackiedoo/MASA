import { Copy, Download } from 'lucide-react';
import { Modal } from '../shared/Modal';
import { useToast } from '../../contexts/ToastContext';

export interface Credential { id: string; name: string; password: string; error?: string }

/** Temporary passwords are shown ONCE — they are not stored anywhere in the database. */
export function CredentialsModal({ items, onClose }: { items: Credential[] | null; onClose: () => void }) {
  const toast = useToast();
  if (!items) return null;
  const ok = items.filter((i) => !i.error);
  const csv = () => {
    const rows = [['Login ID', 'Name', 'Temporary password'], ...ok.map((i) => [i.id, i.name, i.password])];
    const blob = new Blob([rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'masa-temporary-passwords.csv'; a.click(); URL.revokeObjectURL(a.href);
  };
  return (
    <Modal open onClose={onClose} title="Temporary passwords" wide footer={<>
      <button className="btn btn-ghost" onClick={() => { void navigator.clipboard.writeText(ok.map((i) => `${i.id}\t${i.password}`).join('\n')); toast('Copied.'); }}><Copy className="h-4 w-4" />Copy</button>
      {ok.length > 1 && <button className="btn btn-ghost" onClick={csv}><Download className="h-4 w-4" />Download CSV</button>}
      <button className="btn btn-primary" onClick={onClose}>Done</button></>}>
      <p className="mb-3 rounded-2xl bg-warn/15 px-3 py-2 text-sm text-warn">Save these now — they will not be shown again. Each person must change their password at first login.</p>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-muted"><tr><th className="py-1 pr-3">ID</th><th className="pr-3">Name</th><th>Temporary password</th></tr></thead>
        <tbody>{items.map((i) => <tr key={i.id} className="border-t divider"><td className="py-1.5 pr-3 font-semibold">{i.id}</td><td className="pr-3">{i.name}</td><td>{i.error ? <span className="text-bad">{i.error}</span> : <code className="rounded bg-ink/8 px-1.5 py-0.5">{i.password}</code>}</td></tr>)}</tbody></table></div>
    </Modal>
  );
}
