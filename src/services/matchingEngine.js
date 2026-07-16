const db = require('../db/jsonDb');

async function expandRadii() {
  try {
    const unacceptedDonations = await db.donations.find({ status: 'Waiting' });
    const now = Date.now();

    for (const donation of unacceptedDonations) {
      const createdAtTime = new Date(donation.createdAt).getTime();
      const elapsedMs = now - createdAtTime;
      const elapsedMinutes = elapsedMs / (1000 * 60);

      // Widens by 5 km for every 2 minutes it goes unaccepted
      // Base radius = 5 km
      const targetRadius = Math.min(50, 5 + Math.floor(elapsedMinutes / 2) * 5);

      if (donation.radius !== targetRadius) {
        await db.donations.updateOne(
          { id: donation.id },
          { radius: targetRadius }
        );
        console.log(`[Matching Engine] Expanded donation ID ${donation.id} ("${donation.foodName}") radius: ${donation.radius} km -> ${targetRadius} km`);
      }
    }
  } catch (err) {
    console.error('[Matching Engine Error]:', err);
  }
}

function startMatchingEngine() {
  console.log('[Matching Engine] Initialized and running every 30 seconds.');
  // Run once immediately on start
  expandRadii();
  // Set interval to run every 30 seconds
  return setInterval(expandRadii, 30 * 1000);
}

module.exports = {
  startMatchingEngine
};
