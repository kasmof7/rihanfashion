const mongoose = require('mongoose')
const { Schema } = mongoose

const OrderItemSchema = new Schema({
  dressId: { type: Schema.Types.ObjectId, ref: 'Dress' },
  quantity: { type: Number, default: 1 },
  price: Number
})

const OrderSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  items: [OrderItemSchema],
  total: Number,
  status: { type: String, default: 'pending' },
  shippingAddress: String
}, { timestamps: true })

module.exports = mongoose.model('Order', OrderSchema)
