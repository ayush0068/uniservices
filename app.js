require('dotenv').config();

const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const express    = require('express');
const mongoose   = require('mongoose');
const session    = require('express-session');
const nodemailer = require('nodemailer');
const path       = require('path');
const port       = process.env.PORT || 6060;

const app = express();

/* ── View engine ── */
app.set('view engine', 'ejs');

/* ── Static & parsers ── */
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ── Session ── */
app.use(session({
  secret: process.env.SESSION_SECRET || 'uni-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 1000 * 60 * 60 * 8 }
}));

/* ══════════════════════════════════════
   MONGODB
══════════════════════════════════════ */
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB error:', err));

/* ── Contact Schema ── */
const contactSchema = new mongoose.Schema({
  name:         { type: String, required: true, trim: true },
  email:        { type: String, required: true, lowercase: true },
  subject:      { type: String, required: true },
  message:      { type: String, required: true, minlength: 20 },
  status:       { type: String, enum: ['new', 'read', 'replied'], default: 'new' },
  repliedAt:    { type: Date },
  replyMessage: { type: String }
}, { timestamps: true });

const Contact = mongoose.model('Contact', contactSchema);



/* ══════════════════════════════════════
   SERVICE SCHEMA — Contact Schema ke baad add karo
══════════════════════════════════════ */
const serviceSchema = new mongoose.Schema({
  slug:        { type: String, required: true, unique: true }, // unicare, unishow, unispace, custom-1
  name:        { type: String, required: true },               // UniCare+
  tagline:     { type: String },                               // Health & Wellness
  description: { type: String },                               // Card description
  icon:        { type: String, default: '⬡' },                 // emoji
  href:        { type: String, required: true },               // /unicare or external URL
  external:    { type: Boolean, default: false },              // open in new tab?
  badgeText:   { type: String },                               // "Health & Wellness"
  badgeClass:  { type: String, default: 'badge-cyan' },        // CSS class
  accentClass: { type: String, default: 'card-unicare' },      // card CSS class
  iconClass:   { type: String, default: 'icon-cyan' },         // icon bg CSS class
  linkClass:   { type: String, default: 'link-cyan' },         // link CSS class
  dotClass:    { type: String, default: 'dot-cyan' },          // dot CSS class
  features:    [{ type: String }],                             // feature bullets
  enabled:     { type: Boolean, default: true },
  order:       { type: Number, default: 0 }
}, { timestamps: true });

const Service = mongoose.model('Service', serviceSchema);

/* ── Default services seed (agar DB empty ho) ── */
async function seedServices() {
  const count = await Service.countDocuments();
  if (count > 0) return;
  await Service.insertMany([
    {
      slug: 'unicare', name: 'UniCare+', tagline: 'Health & Wellness',
      description: 'Connect with certified doctors, specialists, and mental health professionals from anywhere — anytime. Instant consultations, prescriptions, and health records in one secure place.',
      icon: '🩺', href: '/unicare', external: false,
      badgeText: 'Health & Wellness', badgeClass: 'badge-cyan',
      accentClass: 'card-unicare', iconClass: 'icon-cyan',
      linkClass: 'link-cyan', dotClass: 'dot-cyan',
      features: ['Instant video consultations', '500+ verified specialists', 'Digital prescriptions & reports'],
      enabled: true, order: 1
    },
    {
      slug: 'unishow', name: 'UniShow', tagline: 'Entertainment',
      description: 'Book movie and event tickets effortlessly. Browse showtimes, choose your seats with a live seat map, and get instant e-tickets — no queues, no hassle.',
      icon: '🎬', href: '/unishow', external: false,
      badgeText: 'Entertainment', badgeClass: 'badge-amber',
      accentClass: 'card-unishow', iconClass: 'icon-amber',
      linkClass: 'link-amber', dotClass: 'dot-amber',
      features: ['Live seat selection', '1000+ cinemas & theatres', 'Instant e-ticket delivery'],
      enabled: true, order: 2
    },
    {
      slug: 'unispace', name: 'UniSpace', tagline: 'Cloud Storage',
      description: 'Enterprise-grade secure cloud storage for individuals and teams. Zero-knowledge encryption, real-time sync, and smart file management — your data, only yours.',
      icon: '☁️', href: 'https://unispace-z8bd.onrender.com/', external: true,
      badgeText: 'Cloud Storage', badgeClass: 'badge-emerald',
      accentClass: 'card-unispace', iconClass: 'icon-emerald',
      linkClass: 'link-emerald', dotClass: 'dot-emerald',
      features: ['End-to-end encryption', 'Real-time multi-device sync', 'Up to 2 TB storage'],
      enabled: true, order: 3
    }
  ]);
  console.log('✅ Default services seeded');
}

/* Seed karo jab MongoDB connect ho */
mongoose.connection.once('open', seedServices);

/* ══════════════════════════════════════
   SERVICE API ROUTES — Admin routes ke saath add karo
══════════════════════════════════════ */

/* GET all services (public — index page ke liye) */
app.get('/api/services', async (req, res) => {
  try {
    const services = await Service.find({ enabled: true }).sort({ order: 1 });
    res.json({ success: true, services });
  } catch (err) {
    res.json({ success: false, message: 'Server error' });
  }
});

/* GET all services for admin (enabled + disabled) */
app.get('/api/admin/services', requireAdmin, async (req, res) => {
  try {
    const services = await Service.find().sort({ order: 1 });
    res.json({ success: true, services });
  } catch (err) {
    res.json({ success: false, message: 'Server error' });
  }
});

/* POST — new service add karo */
app.post('/api/admin/services', requireAdmin, async (req, res) => {
  try {
    const service = new Service(req.body);
    await service.save();
    res.json({ success: true, service });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: err.message || 'Failed to create service' });
  }
});

/* PATCH — service update karo */
app.patch('/api/admin/services/:id', requireAdmin, async (req, res) => {
  try {
    const service = await Service.findByIdAndUpdate(
      req.params.id, req.body, { new: true, runValidators: true }
    );
    if (!service) return res.json({ success: false, message: 'Service not found' });
    res.json({ success: true, service });
  } catch (err) {
    res.json({ success: false, message: err.message || 'Failed to update' });
  }
});

/* DELETE — service delete karo */
app.delete('/api/admin/services/:id', requireAdmin, async (req, res) => {
  try {
    await Service.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, message: 'Server error' });
  }
});

/* PATCH — toggle enable/disable */
app.patch('/api/admin/services/:id/toggle', requireAdmin, async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) return res.json({ success: false, message: 'Not found' });
    service.enabled = !service.enabled;
    await service.save();
    res.json({ success: true, enabled: service.enabled });
  } catch (err) {
    res.json({ success: false, message: 'Server error' });
  }
});

/* ── Settings Schema ── */
const settingsSchema = new mongoose.Schema({
  key:   { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed }
});
const Setting = mongoose.model('Setting', settingsSchema);



/* ── Default settings ── */
const DEFAULTS = {
  siteName:      'UNI-SERVICES',
  footerTagline: 'A next-generation multi-service digital ecosystem. Healthcare, entertainment, and storage — reimagined.',
  copyrightYear: '2025',
  publicEmail:   'uniservices013@gmail.com',
  publicPhone:   '+91 8931878476',
  address:       'Prayagraj, Uttar Pradesh, India',
  supportHours:  '24 / 7 · 365 days a year',
  notifEmail:    'uniservices013@gmail.com',
  notifContact:  true,
  maintenance:   false,
  svc_unicare:   true,
  svc_unishow:   true,
  svc_unispace:  true,
  contactForm:   true,
  consentBanner: true,
  searchIndex:   true,
  metaDesc:      'UNI-SERVICES — A premium multi-service digital ecosystem. Explore UniCare+, UniShow, and UniSpace in one unified portal.',
};

/* ── Get all settings merged with defaults ── */
async function getSettings() {
  try {
    const docs = await Setting.find({});
    const result = { ...DEFAULTS };
    docs.forEach(d => result[d.key] = d.value);
    return result;
  } catch {
    return { ...DEFAULTS };
  }
}

/* ── Nodemailer transporter ── */
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  },
  tls: { rejectUnauthorized: false },
  family: 4,
  connectionTimeout: 10000
});

/* ══════════════════════════════════════
   MIDDLEWARE
══════════════════════════════════════ */

/* ── Settings available on every page ── */
app.use(async (req, res, next) => {
  res.locals.settings = await getSettings();
  next();
});

/* ── Maintenance mode ── */
app.use((req, res, next) => {
  const bypass = req.path.startsWith('/admin') ||
                 req.path.startsWith('/api')   ||
                 req.path.startsWith('/coming-soon');
  if (res.locals.settings.maintenance && !bypass) {
    return res.render('coming-soon', { title: 'Coming Soon' });
  }
  next();
});

/* ── Admin Auth Guard ── */
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.redirect('/admin/login');
}

/* ══════════════════════════════════════
   PUBLIC ROUTES
══════════════════════════════════════ */
app.get('/', async (req, res) => {
  const services = await Service.find({ enabled: true }).sort({ order: 1 });
  res.render('index', { title: 'Home', services });
});

app.get('/about', (req, res) => res.render('about', { title: 'About' }));

app.get('/contact', (req, res) => {
  if (!res.locals.settings.contactForm) {
    return res.render('coming-soon', { title: 'Contact Unavailable' });
  }
  res.render('contact', { title: 'Contact' });
});

app.get('/unicare', (req, res) => {
  if (!res.locals.settings.svc_unicare)
    return res.render('coming-soon', { title: 'UniCare+' });
  res.render('unicare-coming-soon', { title: 'UniCare+' });
});

app.get('/unishow', (req, res) => {
  if (!res.locals.settings.svc_unishow)
    return res.render('coming-soon', { title: 'UniShow' });
  res.render('unishow-coming-soon', { title: 'UniShow' });
});

app.get('/unispace', (req, res) => {
  if (!res.locals.settings.svc_unispace)
    return res.render('coming-soon', { title: 'UniSpace' });
  res.render('unispace-coming-soon', { title: 'UniSpace' });
});

app.get('/coming-soon', (req, res) => res.render('coming-soon', { title: 'UniServices' }));
app.get('/privacy',     (req, res) => res.render('privacy',     { title: 'Privacy Policy' }));
app.get('/terms',       (req, res) => res.render('terms',       { title: 'Terms of Service' }));

/* ── POST Contact Form ── */
app.post('/contact', async (req, res) => {
  try {
    const s = res.locals.settings;

    if (!s.contactForm)
      return res.json({ success: false, message: 'Contact form is currently disabled.' });

    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message)
      return res.json({ success: false, message: 'All fields required' });

    await new Contact({ name, email, subject, message }).save();

    /* ── Notify admin if enabled ── */
    if (s.notifContact && s.notifEmail) {
      try {
        await transporter.sendMail({
          from: `"UNI-SERVICES" <${process.env.GMAIL_USER}>`,
          to: s.notifEmail,
          subject: `📬 New Contact: ${name} — ${subject}`,
          html: `
            <div style="font-family:Arial;padding:24px;max-width:520px">
              <h2 style="color:#2d4a3e">New Contact Form Submission</h2>
              <table style="width:100%;font-size:14px;border-collapse:collapse">
                <tr><td style="padding:6px 0;color:#888;width:100px">Name</td><td><strong>${name}</strong></td></tr>
                <tr><td style="padding:6px 0;color:#888">Email</td><td><a href="mailto:${email}">${email}</a></td></tr>
                <tr><td style="padding:6px 0;color:#888">Subject</td><td>${subject}</td></tr>
                <tr><td style="padding:6px 0;color:#888;vertical-align:top">Message</td><td>${message}</td></tr>
              </table>
              <div style="margin-top:20px">
                <a href="${process.env.SITE_URL || 'http://localhost:' + port}/admin" 
                   style="background:#2d4a3e;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:13px">
                  View in Dashboard →
                </a>
              </div>
            </div>
          `
        });
      } catch (mailErr) {
        console.error('Admin notification failed:', mailErr.message);
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: 'Server error' });
  }
});

/* ══════════════════════════════════════
   ADMIN LOGIN
══════════════════════════════════════ */
app.get('/admin/login', (req, res) => {
  if (req.session.isAdmin) return res.redirect('/admin');
  res.render('admin-login', { title: 'Admin Login', error: null });
});

app.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.redirect('/admin');
  }
  res.render('admin-login', { title: 'Admin Login', error: 'Invalid username or password.' });
});

app.get('/admin/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

/* ══════════════════════════════════════
   ADMIN DASHBOARD
══════════════════════════════════════ */
app.get('/admin', requireAdmin, (req, res) => {
  res.render('admin', { title: 'Admin Dashboard' });
});

/* ── GET all contacts ── */
app.get('/api/admin/contacts', requireAdmin, async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 });
    res.json({ success: true, contacts });
  } catch (err) {
    res.json({ success: false, message: 'Server error' });
  }
});

/* ── PATCH status ── */
app.patch('/api/admin/contacts/:id/status', requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['new', 'read', 'replied'].includes(status))
      return res.json({ success: false, message: 'Invalid status' });
    const contact = await Contact.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!contact) return res.json({ success: false, message: 'Not found' });
    res.json({ success: true, contact });
  } catch (err) {
    res.json({ success: false, message: 'Server error' });
  }
});


/* ── DELETE all contacts (danger zone) ── */
app.delete('/api/admin/contacts/clear-all', requireAdmin, async (req, res) => {
  try {
    await Contact.deleteMany({});
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, message: 'Server error' });
  }
});

/* ── DELETE contact ── */
app.delete('/api/admin/contacts/:id', requireAdmin, async (req, res) => {
  try {
    await Contact.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, message: 'Server error' });
  }
});



/* ── GET stats ── */
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  try {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const weekStart  = new Date(Date.now() - 7 * 864e5);
    const [total, today, week, pending, unicare, unishow, unispace] = await Promise.all([
      Contact.countDocuments(),
      Contact.countDocuments({ createdAt: { $gte: todayStart } }),
      Contact.countDocuments({ createdAt: { $gte: weekStart } }),
      Contact.countDocuments({ status: 'new' }),
      Contact.countDocuments({ subject: 'unicare' }),
      Contact.countDocuments({ subject: 'unishow' }),
      Contact.countDocuments({ subject: 'unispace' })
    ]);
    res.json({ success: true, total, today, week, pending, unicare, unishow, unispace });
  } catch (err) {
    res.json({ success: false, message: 'Server error' });
  }
});

/* ── REPLY API ── */
app.post('/api/admin/contacts/:id/reply', requireAdmin, async (req, res) => {
  try {
    const { replyMessage, replySubject } = req.body;
    if (!replyMessage?.trim())
      return res.json({ success: false, message: 'Reply message cannot be empty.' });

    const contact = await Contact.findById(req.params.id);
    if (!contact) return res.json({ success: false, message: 'Contact not found.' });

    const subjectLabels = {
      general: 'General Enquiry', unicare: 'UniCare+ Support',
      unishow: 'UniShow Ticketing', unispace: 'UniSpace Storage',
      partnership: 'Partnership / B2B', press: 'Press & Media', careers: 'Careers'
    };
    const topicLabel   = subjectLabels[contact.subject] || contact.subject;
    const emailSubject = replySubject || `Re: ${topicLabel} — UNI-SERVICES`;

    const htmlBody = `
<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f4f2ef;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr><td style="background:#2d4a3e;padding:28px 36px;">
          <div style="font-family:Georgia,serif;font-size:1.3rem;font-weight:700;color:#fff;">UNI-SERVICES</div>
          <div style="font-size:0.75rem;color:rgba(255,255,255,0.6);margin-top:4px;letter-spacing:0.08em;text-transform:uppercase;">Admin Reply</div>
        </td></tr>
        <tr><td style="padding:36px;">
          <p style="font-size:0.95rem;color:#1a1a18;margin:0 0 8px;">Hi <strong>${contact.name.split(' ')[0]}</strong>,</p>
          <p style="font-size:0.88rem;color:#5a5a54;margin:0 0 24px;">Thank you for reaching out regarding <strong>${topicLabel}</strong>.</p>
          <div style="background:#f4f2ef;border-left:3px solid #2d4a3e;border-radius:0 8px 8px 0;padding:18px 20px;margin-bottom:24px;">
            <div style="font-size:0.75rem;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#9a9a92;margin-bottom:8px;">Our Reply</div>
            <div style="font-size:0.92rem;color:#1a1a18;line-height:1.75;white-space:pre-wrap;">${replyMessage.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
          </div>
          <div style="background:#faf9f7;border:1px solid rgba(0,0,0,0.08);border-radius:8px;padding:14px 16px;margin-bottom:24px;">
            <div style="font-size:0.72rem;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#9a9a92;margin-bottom:6px;">Your Original Message</div>
            <div style="font-size:0.82rem;color:#9a9a92;line-height:1.65;">${contact.message.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
          </div>
          <p style="font-size:0.85rem;color:#5a5a54;margin:0;">Questions? Reply to this email or contact <a href="mailto:${process.env.GMAIL_USER}" style="color:#2d4a3e;">${process.env.GMAIL_USER}</a></p>
        </td></tr>
        <tr><td style="background:#f4f2ef;padding:20px 36px;border-top:1px solid rgba(0,0,0,0.07);">
          <div style="font-size:0.75rem;color:#9a9a92;text-align:center;">© ${new Date().getFullYear()} UNI-SERVICES · Prayagraj, Uttar Pradesh, India</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

    await transporter.sendMail({
      from: `"UNI-SERVICES" <${process.env.GMAIL_USER}>`,
      to: contact.email,
      subject: emailSubject,
      html: htmlBody,
      replyTo: process.env.GMAIL_USER
    });

    contact.status = 'replied';
    contact.repliedAt = new Date();
    contact.replyMessage = replyMessage;
    await contact.save();

    res.json({ success: true, message: `Reply sent to ${contact.email}` });
  } catch (err) {
    console.error('Reply error:', err);
    res.json({ success: false, message: 'Failed to send email. Check Gmail credentials.' });
  }
});

/* ══════════════════════════════════════
   SETTINGS API
══════════════════════════════════════ */

/* ── GET settings ── */
app.get('/api/admin/settings', requireAdmin, async (req, res) => {
  try {
    const settings = await getSettings();
    res.json({ success: true, settings });
  } catch (err) {
    res.json({ success: false, message: 'Server error' });
  }
});

/* ── SAVE settings ── */
app.post('/api/admin/settings', requireAdmin, async (req, res) => {
  try {
    const entries = Object.entries(req.body);
    await Promise.all(entries.map(([key, value]) =>
      Setting.findOneAndUpdate({ key }, { value }, { upsert: true, new: true })
    ));
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: 'Failed to save settings' });
  }
});

/* ── RESET settings ── */
app.delete('/api/admin/settings', requireAdmin, async (req, res) => {
  try {
    await Setting.deleteMany({});
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, message: 'Server error' });
  }
});

/* ── Start Server ── */
app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});