const express  = require('express');
const path     = require('path');
const multer   = require('multer');
const fs       = require('fs');
const session  = require('express-session');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Change this password to whatever you want ──
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'shraddha2024';

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'mehndi-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// ── Auth middleware ──
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  res.redirect('/admin/login?next=' + encodeURIComponent(req.originalUrl));
}

// ── Multer setup ──
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const p = path.join(__dirname, 'public/images/gallery');
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
    cb(null, p);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname));
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// ── Helpers ──
function getGalleryImages() {
  const p = path.join(__dirname, 'public/images/gallery');
  if (!fs.existsSync(p)) return [];
  return fs.readdirSync(p)
    .filter(f => /\.(jpg|jpeg|png|webp|gif)$/i.test(f))
    .map(f => ({ filename: f, url: `/images/gallery/${f}` }));
}

function getMessages() {
  const p = path.join(__dirname, 'data/messages.json');
  if (!fs.existsSync(p)) return [];
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return []; }
}

function saveMessage(msg) {
  const dir = path.join(__dirname, 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  const p = path.join(dir, 'messages.json');
  const msgs = getMessages();
  msgs.unshift({ ...msg, id: Date.now(), date: new Date().toISOString(), read: false });
  fs.writeFileSync(p, JSON.stringify(msgs, null, 2));
}

const ARTIST = "Shraddha's Mehndi";

// ── Public routes ──
app.get('/', (req, res) => {
  res.render('index', {
    images: getGalleryImages().slice(0, 6),
    artistName: ARTIST,
    isAdmin: !!req.session.isAdmin
  });
});

app.get('/gallery', (req, res) => {
  res.render('gallery', {
    images: getGalleryImages(),
    artistName: ARTIST,
    isAdmin: !!req.session.isAdmin
  });
});

app.get('/about', (req, res) =>
  res.render('about', { artistName: ARTIST, isAdmin: !!req.session.isAdmin })
);

app.get('/contact', (req, res) =>
  res.render('contact', { artistName: ARTIST, isAdmin: !!req.session.isAdmin, success: false })
);

app.post('/contact', (req, res) => {
  const { name, phone, email, occasion, message } = req.body;
  if (name && (phone || email)) {
    saveMessage({ name, phone, email, occasion, message });
  }
  res.render('contact', { artistName: ARTIST, isAdmin: !!req.session.isAdmin, success: true });
});

// ── Admin-only: upload ──
app.get('/upload', requireAdmin, (req, res) =>
  res.render('upload', { message: null, artistName: ARTIST, isAdmin: true })
);

app.post('/upload', requireAdmin, upload.array('designs', 20), (req, res) =>
  res.render('upload', {
    message: `✅ ${req.files.length} design(s) uploaded successfully!`,
    artistName: ARTIST,
    isAdmin: true
  })
);

// ── Admin-only: delete image ──
app.delete('/gallery/:filename', requireAdmin, (req, res) => {
  const filePath = path.join(__dirname, 'public/images/gallery', req.params.filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

// ── Admin login ──
app.get('/admin/login', (req, res) => {
  if (req.session && req.session.isAdmin) return res.redirect('/upload');
  res.render('login', { artistName: ARTIST, error: null });
});

app.post('/admin/login', (req, res) => {
  if (req.body.password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    const next = req.query.next || '/upload';
    res.redirect(next);
  } else {
    res.render('login', { artistName: ARTIST, error: 'Wrong password. Try again.' });
  }
});

app.get('/admin/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// ── Admin: view messages ──
app.get('/admin/messages', requireAdmin, (req, res) => {
  const msgs = getMessages();
  // Mark all as read
  msgs.forEach(m => m.read = true);
  const dir = path.join(__dirname, 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, 'messages.json'), JSON.stringify(msgs, null, 2));
  res.render('admin-messages', { artistName: ARTIST, messages: msgs, isAdmin: true });
});

// ── Admin: delete message ──
app.delete('/admin/messages/:id', requireAdmin, (req, res) => {
  const msgs = getMessages().filter(m => String(m.id) !== String(req.params.id));
  fs.writeFileSync(path.join(__dirname, 'data/messages.json'), JSON.stringify(msgs, null, 2));
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`🌿 Mehndi Portfolio → http://localhost:${PORT}`);
  console.log(`🔑 Admin password : ${ADMIN_PASSWORD}`);
  console.log(`📬 Admin login    : http://localhost:${PORT}/admin/login`);
});
