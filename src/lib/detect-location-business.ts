const LOCATION_KEYWORDS = [
  // Service providers
  "therapist", "therapy", "counselor", "counseling", "salon", "spa", "gym", "fitness",
  "yoga", "pilates", "chiropractor", "chiropractic", "dentist", "dental", "doctor",
  "clinic", "plumber", "plumbing", "electrician", "contractor", "landscaper",
  "landscaping", "mechanic", "realtor", "real estate", "photographer", "photography",
  "massage", "acupuncture", "physical therapy", "optometrist", "orthodontist",
  // Brick & mortar
  "restaurant", "cafe", "coffee", "bakery", "bar", "brewery", "shop", "store",
  "boutique", "studio", "gallery", "florist", "flower", "pizzeria", "deli",
  "nail", "barber", "barbershop", "tattoo", "pet grooming", "groomer",
  // Professional services
  "attorney", "lawyer", "law firm", "accountant", "accounting", "cpa",
  "veterinarian", "vet", "tutor", "tutoring", "daycare", "preschool",
  "cleaning", "maid", "hvac", "roofing", "roofer", "pest control",
];

const INDUSTRY_EXAMPLES: Record<string, string> = {
  therapist: "a therapist in Austin might only want their ads shown within 25 miles of their office",
  therapy: "a therapist in Austin might only want their ads shown within 25 miles of their office",
  counselor: "a counselor might only want to reach people within driving distance of their practice",
  salon: "a hair salon typically draws clients from within 10–15 miles",
  spa: "a spa usually attracts clients within a short drive",
  gym: "a gym or fitness studio draws members from a 10–15 mile radius",
  fitness: "a fitness studio draws members from a 10–15 mile radius",
  yoga: "a yoga studio typically serves a local community within 10–15 miles",
  restaurant: "a restaurant usually draws diners from within 10 miles",
  cafe: "a coffee shop typically serves the surrounding neighborhood",
  bakery: "a bakery draws customers from the local area",
  dentist: "a dental practice serves patients within a reasonable drive",
  dental: "a dental practice serves patients within a reasonable drive",
  chiropractor: "a chiropractor typically sees patients who live or work nearby",
  attorney: "a law firm usually serves clients in their metro area",
  lawyer: "a law firm usually serves clients in their metro area",
  realtor: "a realtor focuses on buyers and sellers in specific neighborhoods",
  plumber: "a plumber typically serves customers within their service area",
  electrician: "an electrician typically serves a specific metro area",
  florist: "a flower shop usually delivers within a limited radius",
  veterinarian: "a vet clinic typically serves pet owners in the surrounding area",
  vet: "a vet clinic typically serves pet owners in the surrounding area",
  boutique: "a boutique draws shoppers from the local area",
  store: "a retail store draws foot traffic from the surrounding area",
  shop: "a local shop draws customers from the neighborhood",
  contractor: "a contractor typically takes jobs within a specific service area",
  photographer: "a photographer might focus on clients in their metro area",
  tattoo: "a tattoo studio typically draws clients from the surrounding area",
  barber: "a barbershop serves the local community",
};

const DEFAULT_EXAMPLE = "a local business might only want their ads shown to people within driving distance";

export function detectLocationBusiness(brand: any): { isLocal: boolean; example: string } {
  if (!brand) return { isLocal: false, example: DEFAULT_EXAMPLE };

  const fields = [
    brand.industry,
    brand.name,
    brand.value_proposition,
    brand.target_audience,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  for (const keyword of LOCATION_KEYWORDS) {
    if (fields.includes(keyword)) {
      const example = INDUSTRY_EXAMPLES[keyword] || DEFAULT_EXAMPLE;
      return { isLocal: true, example };
    }
  }

  return { isLocal: false, example: DEFAULT_EXAMPLE };
}
