require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Dress = require('./models/Dress');

const SAMPLE_FILE = path.resolve(__dirname, '..', 'data', 'sample-dresses.json');
const SAMPLE_DRESSES = JSON.parse(fs.readFileSync(SAMPLE_FILE, 'utf8')).map(d => {
  const { _id, ...rest } = d;
  return rest;
});

async function seed() {
  const mongoUri = process.env.MONGODB_URI;
  const directUri = process.env.MONGODB_DIRECT;
  
  if (!mongoUri) {
    console.log('MONGODB_URI not set. To seed database, set MONGODB_URI environment variable.');
    console.log('Example: MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/rihanfashion');
    return;
  }

  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    console.log('Connected to MongoDB');
    
    const count = await Dress.countDocuments();
    if (count > 0) {
      console.log(`Dresses collection already has ${count} items. Skipping seed.`);
      console.log('To re-seed, delete the collection first or use: npm run seed:reset');
      await mongoose.disconnect();
      return;
    }
    
    await Dress.insertMany(SAMPLE_DRESSES);
    console.log(`Seeded ${SAMPLE_DRESSES.length} dresses successfully!`);
    
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (e) {
    if (directUri) {
      console.log('SRV connection failed, retrying with direct connection...');
      try {
        await mongoose.connect(directUri);
        console.log('Connected to MongoDB (direct)');
        const count = await Dress.countDocuments();
        if (count > 0) {
          console.log(`Dresses collection already has ${count} items. Skipping seed.`);
          await mongoose.disconnect();
          return;
        }
        await Dress.insertMany(SAMPLE_DRESSES);
        console.log(`Seeded ${SAMPLE_DRESSES.length} dresses successfully!`);
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
        return;
      } catch (e2) {
        console.error('Seed error:', e2.message);
        process.exit(1);
      }
    }
    console.error('Seed error:', e.message);
    process.exit(1);
  }
}

seed();