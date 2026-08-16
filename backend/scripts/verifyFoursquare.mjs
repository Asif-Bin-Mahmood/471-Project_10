import "dotenv/config";
import { getFoursquareNearbyPlaces } from "../src/services/foursquare.service.js";

const listing = {
  _id: "foursquare-verification",
  location: {
    lat: Number(process.env.FOURSQUARE_VERIFY_LAT || 23.7937),
    lng: Number(process.env.FOURSQUARE_VERIFY_LNG || 90.4066)
  }
};

try {
  const places = await getFoursquareNearbyPlaces(listing);
  if (!places.length) throw new Error("Foursquare returned zero nearby places for the verification coordinates.");
  if (places.some((place) => place.source !== "foursquare")) {
    throw new Error("Verification failed because a non-Foursquare result was returned.");
  }

  console.log(`Foursquare verification passed: ${places.length} real places returned.`);
  for (const place of places.slice(0, 5)) {
    console.log(`- ${place.category}: ${place.name}`);
  }
} catch (error) {
  console.error(`Foursquare verification failed: ${error.message}`);
  process.exitCode = 1;
}
