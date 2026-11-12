import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { LEGAL } from '../content/legal';
import NotFound from './NotFound';

export default function Legal() {
  const { doc = '' } = useParams();
  const d = LEGAL[doc];
  if (!d) return <NotFound />;
  return (
    <article className="glass card space-y-5 p-6">
      <Link to="/settings" className="btn btn-ghost btn-sm"><ArrowLeft className="h-4 w-4" />Back</Link>
      <div><h1 className="text-2xl font-extrabold">{d.title}</h1><p className="text-xs text-muted">{d.updated}</p></div>
      {d.sections.map((s) => (
        <section key={s.h} className="space-y-2"><h2 className="font-bold">{s.h}</h2>{s.p.map((t, i) => <p key={i} className="text-sm leading-relaxed text-ink/90">{t}</p>)}</section>
      ))}
    </article>
  );
}
