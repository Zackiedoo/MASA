// Starter legal text. These are TEMPLATES written for the app's actual behaviour — the school must have
// them reviewed (e.g. by its legal counsel / Data Protection Officer) and edit them before real use.
export interface LegalDoc { title: string; updated: string; sections: Array<{ h: string; p: string[] }> }

export const LEGAL: Record<string, LegalDoc> = {
  terms: {
    title: 'General Terms of Service',
    updated: 'Version 1.0',
    sections: [
      { h: '1. About MASA', p: ['MASA (Modern Academic Social Announcements) is an academic platform for official school announcements, organization updates, class communication and a temporary student Freedom Wall.'] },
      { h: '2. Accounts', p: ['Accounts are created by school administrators. Keep your password private and change the temporary password at your first login. You are responsible for activity under your account.', 'Administrators may disable an account that violates these terms or school policy.'] },
      { h: '3. Acceptable use', p: ['Be respectful. Do not post unlawful, harassing, discriminatory, sexually explicit or deceptive content, do not impersonate others, and do not attempt to access data or functions you are not authorised to use.'] },
      { h: '4. Official content', p: ['Only authorised offices and recognised organizations may publish announcements. Content on the homepage is the responsibility of the office or organization that posted it.'] },
      { h: '5. Class groups', p: ['Subject group chats are for class matters. Membership requires approval by the subject professor against the official class list.'] },
      { h: '6. Changes', p: ['These terms may be updated. Continued use after an update means you accept the new version.'] },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    updated: 'Version 1.0',
    sections: [
      { h: '1. What we collect', p: ['Account data provided by your school: Student ID, full name and role. Profile data you add: nickname, bio, avatar. Content you create: Freedom Wall posts, group messages, join requests. Settings such as theme and font size.'] },
      { h: '2. How we use it', p: ['To run the platform: sign you in, show announcements, deliver class updates, keep the Freedom Wall safe and keep audit logs of administrative actions.'] },
      { h: '3. Who can see what', p: ['Your Student ID is never shown publicly. Other students see only your nickname where you post under your name.', 'Anonymous Freedom Wall posts show no identity to other students. For moderation and security, authorised administrators can look up the account behind a post; every such lookup is logged.', 'Professors see the Student ID and name of students who request to join their subjects.'] },
      { h: '4. Storage and security', p: ['Data is stored with Google Firebase. Passwords are handled by Firebase Authentication and are never stored in the database. Access is enforced with role-based security rules.'] },
      { h: '5. Retention', p: ['Freedom Wall posts and their identity records are deleted automatically when they expire. Other data is kept while your account is active, unless your school policy requires otherwise.'] },
      { h: '6. Your rights', p: ['You may request access to or correction of your data through your school administrator, as provided by applicable data-privacy law.'] },
    ],
  },
  'freedom-wall': {
    title: 'Freedom Wall Terms and Agreement',
    updated: 'Version 1.0',
    sections: [
      { h: '1. Purpose', p: ['The Freedom Wall is a temporary space for ICT students to express themselves respectfully. Posts disappear automatically after the duration you choose (3, 6, 12 or 24 hours).'] },
      { h: '2. Anonymity — what it means', p: ['Posting as Anonymous hides your name from other students. It does NOT hide your account from school administrators: they can see who wrote a post when needed to handle reports, safety issues or rule violations, and each lookup is recorded.'] },
      { h: '3. Rules', p: ['No harassment, bullying, hate speech, threats, doxxing, sexual content, spam, or false accusations. Do not share other people\'s personal information. Posts are limited to 500 characters.'] },
      { h: '4. Reporting and moderation', p: ['Any student can report a post. Administrators may approve, reject or remove posts and may restrict accounts that break these rules.'] },
      { h: '5. Your responsibility', p: ['You are responsible for what you post. By continuing you confirm that you have read and accept these terms.'] },
    ],
  },
};
