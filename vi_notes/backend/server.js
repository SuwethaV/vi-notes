const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = 'supersecret_vinotes_key_2026';

// 1. Database Connection
mongoose.connect('mongodb://127.0.0.1:27017/vinotes')
  .then(() => console.log('MongoDB Connected to vinotes'))
  .catch(err => console.log('MongoDB Connection Error:', err));

// 2. Models
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
}, { timestamps: true });
const User = mongoose.model('User', UserSchema);

const PasteEventSchema = new mongoose.Schema({
  timestamp: Date,
  length: Number,
  content: String
});

const DocumentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  pasteEvents: [PasteEventSchema],
  authScore: { type: Number, required: true },
  analysisDetails: { type: String }, // e.g., 'Likely AI/Paste', 'Likely Human'
}, { timestamps: true });
const Document = mongoose.model('Document', DocumentSchema);

// Middleware
const auth = (req, res, next) => {
  const token = req.header('Authorization');
  if (!token) return res.status(401).json({ msg: 'No token, authorization denied' });
  try {
    const decoded = jwt.verify(token.replace('Bearer ', ''), JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    res.status(400).json({ msg: 'Token is not valid' });
  }
};

// 3. Auth Routes
app.post('/api/auth/register', async (req, res) => {
  console.log('Register Payload:', req.body);
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ msg: 'Please enter all fields' });

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ msg: 'User already exists' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({ name, email, password: hashedPassword });
    const savedUser = await newUser.save();

    const token = jwt.sign({ id: savedUser._id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: savedUser._id, name: savedUser.name, email: savedUser.email } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ msg: 'Please enter all fields' });

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: 'User does not exist' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/user', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Document Routes
// Analyze and Save
app.post('/api/documents/analyze', auth, async (req, res) => {
  const { content, pasteEvents } = req.body;
  if (!content) return res.status(400).json({ msg: 'Content is missing' });

  // Advanced Analysis Logic Simulation
  let authScore = 100;
  let analysisDetails = "Genuine human composition verified.";

  // Advanced Analysis via Python ML Engine
  try {
    const totalPastedLength = pasteEvents ? pasteEvents.reduce((acc, curr) => acc + curr.length, 0) : 0;
    
    const payload = JSON.stringify({
      content: content,
      pasteCount: pasteEvents ? pasteEvents.length : 0,
      totalPasteLength: totalPastedLength
    });

    const http = require('http');
    const options = {
      hostname: '127.0.0.1',
      port: 8000,
      path: '/predict',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const mlData = await new Promise((resolve, reject) => {
      const reqHTTP = http.request(options, (resHTTP) => {
        let rawData = '';
        resHTTP.on('data', (chunk) => rawData += chunk);
        resHTTP.on('end', () => {
          try {
            resolve(JSON.parse(rawData));
          } catch (e) {
            reject(new Error("Response parsing failed"));
          }
        });
      });
      reqHTTP.on('error', (e) => reject(e));
      reqHTTP.setTimeout(5000, () => reqHTTP.abort());
      reqHTTP.write(payload);
      reqHTTP.end();
    });

    authScore = mlData.authenticity_score;
    analysisDetails = mlData.prediction_class + " | " + mlData.details;
  } catch (err) {
    console.log('Failed to reach ML engine:', err.message);
    analysisDetails = "ML Engine offline. Fallback scoring applied.";
    if (pasteEvents && pasteEvents.length > 0) authScore = 30;
  }

  try {
    const newDoc = new Document({
      user: req.user.id,
      content,
      pasteEvents: pasteEvents || [],
      authScore,
      analysisDetails
    });
    const savedDoc = await newDoc.save();
    res.json(savedDoc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get History
app.get('/api/documents/history', auth, async (req, res) => {
  try {
    const docs = await Document.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = 5000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
