import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Empty } from '../components/shared/States';

export default function NotFound() {
  return <Empty icon={<Compass className="h-8 w-8" />} title="Page not found" hint="The page you are looking for doesn't exist." action={<Link to="/" className="btn btn-primary">Back to Home</Link>} />;
}
