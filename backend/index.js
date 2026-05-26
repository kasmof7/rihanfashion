require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

const USE_MONGO = !!process.env.MONGODB_URI;
const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const REVIEWS_FILE = path.resolve(DATA_DIR, 'reviews.json');
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS_HASH = bcrypt.hashSync(process.env.ADMIN_PASS || 'rihanadmin2026', 10);
const JWT_SECRET = process.env.JWT_SECRET || 'rihan-fashion-dev-secret-' + Date.now();
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// Security warnings in production
const WEAK_PASSWORDS = ['rihan2026', 'rihanadmin2026', 'admin', 'password', '123456', 'CHANGE_THIS_TO_A_STRONG_PASSWORD'];
if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.startsWith('rihan-fashion')) {
    console.error('⚠️  WARNING: JWT_SECRET is using default value. Set a strong secret in .env');
    process.exit(1);
  }
  if (!process.env.ADMIN_PASS || WEAK_PASSWORDS.includes(process.env.ADMIN_PASS)) {
    console.error('⚠️  WARNING: ADMIN_PASS is using default/weak value. Set a strong password in .env');
    process.exit(1);
  }
}

const DRESSES_FILE = path.resolve(DATA_DIR, 'dresses.json');

function ensureDataFiles() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
  if (!fs.existsSync(REVIEWS_FILE)) fs.writeFileSync(REVIEWS_FILE, JSON.stringify([]));
  if (!fs.existsSync(DRESSES_FILE)) fs.writeFileSync(DRESSES_FILE, JSON.stringify([]));
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) }
  catch (e) { return [] }
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https://placehold.co"],
      connectSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      manifestSrc: ["'self'"]
    }
  }
}));

// CORS: dynamic origin support for production
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
  : (process.env.NODE_ENV === 'production' ? [] : ['http://localhost:3000', 'http://localhost:5173']);

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (server-to-server, Postman, etc.)
    if (!origin) return cb(null, true);
    // Allow if in allowed list or if same-origin (when API and frontend are on same domain)
    if (ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)) {
      return cb(null, true);
    }
    cb(null, true);
  },
  credentials: true
}));

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'تم تجاوز الحد المسموح، حاول مرة أخرى لاحقاً' },
  standardHeaders: true,
  legacyHeaders: false,
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 8, // limit each IP to 8 login attempts per windowMs
  message: { error: 'محاولات كثيرة جداً، حاول مرة أخرى بعد 15 دقيقة' },
  standardHeaders: true,
  legacyHeaders: false,
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30, // limit each IP to 30 uploads per hour
  message: { error: 'تم تجاوز حد الرفع المسموح' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(generalLimiter);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
ensureDataFiles();

let DressModel = null;
let ReviewModel = null;

if (USE_MONGO) {
  const uri = process.env.MONGODB_URI;
  const directUri = process.env.MONGODB_DIRECT;
  mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 })
    .then(() => {
      console.log('MongoDB connected');
      DressModel = require('./models/Dress');
      ReviewModel = require('./models/Review');
    })
    .catch(err => {
      console.error('MongoDB SRV connection error:', err.message);
      if (directUri) {
        console.log('Retrying with direct connection string...');
        mongoose.connect(directUri)
          .then(() => {
            console.log('MongoDB connected (direct)');
            DressModel = require('./models/Dress');
            ReviewModel = require('./models/Review');
          })
          .catch(err2 => {
            console.error('MongoDB direct connection error:', err2.message);
            console.log('Falling back to JSON file storage');
          });
      } else {
        console.log('Falling back to JSON file storage');
      }
    });
} else {
  console.log('MONGODB_URI not set, using JSON file storage');
}

const { router: dressRoutes, setJwtSecret } = require('./routes/dresses');
const UPLOADS_DIR = path.resolve(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.random().toString(36).slice(2, 8) + path.extname(file.originalname))
});
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
function fileFilter(req, file, cb) {
  if (ALLOWED_MIMES.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Only image files (JPEG, PNG, WebP, GIF, AVIF) are allowed'), false);
}
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 }, fileFilter });

app.use('/uploads', express.static(UPLOADS_DIR));

app.post('/api/upload', uploadLimiter, (req, res) => {
  upload.single('image')(req, res, err => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE' ? 'الملف كبير جداً (الحد الأقصى 50 ميغابايت)' : err.message;
      return res.status(400).json({ error: 'upload_failed', message });
    }
    if (!req.file) return res.status(400).json({ error: 'no_file' });
    res.json({ url: '/uploads/' + req.file.filename });
  });
});

setJwtSecret(JWT_SECRET);
app.use('/api', dressRoutes);

app.post('/api/admin/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ message: 'Missing credentials' });
  if (username !== ADMIN_USER) return res.status(401).json({ message: 'Invalid credentials' });
  const match = await bcrypt.compare(password, ADMIN_PASS_HASH);
  if (!match) return res.status(401).json({ message: 'Invalid credentials' });
  const token = jwt.sign({ username, role: 'admin' }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  res.json({ token });
});

app.get('/api/admin/verify', (req, res) => {
  const auth = req.headers['authorization'];
  const token = auth && auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ valid: false });
  try {
    jwt.verify(token, JWT_SECRET);
    res.json({ valid: true });
  } catch (e) {
    return res.status(401).json({ valid: false });
  }
});

try {
  const blocksRoutes = require('./routes/blocks');
  app.use('/api', blocksRoutes);
} catch (e) { console.error('Blocks routes failed to load:', e) }

const reviewLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each IP to 10 reviews per hour
  message: { error: 'تم تجاوز الحد المسموح للتقييمات' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.get('/api/reviews', async (req, res) => {
  if (DressModel && ReviewModel && mongoose.connection.readyState === 1) {
    const reviews = await ReviewModel.find().exec();
    return res.json(reviews);
  }
  res.json(readJson(REVIEWS_FILE));
});

app.post('/api/reviews', reviewLimiter, async (req, res) => {
  const { name, review } = req.body || {};
  if (!name || !review) return res.status(400).json({ message: 'Missing review data' });
  
  // Sanitize input to prevent XSS
  const sanitize = (str) => {
    if (typeof str !== 'string') return '';
    return str.replace(/[<>&"'/]/g, (c) => ({
      '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#x27;', '/': '&#x2F;'
    })[c]);
  };
  
  const sanitizedName = sanitize(name);
  const sanitizedReview = sanitize(review);
  if (ReviewModel && mongoose.connection.readyState === 1) {
    const item = await ReviewModel.create({ name: sanitizedName, review: sanitizedReview });
    return res.json({ success: true, item });
  }
  const reviews = readJson(REVIEWS_FILE);
  reviews.push({ name: sanitizedName, review: sanitizedReview, date: new Date().toISOString() });
  writeJson(REVIEWS_FILE, reviews);
  res.json({ success: true, item: reviews[reviews.length - 1] });
});

// Block access to sensitive directories/files (security critical — must be before express.static)
const PROJECT_ROOT = path.resolve(__dirname, '..');
const BLOCKED_PATHS = ['/backend', '/data', '/docs', '/node_modules', '/.env', '/mysql-8.4', '/package-lock.json'];
app.use((req, res, next) => {
  if (BLOCKED_PATHS.some(p => req.path.startsWith(p) || req.path === p)) {
    return res.status(404).end();
  }
  next();
});

// Serve static files from project root
app.use(express.static(PROJECT_ROOT, { index: 'index.html' }));

// 404 fallback
app.use((req, res) => {
  res.status(404).sendFile(path.resolve(__dirname, '..', '404.html'));
});

app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});
