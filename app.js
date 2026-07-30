/* Solstice Health — client-side demo logic.
   All data lives in localStorage. There is no real backend or
   password security here — this is a front-end prototype only. */

const DB = {
  users: 'sh_users',
  session: 'sh_session',
  appointments: 'sh_appointments',
};

const DOCTORS = [
  { id: 'd1', name: 'Dr. Amara Chen', spec: 'Family Medicine', initials: 'AC' },
  { id: 'd2', name: 'Dr. Ravi Patel', spec: 'Cardiology', initials: 'RP' },
  { id: 'd3', name: 'Dr. Elena Ortiz', spec: 'Dermatology', initials: 'EO' },
  { id: 'd4', name: 'Dr. Sam Okafor', spec: 'Pediatrics', initials: 'SO' },
];

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}
function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

/* ---------------- Auth ---------------- */
function signUp(name, email, password) {
  const users = readJSON(DB.users, []);
  if (users.some(u => u.email === email)) {
    return { ok: false, error: 'An account with that email already exists.' };
  }
  const user = { id: 'u' + Date.now(), name, email, password };
  users.push(user);
  writeJSON(DB.users, users);
  writeJSON(DB.session, { userId: user.id });
  return { ok: true };
}

function signIn(email, password) {
  const users = readJSON(DB.users, []);
  const user = users.find(u => u.email === email && u.password === password);
  if (!user) return { ok: false, error: 'Email or password not recognized.' };
  writeJSON(DB.session, { userId: user.id });
  return { ok: true };
}

function currentUser() {
  const session = readJSON(DB.session, null);
  if (!session) return null;
  const users = readJSON(DB.users, []);
  return users.find(u => u.id === session.userId) || null;
}

function signOut() {
  localStorage.removeItem(DB.session);
  window.location.href = 'index.html';
}

function requireAuth() {
  const user = currentUser();
  if (!user) {
    window.location.href = 'index.html';
    return null;
  }
  return user;
}

function initials(name) {
  return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
}

/* ---------------- Appointments ---------------- */
function getAppointments(userId) {
  const all = readJSON(DB.appointments, []);
  return all.filter(a => a.userId === userId);
}

function saveAppointment(appt) {
  const all = readJSON(DB.appointments, []);
  all.push(appt);
  writeJSON(DB.appointments, all);
}

/* Deterministic "taken" slots so the dial looks alive without a backend */
function isSlotTaken(doctorId, dayOffset, slotIndex) {
  const seed = doctorId.charCodeAt(1) + dayOffset * 7 + slotIndex * 3;
  return seed % 5 === 0;
}

function formatDay(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d;
}

function dayLabel(offset) {
  const d = formatDay(offset);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

/* ---------------- Radial time dial ---------------- */
/* Renders clinic hours 9:00–17:00 (30 min slots) as dots around a
   clock face. Morning sits on the left arc, afternoon on the right,
   echoing a sundial reading left-to-right across the day. */
function buildDial(svgEl, doctorId, dayOffset, onSelect) {
  const size = 300;
  const cx = size / 2, cy = size / 2;
  const outerR = 118, dotR = 7;
  const startHour = 9, endHour = 17, stepMin = 30;
  const totalSlots = ((endHour - startHour) * 60) / stepMin;

  svgEl.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svgEl.innerHTML = '';

  const ns = 'http://www.w3.org/2000/svg';
  const face = document.createElementNS(ns, 'circle');
  face.setAttribute('cx', cx); face.setAttribute('cy', cy); face.setAttribute('r', outerR + 20);
  face.setAttribute('fill', '#fff');
  face.setAttribute('stroke', '#CBD8CE');
  svgEl.appendChild(face);

  const centerLabel = document.createElementNS(ns, 'text');
  centerLabel.setAttribute('x', cx); centerLabel.setAttribute('y', cy - 4);
  centerLabel.setAttribute('text-anchor', 'middle');
  centerLabel.setAttribute('font-family', 'Fraunces, serif');
  centerLabel.setAttribute('font-size', '15');
  centerLabel.setAttribute('fill', '#16302B');
  centerLabel.textContent = dayLabel(dayOffset);
  svgEl.appendChild(centerLabel);

  const centerSub = document.createElementNS(ns, 'text');
  centerSub.setAttribute('x', cx); centerSub.setAttribute('y', cy + 16);
  centerSub.setAttribute('text-anchor', 'middle');
  centerSub.setAttribute('font-family', 'IBM Plex Mono, monospace');
  centerSub.setAttribute('font-size', '10');
  centerSub.setAttribute('fill', '#6C7D78');
  centerSub.textContent = '9:00 \u2014 17:00';
  svgEl.appendChild(centerSub);

  for (let i = 0; i < totalSlots; i++) {
    const angle = (i / totalSlots) * Math.PI * 2 - Math.PI / 2;
    const x = cx + outerR * Math.cos(angle);
    const y = cy + outerR * Math.sin(angle);
    const minutesFromStart = i * stepMin;
    const hour = startHour + Math.floor(minutesFromStart / 60);
    const min = minutesFromStart % 60;
    const label = `${hour % 12 === 0 ? 12 : hour % 12}:${min === 0 ? '00' : min} ${hour < 12 ? 'AM' : 'PM'}`;
    const taken = isSlotTaken(doctorId, dayOffset, i);

    const g = document.createElementNS(ns, 'g');
    g.setAttribute('class', 'slot-dot' + (taken ? ' taken' : ''));
    g.setAttribute('data-index', i);
    g.setAttribute('data-label', label);

    const outer = document.createElementNS(ns, 'circle');
    outer.setAttribute('cx', x); outer.setAttribute('cy', y);
    outer.setAttribute('r', dotR);
    outer.setAttribute('class', 'slot-outer');
    outer.setAttribute('fill', taken ? '#E3E8E4' : '#4C7A63');
    outer.setAttribute('stroke', taken ? '#CBD8CE' : '#1F4A3E');
    outer.setAttribute('stroke-width', '1.5');
    g.appendChild(outer);

    if (!taken) {
      g.addEventListener('click', () => onSelect(i, label, g));
    }

    const title = document.createElementNS(ns, 'title');
    title.textContent = taken ? `${label} — booked` : `${label} — available`;
    g.appendChild(title);

    svgEl.appendChild(g);

    // Hour tick labels every hour
    if (minutesFromStart % 60 === 0) {
      const lx = cx + (outerR + 22) * Math.cos(angle);
      const ly = cy + (outerR + 22) * Math.sin(angle) + 4;
      const t = document.createElementNS(ns, 'text');
      t.setAttribute('x', lx); t.setAttribute('y', ly);
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('font-family', 'IBM Plex Mono, monospace');
      t.setAttribute('font-size', '9');
      t.setAttribute('fill', '#6C7D78');
      t.textContent = hour % 12 === 0 ? 12 : hour % 12;
      svgEl.appendChild(t);
    }
  }
}

/* ---------------- ICS export ---------------- */
function downloadICS(appt) {
  const start = new Date(appt.isoDate);
  const end = new Date(start.getTime() + 30 * 60000);
  const fmt = d => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT',
    `UID:${appt.id}@solsticehealth.demo`,
    `DTSTART:${fmt(start)}`, `DTEND:${fmt(end)}`,
    `SUMMARY:Appointment with ${appt.doctorName}`,
    `DESCRIPTION:${appt.spec} visit booked via Solstice Health.`,
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  const blob = new Blob([ics], { type: 'text/calendar' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'appointment.ics';
  a.click();
  URL.revokeObjectURL(url);
}
