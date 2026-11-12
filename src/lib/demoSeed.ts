// Sample data for DEMO MODE only (see demoStore.ts). Never used when Firebase is configured.
import { DEMO_PASSWORD } from './demoStore';

export { DEMO_PASSWORD };
export const DEMO_ACCOUNTS = [
  { id: 'admin', label: 'Administrator' },
  { id: 'prof-reyes', label: 'Professor' },
  { id: 'ictsoc', label: 'Organization (ICT Society)' },
  { id: '2024-0001', label: 'Student (Ana)' },
  { id: '2024-0002', label: 'Student (Ben)' },
];

export function buildSeed(): Record<string, any> {
  const t = Date.now();
  const H = 3600000, D = 86400000;
  const user = (uid: string, studentId: string, fullName: string, nickname: string, role: string, avatar: string, avatarColor: string, extra: object = {}) =>
    [uid, { studentId, fullName, nickname, bio: '', role, avatar, avatarColor, createdAt: t - 30 * D, isActive: true, ...extra }] as const;
  const users = Object.fromEntries([
    user('u-admin', 'admin', 'Site Administrator', 'Admin', 'admin', 'owl', '#F2D98D'),
    user('u-prof', 'prof-reyes', 'Prof. Marites Reyes', 'Ma\'am Reyes', 'professor', 'cat', '#D4AF37'),
    user('u-org', 'ictsoc', 'ICT Society Officer', 'ICTSoc', 'organization', 'panda', '#800020', { orgId: 'org-ictsoc' }),
    user('u-s1', '2024-0001', 'Ana Dela Cruz', 'Ana', 'student', 'fox', '#F2D98D', { bio: 'BSIT 2. Coffee, code, repeat.' }),
    user('u-s2', '2024-0002', 'Ben Santos', 'Ben', 'student', 'frog', '#BFD8C0'),
  ]);
  return {
    users,
    organizations: {
      'org-ictsoc': { name: 'ICT Society', description: 'Official organization of ICT students.', verified: true, authorizedUsers: { 'u-org': true } },
      'org-devs': { name: 'Developers Guild', description: 'Code clubs, hackathons and workshops.', verified: true },
    },
    announcements: {
      a1: { sourceType: 'di', sourceId: 'di', sourceName: 'Director for Instruction', title: 'DI Memo No. 12, s. 2026: Midterm Examination Schedule',
        content: 'Midterm examinations for all ICT programs will run from November 24 to 28. Please check your class schedules and coordinate with your subject professors for room assignments.',
        createdAt: t - 2 * H, status: 'published', authorUid: 'u-admin', memoId: 'm1' },
      a2: { sourceType: 'president', sourceId: 'president', sourceName: 'Office of the President', title: 'OP Memo No. 4, s. 2026: Campus Wi-Fi Maintenance',
        content: 'Network maintenance is scheduled this Saturday, 10 PM to 2 AM. Wi-Fi in the ICT building may be intermittent.',
        createdAt: t - 9 * H, status: 'published', authorUid: 'u-admin', memoId: 'm2' },
      a3: { sourceType: 'organization', sourceId: 'org-ictsoc', sourceName: 'ICT Society', title: 'Hack Night: Build in 6 hours',
        content: 'Join us for our monthly Hack Night! Bring your laptop and a teammate. Snacks provided. Registration is free for ICT students.',
        link: 'https://example.com/hack-night', createdAt: t - 1 * D, status: 'published', authorUid: 'u-org' },
      a4: { sourceType: 'admin', sourceId: 'admin', sourceName: 'School Administration', title: 'Enrollment for Second Semester Opens December 1',
        content: 'Enrollment for the second semester opens on December 1. Clearance must be completed before enrollment. See the registrar for details.',
        createdAt: t - 2 * D, status: 'published', authorUid: 'u-admin' },
      a5: { sourceType: 'organization', sourceId: 'org-devs', sourceName: 'Developers Guild', title: 'Intro to Git & GitHub Workshop',
        content: 'A beginner-friendly workshop on version control. Saturday, 1 PM at Lab 3.', createdAt: t - 3 * D, status: 'published', authorUid: 'u-admin' },
    },
    memoranda: {
      m1: { office: 'di', referenceNumber: 'DI Memo No. 12, s. 2026', title: 'Midterm Examination Schedule', content: 'Midterm examinations …', documentUrl: '', publishedAt: t - 2 * H, sourceType: 'upload', status: 'published', uploadedBy: 'u-admin' },
      m2: { office: 'president', referenceNumber: 'OP Memo No. 4, s. 2026', title: 'Campus Wi-Fi Maintenance', content: 'Network maintenance …', documentUrl: '', publishedAt: t - 9 * H, sourceType: 'upload', status: 'published', uploadedBy: 'u-admin' },
    },
    memoHashes: {},
    subjects: {
      s101: { subjectCode: 'IT101', subjectName: 'Introduction to Computing', professorId: 'u-prof', professorName: 'Prof. Marites Reyes', description: 'Foundations of computing.', createdAt: t - 20 * D },
      s202: { subjectCode: 'IT202', subjectName: 'Web Development', professorId: 'u-prof', professorName: 'Prof. Marites Reyes', description: 'HTML, CSS, JavaScript and React.', createdAt: t - 20 * D },
    },
    classLists: {
      s101: { '2024-0001': { fullName: 'Ana Dela Cruz' }, '2024-0002': { fullName: 'Ben Santos' } },
      s202: { '2024-0001': { fullName: 'Ana Dela Cruz' } },
    },
    subjectMembers: { s101: { 'u-s1': true, 'u-s2': true } },
    userSubjects: { 'u-s1': { s101: 'approved' }, 'u-s2': { s101: 'approved' } },
    joinRequests: {},
    classSchedules: {
      s101: { k1: { day: 'Mon', startTime: '09:00', endTime: '10:30', room: 'Lab 1', status: 'green' }, k2: { day: 'Wed', startTime: '09:00', endTime: '10:30', room: 'Lab 1', status: 'yellow', updatedBy: 'u-prof', updatedAt: t - H } },
      s202: { k1: { day: 'Tue', startTime: '13:00', endTime: '15:00', room: 'Lab 3', status: 'green' }, k2: { day: 'Fri', startTime: '13:00', endTime: '15:00', room: 'Lab 3', status: 'red', updatedBy: 'u-prof', updatedAt: t - 2 * H } },
    },
    scheduleHistory: { s101: { h1: { slotId: 'k2', from: 'green', to: 'yellow', by: 'u-prof', at: t - H } } },
    classUpdates: {
      s101: { c1: { professorId: 'u-prof', title: 'Quiz 1 next meeting', content: 'Quiz 1 covers chapters 1–2. Bring a calculator.', createdAt: t - 5 * H, kind: 'announcement' } },
    },
    messages: {
      s101: { x1: { senderId: 'u-s1', senderName: 'Ana', content: 'Ma\'am, will the quiz be open notes?', createdAt: t - 4 * H, messageType: 'text' } },
    },
    subjectMeta: {
      s101: { text: 'Ana: Ma\'am, will the quiz be open notes?', at: t - 4 * H, by: 'u-s1', kind: 'message' },
    },
    userReads: {},
    freedomWall: {
      w1: { authorLabel: 'Anonymous', anonymous: true, content: 'Whoever left the umbrella in Lab 2 — it\'s at the guard\'s desk. 🌂', createdAt: t - 1 * H, expiresAt: t + 11 * H, status: 'approved' },
      w2: { authorLabel: 'Ben', anonymous: false, content: 'Anyone up for a study group for IT101 midterms? Library 3rd floor, Thursday.', createdAt: t - 2 * H, expiresAt: t + 22 * H, status: 'approved' },
    },
    freedomWallPrivate: {
      w1: { uid: 'u-s1', studentId: '2024-0001', fullName: 'Ana Dela Cruz' },
      w2: { uid: 'u-s2', studentId: '2024-0002', fullName: 'Ben Santos' },
    },
    freedomWallQueue: {},
    freedomWallTerms: {},
    reports: {},
    rateLimits: {},
    userSettings: {},
    settings: { termsVersion: '1.0', freedomWall: { requireApproval: false } },
    activityLogs: { l1: { actorId: 'u-admin', action: 'announcement.publish', target: 'Enrollment for Second Semester Opens December 1', createdAt: t - 2 * D } },
    resetRequests: {},
  };
}
