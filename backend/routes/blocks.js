const express = require('express')
const path = require('path')
const fs = require('fs')
const { authMiddleware } = require('./dresses')

const router = express.Router()
const BLOCKS_FILE = path.resolve(__dirname, '..', 'data', 'blocks.json')

function readBlocks() {
  try {
    const raw = fs.readFileSync(BLOCKS_FILE, 'utf8')
    return JSON.parse(raw) || []
  } catch (e) {
    return []
  }
}

function writeBlocks(blocks) {
  fs.writeFileSync(BLOCKS_FILE, JSON.stringify(blocks, null, 2))
}

router.get('/blocks', (req, res) => {
  try {
    const blocks = readBlocks().sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    res.json(blocks)
  } catch (e) {
    res.status(500).json({ error: 'server_error' })
  }
})

router.post('/blocks', authMiddleware, (req, res) => {
  try {
    const { type, title, content, image, link, page, order } = req.body || {}
    const blocks = readBlocks()
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2)
    const newBlock = {
      id,
      type: type || 'text',
      title: title || '',
      content: content || '',
      image: image || '',
      link: link || '',
      page: page || 'home',
      order: typeof order === 'number' ? order : blocks.length + 1
    }
    blocks.push(newBlock)
    writeBlocks(blocks)
    res.status(201).json(newBlock)
  } catch (e) {
    res.status(400).json({ error: 'invalid_request' })
  }
})

router.put('/blocks/:id', authMiddleware, (req, res) => {
  try {
    const id = req.params.id
    const blocks = readBlocks()
    const idx = blocks.findIndex(b => b.id === id)
    if (idx < 0) return res.status(404).json({ error: 'not_found' })
    blocks[idx] = { ...blocks[idx], ...req.body }
    writeBlocks(blocks)
    res.json(blocks[idx])
  } catch (e) {
    res.status(400).json({ error: 'invalid_request' })
  }
})

router.delete('/blocks/:id', authMiddleware, (req, res) => {
  try {
    const id = req.params.id
    const blocks = readBlocks()
    const idx = blocks.findIndex(b => b.id === id)
    if (idx < 0) return res.status(404).json({ error: 'not_found' })
    blocks.splice(idx, 1)
    writeBlocks(blocks)
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: 'server_error' })
  }
})

module.exports = router
