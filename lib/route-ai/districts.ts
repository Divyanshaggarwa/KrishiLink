/* ========================================================================
   District coordinates — approximate centers for routing.
   Covers major agricultural districts. Falls back to state center.
   ======================================================================== */

export interface DistrictCoord {
  lat: number;
  lng: number;
}

const DISTRICTS: Record<string, DistrictCoord> = {
  // Maharashtra
  "nashik": { lat: 20.0059, lng: 73.7898 },
  "pune": { lat: 18.5204, lng: 73.8567 },
  "mumbai": { lat: 19.076, lng: 72.8777 },
  "nagpur": { lat: 21.1458, lng: 79.0882 },
  "aurangabad": { lat: 19.8762, lng: 75.3433 },
  "solapur": { lat: 17.6599, lng: 75.9064 },
  "kolhapur": { lat: 16.705, lng: 74.2433 },
  "sangli": { lat: 16.8524, lng: 74.5815 },
  "satara": { lat: 17.6805, lng: 74.0183 },
  "ahmednagar": { lat: 19.0948, lng: 74.748 },
  "jalgaon": { lat: 21.0077, lng: 75.5626 },
  "amravati": { lat: 20.9374, lng: 77.7796 },
  "latur": { lat: 18.4088, lng: 76.5604 },
  "dhule": { lat: 20.9042, lng: 74.7749 },
  "beed": { lat: 18.9891, lng: 75.7601 },
  "nanded": { lat: 19.1383, lng: 77.321 },
  "parbhani": { lat: 19.2704, lng: 76.7601 },
  "buldhana": { lat: 20.529, lng: 76.1843 },
  "akola": { lat: 20.7002, lng: 77.0082 },
  "yavatmal": { lat: 20.388, lng: 78.1204 },

  // Uttarakhand
  "dehradun": { lat: 30.3165, lng: 78.0322 },
  "haridwar": { lat: 29.9457, lng: 78.1642 },

  // Delhi NCR
  "new delhi": { lat: 28.6139, lng: 77.209 },
  "delhi": { lat: 28.6139, lng: 77.209 },
  "gurugram": { lat: 28.4595, lng: 77.0266 },
  "noida": { lat: 28.5355, lng: 77.391 },

  // Karnataka
  "bengaluru": { lat: 12.9716, lng: 77.5946 },
  "bangalore": { lat: 12.9716, lng: 77.5946 },
  "mysuru": { lat: 12.2958, lng: 76.6394 },
  "belagavi": { lat: 15.8497, lng: 74.4977 },
  "hubli": { lat: 15.3647, lng: 75.124 },

  // Tamil Nadu
  "chennai": { lat: 13.0827, lng: 80.2707 },
  "coimbatore": { lat: 11.0168, lng: 76.9558 },
  "madurai": { lat: 9.9252, lng: 78.1198 },

  // Gujarat
  "ahmedabad": { lat: 23.0225, lng: 72.5714 },
  "surat": { lat: 21.1702, lng: 72.8311 },
  "rajkot": { lat: 22.3039, lng: 70.8022 },

  // Uttar Pradesh
  "lucknow": { lat: 26.8467, lng: 80.9462 },
  "kanpur": { lat: 26.4499, lng: 80.3319 },
  "varanasi": { lat: 25.3176, lng: 82.9739 },
  "agra": { lat: 27.1767, lng: 78.0081 },
  "meerut": { lat: 28.9845, lng: 77.7064 },
  "prayagraj": { lat: 25.4358, lng: 81.8463 },

  // Punjab / Haryana
  "ludhiana": { lat: 30.901, lng: 75.8573 },
  "amritsar": { lat: 31.634, lng: 74.8723 },
  "karnal": { lat: 29.6857, lng: 76.9905 },
  "hisar": { lat: 29.1492, lng: 75.7217 },

  // Madhya Pradesh
  "bhopal": { lat: 23.2599, lng: 77.4126 },
  "indore": { lat: 22.7196, lng: 75.8577 },
  "jabalpur": { lat: 23.1815, lng: 79.9864 },

  // Rajasthan
  "jaipur": { lat: 26.9124, lng: 75.7873 },
  "jodhpur": { lat: 26.2389, lng: 73.0243 },

  // West Bengal
  "kolkata": { lat: 22.5726, lng: 88.3639 },

  // Andhra / Telangana
  "hyderabad": { lat: 17.385, lng: 78.4867 },
  "guntur": { lat: 16.3067, lng: 80.4365 },
  "vijayawada": { lat: 16.5062, lng: 80.648 },

  // Bihar
  "patna": { lat: 25.5941, lng: 85.1376 },
  "gaya": { lat: 24.7914, lng: 85.0002 },
};

const STATE_CENTERS: Record<string, DistrictCoord> = {
  maharashtra: { lat: 19.7515, lng: 75.7139 },
  karnataka: { lat: 15.3173, lng: 75.7139 },
  "tamil nadu": { lat: 11.1271, lng: 78.6569 },
  gujarat: { lat: 22.2587, lng: 71.1924 },
  "uttar pradesh": { lat: 26.8467, lng: 80.9462 },
  "madhya pradesh": { lat: 23.4733, lng: 77.947 },
  rajasthan: { lat: 27.0238, lng: 74.2179 },
  "west bengal": { lat: 22.9868, lng: 87.855 },
  uttarakhand: { lat: 30.0668, lng: 79.0193 },
  punjab: { lat: 31.1471, lng: 75.3412 },
  haryana: { lat: 29.0588, lng: 76.0856 },
  "andhra pradesh": { lat: 15.9129, lng: 79.74 },
  telangana: { lat: 18.1124, lng: 79.0193 },
  bihar: { lat: 25.0961, lng: 85.3131 },
};

/**
 * Get approximate coordinates for a user by district + state.
 * Falls back to state center, then to a default.
 */
export function getDistrictCoords(
  district: string | null,
  state: string | null,
  pincode: string | null
): DistrictCoord {
  // Try district first
  if (district) {
    const key = district.toLowerCase().trim();
    if (DISTRICTS[key]) return DISTRICTS[key];
  }

  // Try state
  if (state) {
    const key = state.toLowerCase().trim();
    if (STATE_CENTERS[key]) return STATE_CENTERS[key];
  }

  // Fallback — default to Nashik (agricultural hub)
  return { lat: 20.0059, lng: 73.7898 };
}

/** Deterministic jitter so same district users aren't on exactly the same pin */
export function jitterCoords(
  base: DistrictCoord,
  seed: string
): DistrictCoord {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 10000;
  }
  const latJitter = ((hash % 200) - 100) / 1000; // ±0.1°
  const lngJitter = (((hash >> 8) % 200) - 100) / 1000;
  return {
    lat: Number((base.lat + latJitter).toFixed(6)),
    lng: Number((base.lng + lngJitter).toFixed(6)),
  };
}