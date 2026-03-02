require('dotenv').config();
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const { type } = require('os');
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
    required: true
  },
  message: {
    type: String,
    required: true,
    minlength: 20
  }
}, { timestamps: true });

const Contact = mongoose.model('Contact', contactSchema);


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
      message
    });

    await newContact.save();

    res.json({ success: true });

  } catch (error) {
    console.error(error);
    res.json({ success: false, message: "Server error" });
  }
});


// Routes
app.get('/', (req, res) => res.render('index', { title: 'Home' }));
app.get('/about', (req, res) => res.render('about', { title: 'About' }));
app.get('/contact', (req, res) => res.render('contact', { title: 'Contact' }));
app.get('/unicare', (req, res) => res.render('unicare-coming-soon', { title: 'UniCare+' }));
app.get('/unishow', (req, res) => res.render('unishow-coming-soon', { title: 'UniShow' }));
app.get('/unispace', (req, res) => res.render('unispace-coming-soon', { title: 'UniSpace' }));

// Start Server
app.listen(port, () => {
  console.log(`Server is active on http://localhost:${port}`);
});
