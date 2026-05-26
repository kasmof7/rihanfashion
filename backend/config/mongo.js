// Central MongoDB Atlas connection helper
module.exports = {
  connect: function(uri) {
    const mongoose = require('mongoose');
    if (!uri) throw new Error('Missing MongoDB URI');
    mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    }).then(() => {
      console.log('MongoDB Atlas connected');
    }).catch((err) => {
      console.error('MongoDB Atlas connection error:', err);
    });
  }
}
