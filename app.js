require('dotenv').config();
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcryptjs');
const port = process.env.PORT || 6060;

const app = express();

// Set EJS as the templating engine
app.set('view engine', 'ejs');

// Serve static assets from 'public' and 'uploads' folders
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Parse JSON and form data (URL-encoded)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB, Above link is active now !'))
  .catch(err => console.error('MongoDB connection error:', err));

// ============ SESSION CONFIGURATION ============
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-this',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    ttl: 24 * 60 * 60 // 1 day
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 // 24 hours
  }
}));

// ============ MIDDLEWARE ============
const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.adminId) {
    return next();
  }
  res.redirect('/admin-login');
};

const hasRole = (roles) => {
  return (req, res, next) => {
    if (!req.session.adminId) {
      return res.redirect('/admin-login');
    }
    if (roles.includes(req.session.adminRole)) {
      return next();
    }
    res.status(403).render('403', { 
      title: 'Access Denied',
      session: req.session 
    });
  };
};

// ============ MODELS ============

// Contact Schema
const contactSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true
  },
  subject: {
    type: String,
    required: true,
    enum: ['general', 'unicare', 'unishow', 'unispace', 'partnership', 'press', 'careers']
  },
  message: {
    type: String,
    required: true,
    minlength: 20
  },
  status: {
    type: String,
    enum: ['new', 'read', 'replied', 'archived'],
    default: 'new'
  },
  notes: {
    type: String,
    default: ''
  },
  ipAddress: String,
  userAgent: String
}, { timestamps: true });

const Contact = mongoose.model('Contact', contactSchema);

// Admin User Schema
const adminUserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  fullName: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['super_admin', 'admin', 'moderator'],
    default: 'admin'
  },
  avatar: String,
  lastLogin: Date,
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

const Admin = mongoose.model('Admin', adminUserSchema);

// Activity Log Schema
const activityLogSchema = new mongoose.Schema({
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  },
  action: {
    type: String,
    required: true
  },
  details: mongoose.Schema.Types.Mixed,
  ipAddress: String,
  userAgent: String
}, { timestamps: true });

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);

// Service Plan Schema
const planSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  service: {
    type: String,
    enum: ['unicare', 'unishow', 'unispace', 'all'],
    required: true
  },
  price: {
    amount: Number,
    currency: {
      type: String,
      default: 'INR'
    },
    interval: {
      type: String,
      enum: ['monthly', 'yearly', 'one-time'],
      default: 'monthly'
    }
  },
  features: [String],
  isPopular: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  maxUsers: Number,
  storage: String,
  support: String
}, { timestamps: true });

const Plan = mongoose.model('Plan', planSchema);

// ============ PUBLIC ROUTES ============

// POST Contact
app.post("/contact", async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
      return res.json({ success: false, message: "All fields required" });
    }

    const newContact = new Contact({
      name,
      email,
      subject,
      message,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    await newContact.save();

    res.json({ success: true });

  } catch (error) {
    console.error(error);
    res.json({ success: false, message: "Server error" });
  }
});

// Routes
app.get('/', (req, res) => res.render('index', { title: 'Home', session: req.session }));
app.get('/about', (req, res) => res.render('about', { title: 'About', session: req.session }));
app.get('/contact', (req, res) => res.render('contact', { title: 'Contact', session: req.session }));
app.get('/unicare', (req, res) => res.render('unicare-coming-soon', { title: 'UniCare+', session: req.session }));
app.get('/unishow', (req, res) => res.render('unishow-coming-soon', { title: 'UniShow', session: req.session }));
app.get('/unispace', (req, res) => res.render('unispace-coming-soon', { title: 'UniSpace', session: req.session }));
app.get('/coming-soon', (req, res) => res.render('coming-soon', { title: 'UniServices', session: req.session }));


// ============ ADMIN ROUTES ============

// Login page
app.get('/admin-login', (req, res) => {
  if (req.session.adminId) {
    return res.redirect('/admin-dashboard');
  }
  res.render('admin-login', { 
    title: 'Admin Login',
    error: null,
    session: req.session 
  });
});

// Login post
app.post('/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const admin = await Admin.findOne({ 
      $or: [
        { username: username },
        { email: username }
      ]
    });
    
    if (!admin || !admin.isActive) {
      return res.render('admin-login', {
        title: 'Admin Login',
        error: 'Invalid credentials',
        session: req.session
      });
    }
    
    const isValid = await bcrypt.compare(password, admin.password);
    if (!isValid) {
      return res.render('admin-login', {
        title: 'Admin Login',
        error: 'Invalid credentials',
        session: req.session
      });
    }
    
    req.session.adminId = admin._id;
    req.session.adminUsername = admin.username;
    req.session.adminRole = admin.role;
    req.session.adminFullName = admin.fullName;
    
    admin.lastLogin = new Date();
    await admin.save();
    
    await ActivityLog.create({
      adminId: admin._id,
      action: 'LOGIN',
      details: 'Admin logged in',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.redirect('/admin-dashboard');
    
  } catch (error) {
    console.error('Login error:', error);
    res.render('admin-login', {
      title: 'Admin Login',
      error: 'Server error',
      session: req.session
    });
  }
});

// Logout
app.get('/admin-logout', isAuthenticated, async (req, res) => {
  await ActivityLog.create({
    adminId: req.session.adminId,
    action: 'LOGOUT',
    details: 'Admin logged out',
    ipAddress: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  req.session.destroy();
  res.redirect('/admin-login');
});

// Dashboard
app.get('/admin-dashboard', isAuthenticated, async (req, res) => {
  try {
    const totalContacts = await Contact.countDocuments();
    const newContacts = await Contact.countDocuments({ status: 'new' });
    const readContacts = await Contact.countDocuments({ status: 'read' });
    const repliedContacts = await Contact.countDocuments({ status: 'replied' });
    
    const recentContacts = await Contact.find()
      .sort({ createdAt: -1 })
      .limit(10);
    
    const subjectStats = await Contact.aggregate([
      { $group: { _id: '$subject', count: { $sum: 1 } } }
    ]);
    
    const recentActivity = await ActivityLog.find()
      .populate('adminId', 'username fullName')
      .sort({ createdAt: -1 })
      .limit(10);
    
    res.render('admin-dashboard', {
      title: 'Admin Dashboard',
      session: req.session,
      stats: {
        totalContacts,
        newContacts,
        readContacts,
        repliedContacts,
        subjectStats
      },
      recentContacts,
      recentActivity
    });
    
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).send('Server error');
  }
});

// Contacts list
app.get('/admin-contacts', isAuthenticated, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;
    const status = req.query.status || 'all';
    
    let query = {};
    if (status !== 'all') {
      query.status = status;
    }
    
    const contacts = await Contact.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Contact.countDocuments(query);
    
    res.render('admin-contacts', {
      title: 'Contact Submissions',
      session: req.session,
      contacts,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      currentStatus: status,
      total
    });
    
  } catch (error) {
    console.error('Contacts error:', error);
    res.status(500).send('Server error');
  }
});

// View single contact
app.get('/admin-contact/:id', isAuthenticated, async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);
    
    if (!contact) {
      return res.status(404).send('Contact not found');
    }
    
    if (contact.status === 'new') {
      contact.status = 'read';
      await contact.save();
    }
    
    res.render('admin-contact-detail', {
      title: 'Contact Details',
      session: req.session,
      contact
    });
    
  } catch (error) {
    console.error('Contact detail error:', error);
    res.status(500).send('Server error');
  }
});

// Update contact status
app.post('/admin/contact/:id/status', isAuthenticated, async (req, res) => {
  try {
    const { status, notes } = req.body;
    
    const contact = await Contact.findById(req.params.id);
    
    if (!contact) {
      return res.status(404).json({ success: false, error: 'Contact not found' });
    }
    
    contact.status = status || contact.status;
    if (notes !== undefined) contact.notes = notes;
    await contact.save();
    
    await ActivityLog.create({
      adminId: req.session.adminId,
      action: 'UPDATE_CONTACT_STATUS',
      details: `Updated contact ${contact.email} status to ${status}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.json({ success: true, contact });
    
  } catch (error) {
    console.error('Status update error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Delete contact
app.delete('/admin/contact/:id', isAuthenticated, hasRole(['super_admin', 'admin']), async (req, res) => {
  try {
    const contact = await Contact.findByIdAndDelete(req.params.id);
    
    await ActivityLog.create({
      adminId: req.session.adminId,
      action: 'DELETE_CONTACT',
      details: `Deleted contact from ${contact.email}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Plans list
app.get('/admin-plans', isAuthenticated, async (req, res) => {
  try {
    const plans = await Plan.find().sort({ service: 1, price: 1 });
    res.render('admin-plans', {
      title: 'Service Plans',
      session: req.session,
      plans
    });
  } catch (error) {
    console.error('Plans error:', error);
    res.status(500).send('Server error');
  }
});

// Create plan page
app.get('/admin/plans/new', isAuthenticated, hasRole(['super_admin', 'admin']), (req, res) => {
  res.render('admin-plan-form', {
    title: 'Create New Plan',
    session: req.session,
    plan: null
  });
});

// Create plan
app.post('/admin/plans', isAuthenticated, hasRole(['super_admin', 'admin']), async (req, res) => {
  try {
    const planData = req.body;
    
    if (typeof planData.features === 'string') {
      planData.features = planData.features.split(',').map(f => f.trim());
    }
    
    // Handle price object
    planData.price = {
      amount: parseFloat(planData.priceAmount),
      currency: planData.priceCurrency || 'INR',
      interval: planData.priceInterval || 'monthly'
    };
    
    const plan = new Plan(planData);
    await plan.save();
    
    await ActivityLog.create({
      adminId: req.session.adminId,
      action: 'CREATE_PLAN',
      details: `Created new plan: ${plan.name}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.redirect('/admin-plans');
    
  } catch (error) {
    console.error('Create plan error:', error);
    res.status(500).send('Server error');
  }
});

// Edit plan page
app.get('/admin/plan/:id/edit', isAuthenticated, hasRole(['super_admin', 'admin']), async (req, res) => {
  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan) {
      return res.status(404).send('Plan not found');
    }
    
    res.render('admin-plan-form', {
      title: 'Edit Plan',
      session: req.session,
      plan
    });
    
  } catch (error) {
    console.error('Edit plan error:', error);
    res.status(500).send('Server error');
  }
});

// Update plan
app.put('/admin/plan/:id', isAuthenticated, hasRole(['super_admin', 'admin']), async (req, res) => {
  try {
    const planData = req.body;
    
    if (typeof planData.features === 'string') {
      planData.features = planData.features.split(',').map(f => f.trim());
    }
    
    // Handle price object
    planData.price = {
      amount: parseFloat(planData.priceAmount),
      currency: planData.priceCurrency || 'INR',
      interval: planData.priceInterval || 'monthly'
    };
    
    const plan = await Plan.findByIdAndUpdate(
      req.params.id,
      planData,
      { new: true }
    );
    
    await ActivityLog.create({
      adminId: req.session.adminId,
      action: 'UPDATE_PLAN',
      details: `Updated plan: ${plan.name}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.json({ success: true, plan });
    
  } catch (error) {
    console.error('Update plan error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Delete plan
app.delete('/admin/plan/:id', isAuthenticated, hasRole(['super_admin']), async (req, res) => {
  try {
    const plan = await Plan.findByIdAndDelete(req.params.id);
    
    await ActivityLog.create({
      adminId: req.session.adminId,
      action: 'DELETE_PLAN',
      details: `Deleted plan: ${plan.name}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('Delete plan error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Admins list
app.get('/admin-admins', isAuthenticated, hasRole(['super_admin']), async (req, res) => {
  try {
    const admins = await Admin.find().select('-password');
    res.render('admin-admins', {
      title: 'Admin Users',
      session: req.session,
      admins
    });
  } catch (error) {
    console.error('Admins error:', error);
    res.status(500).send('Server error');
  }
});

// Create admin
app.post('/admin/admins', isAuthenticated, hasRole(['super_admin']), async (req, res) => {
  try {
    const { username, password, email, fullName, role } = req.body;
    
    // Check if admin exists
    const existingAdmin = await Admin.findOne({ 
      $or: [{ username }, { email }] 
    });
    
    if (existingAdmin) {
      return res.status(400).json({ 
        success: false, 
        error: 'Username or email already exists' 
      });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const admin = new Admin({
      username,
      password: hashedPassword,
      email,
      fullName,
      role: role || 'admin',
      isActive: true
    });
    
    await admin.save();
    
    await ActivityLog.create({
      adminId: req.session.adminId,
      action: 'CREATE_ADMIN',
      details: `Created new admin: ${username}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    const adminResponse = admin.toObject();
    delete adminResponse.password;
    
    res.json({ success: true, admin: adminResponse });
    
  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Update admin
app.put('/admin/admin/:id', isAuthenticated, hasRole(['super_admin']), async (req, res) => {
  try {
    const { fullName, email, role, isActive } = req.body;
    
    const admin = await Admin.findByIdAndUpdate(
      req.params.id,
      { fullName, email, role, isActive },
      { new: true }
    ).select('-password');
    
    await ActivityLog.create({
      adminId: req.session.adminId,
      action: 'UPDATE_ADMIN',
      details: `Updated admin: ${admin.username}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.json({ success: true, admin });
    
  } catch (error) {
    console.error('Update admin error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Delete admin
app.delete('/admin/admin/:id', isAuthenticated, hasRole(['super_admin']), async (req, res) => {
  try {
    // Don't allow deleting yourself
    if (req.params.id === req.session.adminId.toString()) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot delete your own account' 
      });
    }
    
    const admin = await Admin.findByIdAndDelete(req.params.id);
    
    await ActivityLog.create({
      adminId: req.session.adminId,
      action: 'DELETE_ADMIN',
      details: `Deleted admin: ${admin.username}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('Delete admin error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Activity logs
app.get('/admin-activity-logs', isAuthenticated, hasRole(['super_admin', 'admin']), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 50;
    const skip = (page - 1) * limit;
    
    const logs = await ActivityLog.find()
      .populate('adminId', 'username fullName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await ActivityLog.countDocuments();
    
    res.render('admin-activity-logs', {
      title: 'Activity Logs',
      session: req.session,
      logs,
      currentPage: page,
      totalPages: Math.ceil(total / limit)
    });
    
  } catch (error) {
    console.error('Activity logs error:', error);
    res.status(500).send('Server error');
  }
});

// Create initial admin (run this once)
app.get('/admin-setup', async (req, res) => {
  try {
    const adminExists = await Admin.findOne({ username: 'admin' });
    
    if (adminExists) {
      return res.send('Admin already exists!');
    }
    
    const hashedPassword = await bcrypt.hash('Admin@123', 10);
    
    const admin = new Admin({
      username: 'admin',
      password: hashedPassword,
      email: 'admin@uniservices.com',
      fullName: 'Super Admin',
      role: 'super_admin',
      isActive: true
    });
    
    await admin.save();
    
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Admin Setup</title>
        <style>
          body { font-family: Arial; padding: 50px; background: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          h2 { color: #28a745; }
          .details { background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; }
          .warning { background: #fff3cd; color: #856404; padding: 10px; border-radius: 5px; margin: 20px 0; }
          a { display: inline-block; background: #0066ff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
          a:hover { background: #0052cc; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>✅ Admin Created Successfully!</h2>
          <div class="details">
            <p><strong>Username:</strong> admin</p>
            <p><strong>Password:</strong> Admin@123</p>
            <p><strong>Email:</strong> admin@uniservices.com</p>
          </div>
          <div class="warning">
            ⚠️ <strong>IMPORTANT:</strong> Please change this password after first login!
          </div>
          <a href="/admin-login">Go to Login Page</a>
        </div>
      </body>
      </html>
    `);
    
  } catch (error) {
    console.error('Setup error:', error);
    res.status(500).send('Error creating admin');
  }
});

// 403 page
app.get('/403', (req, res) => {
  res.status(403).render('403', { 
    title: 'Access Denied',
    session: req.session 
  });
});

// Start Server
app.listen(port, () => {
  console.log(`Server is active on http://localhost:${port}`);
  console.log(`Admin login: http://localhost:${port}/admin-login`);
  console.log(`Setup admin (run once): http://localhost:${port}/admin-setup`);
});