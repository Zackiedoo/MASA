// Generates database.rules.json from readable building blocks.
// Run: npm run rules:generate   (the generated file is committed so you can deploy without running this).
//
// Realtime Database rules have no functions, so common checks are written once here and
// interpolated into the JSON strings below.
import { writeFileSync } from 'node:fs';

const uid = 'auth.uid';
const role = `root.child('users/'+auth.uid+'/role').val()`;
const active = `(auth != null && root.child('users/'+auth.uid+'/isActive').val() === true)`;
const isAdmin = `(${active} && ${role} === 'admin')`;
const isProf = `(${active} && ${role} === 'professor')`;
const isOrgUser = `(${active} && ${role} === 'organization')`;
const isStudent = `(${active} && ${role} === 'student')`;
const profOf = (sid) =>
  `(${isProf} && root.child('subjects/'+${sid}+'/professorId').val() === auth.uid)`;
const memberOf = (sid) => `(${active} && root.child('subjectMembers/'+${sid}+'/'+auth.uid).val() === true)`;
const staffOrMember = (sid) => `(${isAdmin} || ${profOf(sid)} || ${memberOf(sid)})`;
const adminOrProf = (sid) => `(${isAdmin} || ${profOf(sid)})`;
const url = `newData.isString() && newData.val().length <= 1000 && newData.val().matches(/^https?:.+/)`;
const str = (max, min = 0) =>
  `newData.isString() && newData.val().length <= ${max}${min ? ` && newData.val().length >= ${min}` : ''}`;
const HOURS = 3600000;
// The client computes expiresAt from its own clock, so allow ±2 minutes around now + {3,6,12,24} hours.
const DURATIONS = [3, 6, 12, 24]
  .map((h) => `(newData.val() >= now + ${h * HOURS - 120000} && newData.val() <= now + ${h * HOURS + 120000})`)
  .join(' || ');

const rules = {
  rules: {
    // ───────────── Users ─────────────
    // Private: only the owner and administrators can read a profile. Other people's names are
    // denormalised into the records that need them (messages, subjects, announcements).
    users: {
      '.read': isAdmin,
      '.indexOn': ['studentId', 'role'],
      $uid: {
        '.read': `${active} && auth.uid === $uid`,
        '.write': isAdmin,
        // Fields a user may change on THEIR OWN profile. role / isActive / studentId are NOT here.
        nickname: { '.write': `${active} && auth.uid === $uid`, '.validate': str(30, 2) },
        bio: { '.write': `${active} && auth.uid === $uid`, '.validate': str(500) },
        avatar: { '.write': `${active} && auth.uid === $uid`, '.validate': str(24) },
        avatarColor: {
          '.write': `${active} && auth.uid === $uid`,
          '.validate': `newData.isString() && newData.val().matches(/^#[0-9a-fA-F]{6}$/)`,
        },
        mustChangePassword: {
          '.write': `${active} && auth.uid === $uid && newData.val() === false`,
          '.validate': 'newData.isBoolean()',
        },
        role: { '.validate': `newData.val() === 'student' || newData.val() === 'organization' || newData.val() === 'professor' || newData.val() === 'admin'` },
        isActive: { '.validate': 'newData.isBoolean()' },
        studentId: { '.validate': str(20, 3) },
        fullName: { '.validate': str(120, 1) },
        $other: { '.validate': true },
      },
    },

    // ───────────── Organizations (public read: logos on the feed) ─────────────
    organizations: {
      '.read': true,
      $orgId: {
        '.write': isAdmin,
        description: {
          '.write': `${isOrgUser} && root.child('organizations/'+$orgId+'/authorizedUsers/'+auth.uid).val() === true`,
          '.validate': str(500),
        },
        logo: {
          '.write': `${isOrgUser} && root.child('organizations/'+$orgId+'/authorizedUsers/'+auth.uid).val() === true`,
          '.validate': url,
        },
        name: { '.validate': str(120, 2) },
        verified: { '.validate': 'newData.isBoolean()' },
      },
    },

    // ───────────── Announcements (public read — homepage works without login) ─────────────
    announcements: {
      '.read': true,
      '.indexOn': ['createdAt', 'status', 'sourceId'],
      $id: {
        '.write': `${isAdmin} || (${isOrgUser} && (!data.exists() || data.child('authorUid').val() === auth.uid) && (!newData.exists() || (newData.child('authorUid').val() === auth.uid && newData.child('sourceType').val() === 'organization' && root.child('organizations/'+newData.child('sourceId').val()+'/authorizedUsers/'+auth.uid).val() === true)))`,
        '.validate': `newData.hasChildren(['sourceType','sourceId','sourceName','title','content','createdAt','status','authorUid'])`,
        sourceType: { '.validate': `newData.val() === 'admin' || newData.val() === 'di' || newData.val() === 'president' || newData.val() === 'organization'` },
        sourceId: { '.validate': str(80, 1) },
        sourceName: { '.validate': str(120, 1) },
        title: { '.validate': str(200, 1) },
        content: { '.validate': str(5000, 1) },
        link: { '.validate': url },
        createdAt: { '.validate': `newData.isNumber() && (newData.val() === now || (data.exists() && data.val() === newData.val()))` },
        updatedAt: { '.validate': 'newData.isNumber()' },
        status: { '.validate': `newData.val() === 'published' || newData.val() === 'archived'` },
        authorUid: { '.validate': str(128, 1) },
        memoId: { '.validate': str(80) },
        attachments: {
          '.validate': 'newData.hasChildren() && newData.numChildren() <= 10',
          $i: {
            '.validate': `newData.hasChildren(['name','url','type'])`,
            name: { '.validate': str(200, 1) },
            url: { '.validate': url },
            type: { '.validate': `newData.val() === 'image' || newData.val() === 'file'` },
            $o: { '.validate': false },
          },
        },
        $other: { '.validate': false },
      },
    },

    // ───────────── Memoranda & duplicate-detection hashes (admin only; written by the API) ─────────────
    memoranda: { '.read': isAdmin, '.write': isAdmin, '.indexOn': ['publishedAt'] },
    memoHashes: { '.read': isAdmin, '.write': isAdmin },

    // ───────────── Subjects ─────────────
    subjects: {
      '.read': 'auth != null',
      $sid: {
        '.write': `${isAdmin} || (${isProf} && newData.exists() && newData.child('professorId').val() === auth.uid && (!data.exists() || data.child('professorId').val() === auth.uid))`,
        '.validate': `newData.hasChildren(['subjectCode','subjectName','professorId','professorName'])`,
        subjectCode: { '.validate': str(30, 2) },
        subjectName: { '.validate': str(120, 2) },
        professorId: { '.validate': str(128, 1) },
        professorName: { '.validate': str(120, 1) },
        description: { '.validate': str(500) },
        createdAt: { '.validate': 'newData.isNumber()' },
        $other: { '.validate': false },
      },
    },

    // Class lists: official rosters keyed by Student ID. Admin-managed; professors can read their own.
    classLists: {
      $sid: {
        '.read': adminOrProf('$sid'),
        '.write': isAdmin,
        $studentId: { '.validate': `$studentId.matches(/^[A-Za-z0-9-]{3,20}$/) && newData.hasChildren(['fullName'])` },
      },
    },

    // Approved members (used by every "members only" rule below).
    subjectMembers: {
      $sid: {
        '.read': adminOrProf('$sid'),
        '.write': adminOrProf('$sid'),
        $uid: { '.read': `${active} && auth.uid === $uid`, '.validate': 'newData.isBoolean()' },
      },
    },

    // Per-student view of subject status: pending | approved | rejected.
    // A student may only ever write 'pending' (and only if there is no live request) — duplicates are blocked.
    userSubjects: {
      $uid: {
        '.read': `${active} && (auth.uid === $uid || ${isAdmin})`,
        $sid: {
          '.write': `${adminOrProf('$sid')} || (${isStudent} && auth.uid === $uid && newData.val() === 'pending' && root.child('subjects/'+$sid).exists() && (!data.exists() || data.val() === 'rejected'))`,
          '.validate': `newData.val() === 'pending' || newData.val() === 'approved' || newData.val() === 'rejected'`,
        },
      },
    },

    // Join requests live under the subject so a professor can list only THEIR requests.
    joinRequests: {
      '.read': isAdmin,
      $sid: {
        '.read': adminOrProf('$sid'),
        $uid: {
          '.read': `${active} && auth.uid === $uid`,
          '.write': `${adminOrProf('$sid')} || (${isStudent} && auth.uid === $uid && newData.child('status').val() === 'pending' && (!data.exists() || data.child('status').val() === 'rejected'))`,
          '.validate': `newData.hasChildren(['studentId','studentName','status','requestedAt']) && newData.child('studentId').val() === root.child('users/'+$uid+'/studentId').val()`,
          studentId: { '.validate': str(20, 3) },
          studentName: { '.validate': str(120, 1) },
          status: { '.validate': `newData.val() === 'pending' || newData.val() === 'approved' || newData.val() === 'rejected'` },
          requestedAt: { '.validate': 'newData.isNumber()' },
          decidedAt: { '.validate': 'newData.isNumber()' },
          decidedBy: { '.validate': str(128) },
          $other: { '.validate': false },
        },
      },
    },

    // ───────────── Group chat & class updates (members only) ─────────────
    messages: {
      $sid: {
        '.read': staffOrMember('$sid'),
        '.indexOn': ['createdAt'],
        $mid: {
          '.write': `(!data.exists() && newData.exists() && (${memberOf('$sid')} || ${profOf('$sid')})) || (!newData.exists() && ${adminOrProf('$sid')})`,
          '.validate': `newData.hasChildren(['senderId','senderName','content','createdAt','messageType']) && newData.child('senderId').val() === auth.uid`,
          senderId: { '.validate': str(128, 1) },
          senderName: { '.validate': str(120, 1) },
          content: { '.validate': str(1000, 1) },
          createdAt: { '.validate': 'newData.val() === now' },
          messageType: { '.validate': `newData.val() === 'text'` },
          $other: { '.validate': false },
        },
      },
    },
    classUpdates: {
      $sid: {
        '.read': staffOrMember('$sid'),
        '.indexOn': ['createdAt'],
        $uidx: {
          '.write': adminOrProf('$sid'),
          '.validate': `newData.hasChildren(['professorId','title','content','createdAt','kind'])`,
          professorId: { '.validate': str(128, 1) },
          title: { '.validate': str(150, 1) },
          content: { '.validate': str(3000, 1) },
          kind: { '.validate': `newData.val() === 'announcement' || newData.val() === 'update'` },
          createdAt: { '.validate': `newData.val() === now || (data.exists() && data.val() === newData.val())` },
          $other: { '.validate': false },
        },
      },
    },
    // Latest-activity summary for the conversation card.
    subjectMeta: {
      $sid: {
        '.read': staffOrMember('$sid'),
        '.write': `${memberOf('$sid')} || ${profOf('$sid')}`,
        '.validate': `newData.hasChildren(['text','at','by'])`,
        text: { '.validate': str(140) },
        at: { '.validate': 'newData.val() === now' },
        by: { '.validate': `newData.val() === auth.uid` },
        kind: { '.validate': `newData.val() === 'message' || newData.val() === 'announcement' || newData.val() === 'update'` },
        $other: { '.validate': false },
      },
    },
    userReads: {
      $uid: { '.read': `${active} && auth.uid === $uid`, '.write': `${active} && auth.uid === $uid`, $sid: { '.validate': 'newData.isNumber()' } },
    },

    // ───────────── Schedules ─────────────
    classSchedules: {
      $sid: {
        '.read': staffOrMember('$sid'),
        $slot: {
          '.write': adminOrProf('$sid'),
          '.validate': `newData.hasChildren(['day','startTime','endTime','status'])`,
          day: { '.validate': `newData.isString() && newData.val().matches(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/)` },
          startTime: { '.validate': `newData.isString() && newData.val().matches(/^[0-2][0-9]:[0-5][0-9]$/)` },
          endTime: { '.validate': `newData.isString() && newData.val().matches(/^[0-2][0-9]:[0-5][0-9]$/)` },
          room: { '.validate': str(40) },
          status: { '.validate': `newData.val() === 'green' || newData.val() === 'yellow' || newData.val() === 'red'` },
          updatedBy: { '.validate': str(128) },
          updatedAt: { '.validate': 'newData.isNumber()' },
          $other: { '.validate': false },
        },
      },
    },
    // Append-only audit trail of status changes.
    scheduleHistory: {
      $sid: {
        '.read': adminOrProf('$sid'),
        '.indexOn': ['at'],
        $hid: { '.write': `!data.exists() && newData.exists() && ${adminOrProf('$sid')}`, '.validate': `newData.hasChildren(['slotId','from','to','by','at'])` },
      },
    },

    // ───────────── Freedom Wall ─────────────
    // /freedomWall            → approved, public-to-members posts (NO identity in here)
    // /freedomWallQueue       → posts waiting for moderation (admins only)
    // /freedomWallPrivate     → real identity behind every post (admins only)
    freedomWall: {
      '.read': active,
      '.indexOn': ['expiresAt', 'createdAt'],
      $pid: {
        '.write': `${isAdmin} || (!newData.exists() && root.child('freedomWallPrivate/'+$pid+'/uid').val() === auth.uid) || (!data.exists() && newData.exists() && ${isStudent} && root.child('freedomWallTerms/'+auth.uid+'/accepted').val() === true && root.child('settings/freedomWall/requireApproval').val() !== true && newData.child('status').val() === 'approved' && newData.parent().parent().child('rateLimits').child(auth.uid).child('post').val() === now && newData.parent().parent().child('freedomWallPrivate').child($pid).child('uid').val() === auth.uid)`,
        '.validate': `newData.hasChildren(['authorLabel','anonymous','content','createdAt','expiresAt','status'])`,
        authorLabel: { '.validate': `${str(60, 1)} && (${isAdmin} || (newData.parent().child('anonymous').val() === true && newData.val() === 'Anonymous') || (newData.parent().child('anonymous').val() === false && newData.val() === root.child('users/'+auth.uid+'/nickname').val()))` },
        anonymous: { '.validate': 'newData.isBoolean()' },
        content: { '.validate': str(500, 1) },
        createdAt: { '.validate': `newData.isNumber() && (newData.val() === now || data.exists() || ${isAdmin})` },
        expiresAt: {
          '.validate': `newData.isNumber() && (${isAdmin} || data.exists() || ${DURATIONS})`,
        },
        status: { '.validate': `newData.val() === 'approved'` },
        $other: { '.validate': false },
      },
    },
    freedomWallQueue: {
      '.read': isAdmin,
      '.indexOn': ['createdAt'],
      $pid: {
        '.read': `${active} && root.child('freedomWallPrivate/'+$pid+'/uid').val() === auth.uid`,
        '.write': `${isAdmin} || (!newData.exists() && root.child('freedomWallPrivate/'+$pid+'/uid').val() === auth.uid) || (!data.exists() && newData.exists() && ${isStudent} && root.child('freedomWallTerms/'+auth.uid+'/accepted').val() === true && root.child('settings/freedomWall/requireApproval').val() === true && newData.child('status').val() === 'pending' && newData.parent().parent().child('rateLimits').child(auth.uid).child('post').val() === now && newData.parent().parent().child('freedomWallPrivate').child($pid).child('uid').val() === auth.uid)`,
        '.validate': `newData.hasChildren(['authorLabel','anonymous','content','createdAt','expiresAt','status'])`,
        authorLabel: { '.validate': `${str(60, 1)} && (${isAdmin} || (newData.parent().child('anonymous').val() === true && newData.val() === 'Anonymous') || (newData.parent().child('anonymous').val() === false && newData.val() === root.child('users/'+auth.uid+'/nickname').val()))` },
        anonymous: { '.validate': 'newData.isBoolean()' },
        content: { '.validate': str(500, 1) },
        createdAt: { '.validate': `newData.isNumber() && (newData.val() === now || data.exists())` },
        expiresAt: {
          '.validate': `newData.isNumber() && (data.exists() || ${DURATIONS})`,
        },
        status: { '.validate': `newData.val() === 'pending' || newData.val() === 'rejected'` },
        decidedBy: { '.validate': str(128) },
        decidedAt: { '.validate': 'newData.isNumber()' },
        $other: { '.validate': false },
      },
    },
    freedomWallPrivate: {
      '.read': isAdmin,
      '.write': isAdmin,
      $pid: {
        '.write': `(!data.exists() && newData.exists() && ${isStudent} && newData.child('uid').val() === auth.uid) || (!newData.exists() && data.child('uid').val() === auth.uid)`,
        '.validate': `newData.hasChildren(['uid','studentId','fullName']) && newData.child('studentId').val() === root.child('users/'+newData.child('uid').val()+'/studentId').val() && newData.child('fullName').val() === root.child('users/'+newData.child('uid').val()+'/fullName').val()`,
        $other: { '.validate': true },
      },
    },
    freedomWallTerms: {
      $uid: {
        '.read': `${active} && auth.uid === $uid`,
        '.write': `${active} && auth.uid === $uid`,
        '.validate': `newData.hasChildren(['accepted','version','acceptedAt'])`,
        accepted: { '.validate': 'newData.val() === true' },
        version: { '.validate': str(20, 1) },
        acceptedAt: { '.validate': 'newData.val() === now' },
        $other: { '.validate': false },
      },
    },
    // One report per (post, reporter): the key is `${postId}_${reporterUid}`, so duplicates simply overwrite-fail.
    reports: {
      '.read': isAdmin,
      '.indexOn': ['postId', 'status'],
      $rid: {
        '.write': `${isAdmin} || (!data.exists() && ${isStudent} && newData.child('reporterId').val() === auth.uid && $rid === newData.child('postId').val() + '_' + auth.uid && root.child('freedomWall/'+newData.child('postId').val()).exists() && newData.parent().parent().child('rateLimits').child(auth.uid).child('report').val() === now)`,
        '.validate': `newData.hasChildren(['postId','reporterId','reason','createdAt','status'])`,
        postId: { '.validate': str(80, 1) },
        reporterId: { '.validate': str(128, 1) },
        reason: { '.validate': str(300, 1) },
        createdAt: { '.validate': `newData.val() === now || (data.exists() && data.val() === newData.val())` },
        status: { '.validate': `newData.val() === 'open' || newData.val() === 'dismissed' || newData.val() === 'actioned'` },
        $other: { '.validate': false },
      },
    },
    // Abuse prevention: a client can only write "now", and only if its previous write is old enough.
    rateLimits: {
      $uid: {
        post: { '.write': `${active} && auth.uid === $uid && newData.val() === now && (!data.exists() || data.val() < now - 30000)`, '.validate': 'newData.isNumber()' },
        report: { '.write': `${active} && auth.uid === $uid && newData.val() === now && (!data.exists() || data.val() < now - 10000)`, '.validate': 'newData.isNumber()' },
      },
    },

    // ───────────── Settings, logs, misc ─────────────
    userSettings: {
      $uid: {
        '.read': `${active} && auth.uid === $uid`,
        '.write': `${active} && auth.uid === $uid`,
        theme: { '.validate': `newData.val() === 'maroon-gold' || newData.val() === 'light' || newData.val() === 'dark'` },
        fontSize: { '.validate': `newData.val() === 'sm' || newData.val() === 'md' || newData.val() === 'lg' || newData.val() === 'xl'` },
        reduceMotion: { '.validate': 'newData.isBoolean()' },
        $other: { '.validate': false },
      },
    },
    settings: { '.read': 'auth != null', '.write': isAdmin },
    activityLogs: {
      '.read': isAdmin,
      '.indexOn': ['createdAt'],
      $lid: {
        '.write': `!data.exists() && newData.exists() && (${isAdmin} || ${isProf} || ${isOrgUser}) && newData.child('actorId').val() === auth.uid`,
        '.validate': `newData.hasChildren(['actorId','action','target','createdAt']) && newData.child('createdAt').val() === now`,
        action: { '.validate': str(60, 1) },
        target: { '.validate': str(200) },
        $other: { '.validate': true },
      },
    },
    // Password-reset requests (students can't e-mail themselves a reset link, so admins handle them).
    // Anyone may create ONE request per Student ID; only admins can read or resolve them.
    resetRequests: {
      '.read': isAdmin,
      $studentId: {
        '.write': `${isAdmin} || (!data.exists() && newData.exists())`,
        '.validate': `$studentId.matches(/^[A-Za-z0-9-]{3,20}$/) && newData.hasChildren(['studentId','requestedAt','status']) && newData.child('studentId').val() === $studentId`,
        requestedAt: { '.validate': `newData.val() === now || data.exists()` },
        status: { '.validate': `newData.val() === 'open' || newData.val() === 'resolved'` },
        $other: { '.validate': true },
      },
    },
  },
};

writeFileSync(new URL('../database.rules.json', import.meta.url), JSON.stringify(rules, null, 2) + '\n');
console.log('Wrote database.rules.json');
