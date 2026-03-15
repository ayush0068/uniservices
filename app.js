require('dotenv').config();
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

/* ── MongoDB ── */
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB error:', err));

/* ── Contact Schema ── */
const contactSchema = new mongoose.Schema({
  name:    { type: String, required: true, trim: true },
  email:   { type: String, required: true, lowercase: true },
  subject: { type: String, required: true },
  message: { type: String, required: true, minlength: 20 },
  status:  { type: String, enum: ['new', 'read', 'replied'], default: 'new' },
  repliedAt: { type: Date },
  replyMessage: { type: String }
}, { timestamps: true });

const Contact = mongoose.model('Contact', contactSchema);

/* ── Nodemailer transporter ── */
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  },
  family: 4
});

/* ── Admin Auth Guard ── */
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.redirect('/admin/login');
}

/* ══════════════════════════════════════
   PUBLIC ROUTES
══════════════════════════════════════ */
app.get('/',            (req, res) => res.render('index',                { title: 'Home' }));
app.get('/about',       (req, res) => res.render('about',                { title: 'About' }));
app.get('/contact',     (req, res) => res.render('contact',              { title: 'Contact' }));
app.get('/unicare',     (req, res) => res.render('unicare-coming-soon',  { title: 'UniCare+' }));
app.get('/unishow',     (req, res) => res.render('unishow-coming-soon',  { title: 'UniShow' }));
app.get('/unispace',    (req, res) => res.render('unispace-coming-soon', { title: 'UniSpace' }));
app.get('/coming-soon', (req, res) => res.render('coming-soon',          { title: 'UniServices' }));
app.get('/privacy', (req, res) => res.render('privacy', { title: 'Privacy Policy' }));
app.get('/terms',   (req, res) => res.render('terms',   { title: 'Terms of Service' }));

/* ── POST Contact Form ── */
app.post('/contact', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !subject || !message)
      return res.json({ success: false, message: 'All fields required' });
    await new Contact({ name, email, subject, message }).save();
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
  req.session.destroy(() => res.redirect('/'));
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

/* ══════════════════════════════════════
   REPLY API — Email bhejo + status update
══════════════════════════════════════ */
app.post('/api/admin/contacts/:id/reply', requireAdmin, async (req, res) => {
  try {
    const { replyMessage, replySubject } = req.body;

    if (!replyMessage || !replyMessage.trim())
      return res.json({ success: false, message: 'Reply message cannot be empty.' });

    const contact = await Contact.findById(req.params.id);
    if (!contact) return res.json({ success: false, message: 'Contact not found.' });

    /* ── Build email ── */
    const subjectLabels = {
      general: 'General Enquiry', unicare: 'UniCare+ Support',
      unishow: 'UniShow Ticketing', unispace: 'UniSpace Storage',
      partnership: 'Partnership / B2B', press: 'Press & Media', careers: 'Careers'
    };
    const topicLabel = subjectLabels[contact.subject] || contact.subject;
    const emailSubject = replySubject || `Re: ${topicLabel} — UNI-SERVICES`;

    const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f4f2ef;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f2ef;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:#2d4a3e;padding:28px 36px;">
            <div style="font-family:Georgia,serif;font-size:1.3rem;font-weight:700;color:#ffffff;letter-spacing:0.04em;">UNI-SERVICES</div>
            <div style="font-size:0.75rem;color:rgba(255,255,255,0.6);margin-top:4px;letter-spacing:0.08em;text-transform:uppercase;">Admin Reply</div>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px;">
            <p style="font-size:0.95rem;color:#1a1a18;margin:0 0 8px;">Hi <strong>${contact.name.split(' ')[0]}</strong>,</p>
            <p style="font-size:0.88rem;color:#5a5a54;margin:0 0 24px;">Thank you for reaching out to UNI-SERVICES regarding <strong>${topicLabel}</strong>.</p>

            <div style="background:#f4f2ef;border-left:3px solid #2d4a3e;border-radius:0 8px 8px 0;padding:18px 20px;margin-bottom:24px;">
              <div style="font-size:0.75rem;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#9a9a92;margin-bottom:8px;">Our Reply</div>
              <div style="font-size:0.92rem;color:#1a1a18;line-height:1.75;white-space:pre-wrap;">${replyMessage.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
            </div>

            <div style="background:#faf9f7;border:1px solid rgba(0,0,0,0.08);border-radius:8px;padding:14px 16px;margin-bottom:24px;">
              <div style="font-size:0.72rem;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#9a9a92;margin-bottom:6px;">Your Original Message</div>
              <div style="font-size:0.82rem;color:#9a9a92;line-height:1.65;">${contact.message.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
            </div>

            <p style="font-size:0.85rem;color:#5a5a54;margin:0;">If you have further questions, feel free to reply to this email or contact us at <a href="mailto:${process.env.GMAIL_USER}" style="color:#2d4a3e;">${process.env.GMAIL_USER}</a></p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f4f2ef;padding:20px 36px;border-top:1px solid rgba(0,0,0,0.07);">
            <div style="font-size:0.75rem;color:#9a9a92;text-align:center;">© ${new Date().getFullYear()} UNI-SERVICES · Prayagraj, Uttar Pradesh, India</div>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    /* ── Send email ── */
    await transporter.sendMail({
      from: process.env.GMAIL_USER,       
      to: contact.email,
      subject: emailSubject,
      html: htmlBody,
      replyTo: process.env.GMAIL_USER
    });

    /* ── Update status in DB ── */
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

/* ── Start ── */
app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});