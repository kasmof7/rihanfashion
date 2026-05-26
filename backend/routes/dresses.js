const express = require('express')
const path = require('path')
const fs = require('fs')
const mongoose = require('mongoose')
const jwt = require('jsonwebtoken')

const router = express.Router()
const DATA_DIR = path.resolve(__dirname, '..', '..', 'data');
const DRESSES_FILE = path.resolve(DATA_DIR, 'dresses.json')

function ensureDressesFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DRESSES_FILE)) fs.writeFileSync(DRESSES_FILE, JSON.stringify([]));
}
let JWT_SECRET = null

function isMongoReady() {
  return mongoose.connection.readyState === 1
}

function getDressModel() {
  try { return require('../models/Dress') }
  catch (e) { return null }
}

function readDresses() {
  try {
    const raw = fs.readFileSync(DRESSES_FILE, 'utf8')
    return JSON.parse(raw) || []
  } catch (e) {
    return []
  }
}

function writeDresses(items) {
  fs.writeFileSync(DRESSES_FILE, JSON.stringify(items, null, 2))
}

function buildFilter(query) {
  return Object.entries(query).reduce((f, [k, v]) => {
    if (['page', 'limit', 'sort'].includes(k)) return f
    if (k === 'search') {
      f.$or = [
        { name: { $regex: v, $options: 'i' } },
        { description: { $regex: v, $options: 'i' } }
      ]
    } else     if (['featured', 'isNew', 'isOnSale', 'inStock'].includes(k) && v === 'true') {
      if (k === 'isNew') {
        f.isNewDress = true
      } else {
        f[k] = true
      }
    } else if (k === 'category' && v) {
      f.category = v
    } else if (k === 'minPrice') {
      f.price = { ...f.price, $gte: Number(v) }
    } else if (k === 'maxPrice') {
      f.price = { ...f.price, $lte: Number(v) }
    }
    return f
  }, {})
}

function matches(dress, filter) {
  for (const [k, v] of Object.entries(filter)) {
    if (k === '$or') {
      const orMatch = v.some(cond => {
        const [field, pattern] = Object.entries(cond)[0]
        return new RegExp(pattern.$regex, pattern.$options).test(dress[field])
      })
      if (!orMatch) return false
    } else if (k === 'price') {
      if (v.$gte && dress.price < v.$gte) return false
      if (v.$lte && dress.price > v.$lte) return false
    } else if (k === 'isNewDress') {
      if ((dress.isNewDress !== true && dress.isNew !== true)) return false
    } else {
      if (dress[k] !== v) return false
    }
  }
  return true
}

function setJwtSecret(secret) {
  JWT_SECRET = secret
}

function authMiddleware(req, res, next) {
  const auth = req.headers['authorization']
  const token = auth && auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return res.status(401).json({ message: 'Unauthorized' })
  try {
    jwt.verify(token, JWT_SECRET)
    next()
  } catch (e) {
    return res.status(401).json({ message: 'Token expired or invalid' })
  }
}

ensureDressesFile();

// ---- GET /api/dresses ----
router.get('/dresses', async (req, res) => {
  try {
    if (isMongoReady()) {
      const Dress = getDressModel()
      if (Dress) {
        const filter = {}
        if (req.query.category) filter.category = req.query.category
        if (req.query.featured === 'true') filter.featured = true
        if (req.query.isNew === 'true') filter.isNewDress = true
        if (req.query.isOnSale === 'true') filter.isOnSale = true
        if (req.query.inStock === 'true') filter.inStock = true
        if (req.query.search) {
          filter.$or = [
            { name: { $regex: req.query.search, $options: 'i' } },
            { description: { $regex: req.query.search, $options: 'i' } }
          ]
        }
        if (req.query.minPrice || req.query.maxPrice) {
          filter.price = {}
          if (req.query.minPrice) filter.price.$gte = Number(req.query.minPrice)
          if (req.query.maxPrice) filter.price.$lte = Number(req.query.maxPrice)
        }
        const sort = {}
        switch (req.query.sort) {
          case 'price_asc': sort.price = 1; break
          case 'price_desc': sort.price = -1; break
          case 'newest': sort.createdAt = -1; break
          case 'name_asc': sort.name = 1; break
          default: sort.sortOrder = 1; sort.createdAt = -1
        }
        const page = parseInt(req.query.page) || 1
        const limit = parseInt(req.query.limit) || 50
        const [dresses, total] = await Promise.all([
          Dress.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
          Dress.countDocuments(filter)
        ])
        return res.json({ dresses, pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
      }
    }
    // JSON fallback
    let dresses = readDresses()
    const filter = buildFilter(req.query)
    if (Object.keys(filter).length) dresses = dresses.filter(d => matches(d, filter))
    const sort = req.query.sort
    if (sort === 'price_asc') dresses.sort((a, b) => a.price - b.price)
    else if (sort === 'price_desc') dresses.sort((a, b) => b.price - a.price)
    else if (sort === 'newest') dresses.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    else if (sort === 'name_asc') dresses.sort((a, b) => a.name.localeCompare(b.name))
    else dresses.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 50
    const total = dresses.length
    res.json({ dresses: dresses.slice((page - 1) * limit, page * limit), pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
  } catch (e) {
    res.status(500).json({ error: 'server_error' })
  }
})

// ---- GET /api/dresses/featured ----
router.get('/dresses/featured', async (req, res) => {
  try {
    if (isMongoReady()) {
      const Dress = getDressModel()
      if (Dress) {
        const dresses = await Dress.find({ featured: true }).sort({ sortOrder: 1 }).limit(10).lean()
        return res.json(dresses)
      }
    }
    res.json(readDresses().filter(d => d.featured).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)).slice(0, 10))
  } catch (e) {
    res.status(500).json({ error: 'server_error' })
  }
})

// ---- GET /api/dresses/new ----
router.get('/dresses/new', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10
    if (isMongoReady()) {
      const Dress = getDressModel()
      if (Dress) {
        const dresses = await Dress.find({ isNewDress: true }).sort({ createdAt: -1 }).limit(limit).lean()
        return res.json(dresses)
      }
    }
    res.json(readDresses().filter(d => d.isNewDress || d.isNew).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, limit))
  } catch (e) {
    res.status(500).json({ error: 'server_error' })
  }
})

// ---- GET /api/dresses/sale ----
router.get('/dresses/sale', async (req, res) => {
  try {
    if (isMongoReady()) {
      const Dress = getDressModel()
      if (Dress) {
        const dresses = await Dress.find({ isOnSale: true }).sort({ createdAt: -1 }).limit(20).lean()
        return res.json(dresses)
      }
    }
    res.json(readDresses().filter(d => d.isOnSale).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 20))
  } catch (e) {
    res.status(500).json({ error: 'server_error' })
  }
})

// ---- GET /api/dresses/categories ----
router.get('/dresses/categories', async (req, res) => {
  try {
    if (isMongoReady()) {
      const Dress = getDressModel()
      if (Dress) {
        const cats = await Dress.distinct('category')
        return res.json(cats)
      }
    }
    res.json([...new Set(readDresses().map(d => d.category).filter(Boolean))])
  } catch (e) {
    res.status(500).json({ error: 'server_error' })
  }
})

// ---- GET /api/dresses/:id ----
router.get('/dresses/:id', async (req, res) => {
  try {
    if (isMongoReady()) {
      const Dress = getDressModel()
      if (Dress) {
        const dress = await Dress.findById(req.params.id).lean()
        if (!dress) return res.status(404).json({ error: 'not_found' })
        return res.json(dress)
      }
    }
    const dress = readDresses().find(d => d._id === req.params.id)
    if (!dress) return res.status(404).json({ error: 'not_found' })
    res.json(dress)
  } catch (e) {
    res.status(500).json({ error: 'server_error' })
  }
})

// ---- POST /api/dresses ----
router.post('/dresses', authMiddleware, async (req, res) => {
  try {
    const { name, description, price, discountPrice, images, category, colors, sizes, material, inStock, featured, isNew, isOnSale, sortOrder } = req.body
    if (!name || !name.trim()) return res.status(400).json({ error: 'name_required' })
    if (isMongoReady()) {
      const Dress = getDressModel()
      if (Dress) {
        const dress = await Dress.create({
          name: name.trim(), description: description || '', price: price || 0, discountPrice: discountPrice || 0,
          images: images || [], category: category || 'زفاف', colors: colors || [], sizes: sizes || [],
          material: material || '', inStock: inStock !== false, featured: featured || false,
          isNewDress: isNew || false, isOnSale: isOnSale || false, sortOrder: sortOrder || 0
        })
        return res.status(201).json(dress)
      }
    }
    const dresses = readDresses()
    const _id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
    const dress = { _id, name: name.trim(), description: description || '', price: price || 0, discountPrice: discountPrice || 0, images: images || [], category: category || 'زفاف', colors: colors || [], sizes: sizes || [], material: material || '', inStock: inStock !== false, featured: featured || false, isNew: isNew || false, isNewDress: isNew || false, isOnSale: isOnSale || false, sortOrder: sortOrder || 0, createdAt: new Date().toISOString() }
    dresses.push(dress)
    writeDresses(dresses)
    res.status(201).json(dress)
  } catch (e) {
    res.status(400).json({ error: 'invalid_request' })
  }
})

// ---- PUT /api/dresses/:id ----
router.put('/dresses/:id', authMiddleware, async (req, res) => {
  try {
    const updates = { ...req.body }
    delete updates._id
    delete updates.createdAt
    delete updates.__v
    if (isMongoReady()) {
      const Dress = getDressModel()
      if (Dress) {
        const dress = await Dress.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true, runValidators: true })
        if (!dress) return res.status(404).json({ error: 'not_found' })
        return res.json(dress)
      }
    }
    const dresses = readDresses()
    const idx = dresses.findIndex(d => d._id === req.params.id)
    if (idx < 0) return res.status(404).json({ error: 'not_found' })
    dresses[idx] = { ...dresses[idx], ...updates }
    writeDresses(dresses)
    res.json(dresses[idx])
  } catch (e) {
    res.status(400).json({ error: 'invalid_request' })
  }
})

// ---- DELETE /api/dresses/:id ----
router.delete('/dresses/:id', authMiddleware, async (req, res) => {
  try {
    let dressImages = [];
    if (isMongoReady()) {
      const Dress = getDressModel();
      if (Dress) {
        const dress = await Dress.findById(req.params.id);
        if (!dress) return res.status(404).json({ error: 'not_found' });
        dressImages = dress.images || [];
        await Dress.findByIdAndDelete(req.params.id);
        await deleteUnusedImages(dressImages);
        return res.json({ success: true });
      }
    }
    const dresses = readDresses();
    const idx = dresses.findIndex(d => d._id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: 'not_found' });
    dressImages = dresses[idx].images || [];
    dresses.splice(idx, 1);
    writeDresses(dresses);
    await deleteUnusedImages(dressImages);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'server_error' });
  }
});

// Helper: delete image files that are no longer referenced by any dress
async function deleteUnusedImages(deletedImages) {
  const UPLOADS_DIR = path.resolve(__dirname, '..', 'uploads');
  if (!fs.existsSync(UPLOADS_DIR)) return;

  for (const imgUrl of deletedImages) {
    if (typeof imgUrl !== 'string' || !imgUrl.startsWith('/uploads/')) continue;
    const filename = imgUrl.replace('/uploads/', '');
    const filePath = path.join(UPLOADS_DIR, filename);

    let isUsed = false;
    if (isMongoReady()) {
      try {
        const Dress = getDressModel();
        if (Dress) {
          const count = await Dress.countDocuments({ images: imgUrl });
          isUsed = count > 0;
        }
      } catch (e) { /* ignore */ }
    } else {
      const dresses = readDresses();
      isUsed = dresses.some(d => d.images && d.images.includes(imgUrl));
    }

    if (!isUsed && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (e) { /* ignore */ }
    }
  }
}

module.exports = { router, setJwtSecret, authMiddleware }
