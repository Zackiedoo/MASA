export type Role = 'student' | 'organization' | 'professor' | 'admin';

export interface UserProfile {
  uid: string;
  studentId: string; // login ID (student number, or staff username)
  fullName: string;
  nickname: string;
  bio: string;
  role: Role;
  avatar: string;
  avatarColor: string;
  createdAt: number;
  isActive: boolean;
  mustChangePassword?: boolean;
  orgId?: string;
  /** Professors/organizations register as 'pending' until an administrator approves them. Missing = approved (older accounts). */
  approvalStatus?: ApprovalStatus;
  rejectionReason?: string;
  registration?: { contactEmail?: string; note?: string; orgName?: string; orgDescription?: string };
}
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface Organization {
  id: string;
  name: string;
  logo?: string;
  description?: string;
  verified?: boolean;
  authorizedUsers?: Record<string, boolean>;
}

export type SourceType = 'admin' | 'di' | 'president' | 'organization';
export interface Attachment { name: string; url: string; type: 'image' | 'file' }
export interface Announcement {
  id: string;
  sourceType: SourceType;
  sourceId: string;
  sourceName: string;
  title: string;
  content: string;
  attachments?: Attachment[];
  link?: string;
  createdAt: number;
  updatedAt?: number;
  status: 'published' | 'archived' | 'hidden';
  /** Administrator moderation flags (only admins can set these). */
  flagged?: boolean;
  flagReason?: string;
  authorUid: string;
  memoId?: string;
}

export interface Memorandum {
  id: string;
  office: 'di' | 'president';
  referenceNumber: string;
  title: string;
  content: string;
  documentUrl: string;
  publishedAt: number;
  sourceType: 'upload' | 'webhook';
  status: 'published' | 'draft';
  uploadedBy?: string;
}

export interface Subject {
  id: string;
  subjectCode: string;
  subjectName: string;
  professorId: string;
  professorName: string;
  description?: string;
  createdAt?: number;
}
export type MembershipStatus = 'pending' | 'approved' | 'rejected';
export interface JoinRequest {
  uid: string;
  subjectId: string;
  studentId: string;
  studentName: string;
  status: MembershipStatus;
  requestedAt: number;
  decidedAt?: number;
  decidedBy?: string;
}
export interface ChatMessage { id: string; senderId: string; senderName: string; content: string; createdAt: number; messageType: 'text' }
export interface ClassUpdate { id: string; professorId: string; title: string; content: string; createdAt: number; kind: 'announcement' | 'update' }
export interface SubjectMeta { text: string; at: number; by: string; kind?: 'message' | 'announcement' | 'update' }

export type ScheduleStatus = 'green' | 'yellow' | 'red';
export type Day = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
export interface ScheduleSlot {
  id: string;
  subjectId?: string;
  day: Day;
  startTime: string; // HH:mm
  endTime: string;
  room?: string;
  status: ScheduleStatus;
  updatedBy?: string;
  updatedAt?: number;
}
export interface ScheduleHistoryEntry { id: string; slotId: string; from: ScheduleStatus; to: ScheduleStatus; by: string; at: number }

export interface WallPost {
  id: string;
  authorLabel: string;
  anonymous: boolean;
  content: string;
  createdAt: number;
  expiresAt: number;
  status: 'approved' | 'pending' | 'rejected' | 'hidden';
  flagged?: boolean;
  editedAt?: number;
  likes?: number;
  dislikes?: number;
}
/** A student on a course roster (subjectMembers/{subjectId}/{uid}). */
export interface RosterEntry { uid: string; studentId: string; fullName: string; enrolledAt?: number; by?: string }
export interface Report { id: string; postId: string; reporterId: string; reason: string; createdAt: number; status: 'open' | 'dismissed' | 'actioned' }
export interface WallIdentity { uid: string; studentId: string; fullName: string }

export type ThemeName = 'maroon-gold' | 'light' | 'dark';
export type FontSize = 'sm' | 'md' | 'lg' | 'xl';
export interface UserSettings { theme: ThemeName; fontSize: FontSize; reduceMotion: boolean }

export interface ActivityLog { id: string; actorId: string; action: string; target: string; createdAt: number }
export interface ResetRequest { studentId: string; requestedAt: number; status: 'open' | 'resolved' }
export interface SystemSettings { termsVersion?: string; freedomWall?: { requireApproval?: boolean } }
