export const seedUsers = [
  {
    key: "business",
    name: "M A OBAEED",
    email: "asifnzs118+officekhoj.business@gmail.com",
    phone: "01700001382",
    password: "demo123",
    role: "business-owner",
    verificationStatus: "verified",
    businessType: "Startup Office",
    preferredArea: "Banani",
    budgetMin: 50000,
    budgetMax: 100000,
    minSize: 500,
    serviceNeed: "Interior + ISP setup"
  },
  {
    key: "property",
    name: "Nusrat Property Holdings",
    email: "asifnzs118+officekhoj.property@gmail.com",
    phone: "01711001100",
    password: "demo123",
    role: "property-owner",
    verificationStatus: "verified",
    nid: "NID-PO-4421",
    tradeLicense: "TL-PO-2026-11"
  },
  {
    key: "service",
    name: "FitOut Studio BD",
    email: "asifnzs118+officekhoj.service@gmail.com",
    phone: "01722002200",
    password: "demo123",
    role: "service-provider",
    verificationStatus: "verified",
    tradeLicense: "TL-SP-2026-31",
    coverageAreas: ["Banani", "Gulshan", "Mohakhali"]
  },
  {
    key: "admin",
    name: "OfficeKhoj Admin",
    email: "asifnzs118+officekhoj.admin@gmail.com",
    phone: "01733003300",
    password: "admin123",
    role: "admin",
    verificationStatus: "verified"
  },
  {
    key: "pendingService",
    name: "Spark Electrical Team",
    email: "electric@officekhoj.bd",
    phone: "01744004400",
    password: "demo123",
    role: "service-provider",
    verificationStatus: "pending",
    tradeLicense: "TL-SP-2026-55",
    coverageAreas: ["Dhanmondi", "Banani"]
  }
];

export const addressSuggestions = [
  { id: "addr-banani-11", label: "Road 11, Banani, Dhaka", area: "Banani", lat: 23.7939, lng: 90.4054 },
  { id: "addr-banani-chairmanbari", label: "Chairman Bari Road, Banani, Dhaka", area: "Banani", lat: 23.7895, lng: 90.4006 },
  { id: "addr-gulshan-1", label: "Gulshan 1 Circle, Dhaka", area: "Gulshan", lat: 23.7806, lng: 90.4169 },
  { id: "addr-gulshan-avenue", label: "Gulshan Avenue, Dhaka", area: "Gulshan", lat: 23.7898, lng: 90.4193 },
  { id: "addr-motijheel", label: "Motijheel Commercial Area, Dhaka", area: "Motijheel", lat: 23.7337, lng: 90.4175 },
  { id: "addr-dhanmondi-27", label: "Dhanmondi 27, Dhaka", area: "Dhanmondi", lat: 23.755, lng: 90.3751 },
  { id: "addr-uttara-sector-7", label: "Uttara Sector 7, Dhaka", area: "Uttara", lat: 23.8759, lng: 90.3992 },
  { id: "addr-mirpur-10", label: "Mirpur 10, Dhaka", area: "Mirpur", lat: 23.8069, lng: 90.3687 },
  { id: "addr-mohammadpur", label: "Town Hall, Mohammadpur, Dhaka", area: "Mohammadpur", lat: 23.7581, lng: 90.3584 },
  { id: "addr-tejgaon", label: "Tejgaon Industrial Area, Dhaka", area: "Tejgaon", lat: 23.7638, lng: 90.3997 },
  { id: "addr-bashundhara", label: "Bashundhara Residential Area, Dhaka", area: "Bashundhara", lat: 23.8151, lng: 90.4255 },
  { id: "addr-badda", label: "Middle Badda, Dhaka", area: "Badda", lat: 23.7804, lng: 90.4258 },
  { id: "addr-rampura", label: "Rampura, Dhaka", area: "Rampura", lat: 23.7612, lng: 90.4208 },
  { id: "addr-farmgate", label: "Farmgate, Dhaka", area: "Farmgate", lat: 23.7579, lng: 90.3895 },
  { id: "addr-paltan", label: "Paltan, Dhaka", area: "Paltan", lat: 23.7368, lng: 90.4106 }
];

export const landmarkData = [
  { name: "Banani 11", lat: 23.7942, lng: 90.4059 },
  { name: "Gulshan 1 Circle", lat: 23.7805, lng: 90.4169 },
  { name: "Kamal Ataturk Avenue", lat: 23.7932, lng: 90.403 },
  { name: "Motijheel Road", lat: 23.7338, lng: 90.4177 },
  { name: "Dhanmondi 27", lat: 23.7552, lng: 90.3751 },
  { name: "Uttara Sector 7", lat: 23.8758, lng: 90.3994 }
];

export const nearbySeed = {
  Bank: ["BRAC Bank Booth", "Dutch-Bangla ATM"],
  Restaurant: ["Lunch Box Cafe", "Kacchi Corner"],
  Hospital: ["Banani Clinic", "Gulshan Health Point"],
  Transport: ["Bus Stop", "Ride-share Point"]
};
