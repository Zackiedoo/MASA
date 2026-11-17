// Single source of truth for "who may do what" on the FRONT END (which buttons/routes to show).
// This is a convenience for the interface only: the real enforcement is in database.rules.json,
// storage.rules and the /api functions, which re-check every action on the server.
import type { Role, UserProfile } from '../types';

export type Action =
  // announcements
  | 'announcement.view' | 'announcement.share' | 'announcement.create' | 'announcement.editOwn' | 'announcement.deleteOwn' | 'announcement.moderate'
  // freedom wall
  | 'wall.view' | 'wall.post' | 'wall.report' | 'wall.editOwn' | 'wall.deleteOwn' | 'wall.moderate'
  // courses
  | 'course.viewAssigned' | 'course.viewEnrolled' | 'course.manage' | 'course.enrollStudents' | 'course.removeStudents' | 'course.updateSchedule'
  // accounts
  | 'user.manage' | 'registration.review';

const M: Record<Role, readonly Action[]> = {
  admin: ['announcement.view', 'announcement.share', 'announcement.create', 'announcement.moderate', 'wall.view', 'wall.moderate',
    'course.manage', 'course.updateSchedule', 'user.manage', 'registration.review'],
  organization: ['announcement.view', 'announcement.share', 'announcement.create', 'announcement.editOwn', 'announcement.deleteOwn', 'wall.view'],
  professor: ['announcement.view', 'announcement.share', 'wall.view', 'course.viewAssigned', 'course.enrollStudents', 'course.removeStudents', 'course.updateSchedule'],
  student: ['announcement.view', 'announcement.share', 'wall.view', 'wall.post', 'wall.report', 'wall.editOwn', 'wall.deleteOwn', 'course.viewEnrolled'],
};

export const ROLE_LABEL: Record<Role, string> = { admin: 'System Administrator', organization: 'Organization account', professor: 'Professor / Instructor', student: 'Student' };

/** An account may act only once approved and active. Older accounts have no approvalStatus and count as approved. */
export function isApproved(p: Pick<UserProfile, 'approvalStatus' | 'isActive'> | null | undefined): boolean {
  return !!p && (p.approvalStatus ?? 'approved') === 'approved' && p.isActive !== false;
}

/** Public (signed-out) visitors may only read announcements. */
export function can(profile: UserProfile | null | undefined, action: Action): boolean {
  if (action === 'announcement.view' || action === 'announcement.share') return true;
  if (!profile || !isApproved(profile)) return false;
  return M[profile.role].includes(action);
}

/** Why an action is unavailable, in plain words (for tooltips and error screens). */
export function denyReason(profile: UserProfile | null | undefined): string {
  if (!profile) return 'Please log in to do this.';
  if (!isApproved(profile)) return 'Your account is not active yet.';
  return `${ROLE_LABEL[profile.role]} accounts can't do this.`;
}

export const approvalOf = (p: Pick<UserProfile, 'approvalStatus'>) => p.approvalStatus ?? 'approved';
