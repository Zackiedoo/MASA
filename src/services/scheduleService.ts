import { newKey, patch, stamp } from '../lib/database';
import type { Day, ScheduleSlot, ScheduleStatus } from '../types';
import { logActivity } from './logService';

export type SlotInput = { day: Day; startTime: string; endTime: string; room?: string };

export const STATUS_META: Record<ScheduleStatus, { label: string; hint: string; dot: string; chip: string }> = {
  green: { label: 'Confirmed', hint: 'Class is confirmed', dot: 'bg-ok', chip: 'bg-ok/15 text-ok' },
  yellow: { label: 'Pending', hint: 'Pending / awaiting confirmation', dot: 'bg-warn', chip: 'bg-warn/20 text-warn' },
  red: { label: 'No class', hint: 'No class / canceled', dot: 'bg-bad', chip: 'bg-bad/15 text-bad' },
};

export async function addSlot(subjectId: string, s: SlotInput) {
  const id = newKey(`classSchedules/${subjectId}`);
  await patch({ [`classSchedules/${subjectId}/${id}`]: { day: s.day, startTime: s.startTime, endTime: s.endTime, ...(s.room ? { room: s.room } : {}), status: 'green' } }); // default GREEN
}
export async function removeSlot(subjectId: string, slotId: string) {
  await patch({ [`classSchedules/${subjectId}/${slotId}`]: null });
}

/** Changes a slot's colour and appends to the history. Students' schedules update live via their listeners. */
export async function setStatus(actor: string, subjectId: string, subjectCode: string, slot: ScheduleSlot, to: ScheduleStatus) {
  if (slot.status === to) return;
  await patch({
    [`classSchedules/${subjectId}/${slot.id}/status`]: to,
    [`classSchedules/${subjectId}/${slot.id}/updatedBy`]: actor,
    [`classSchedules/${subjectId}/${slot.id}/updatedAt`]: stamp(),
    [`scheduleHistory/${subjectId}/${newKey(`scheduleHistory/${subjectId}`)}`]: { slotId: slot.id, from: slot.status, to, by: actor, at: stamp() },
  });
  await logActivity(actor, 'schedule.status', `${subjectCode} ${slot.day} ${slot.startTime}: ${slot.status} → ${to}`);
}
