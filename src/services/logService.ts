import { newKey, stamp, write } from '../lib/database';

/** Appends an entry to the audit trail. Never throws: a logging failure must not block the action itself. */
export async function logActivity(actorId: string, action: string, target: string) {
  try {
    await write(`activityLogs/${newKey('activityLogs')}`, { actorId, action, target: target.slice(0, 200), createdAt: stamp() });
  } catch (e) {
    console.warn('Could not write activity log', e);
  }
}
