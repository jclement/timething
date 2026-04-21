/**
 * Timezone catalog + search.
 *
 * The app lets the user find a zone by typing a city, country, IANA name,
 * or abbreviation. The search has two data sources:
 *
 *   1. A curated list of major cities (most of what users type)
 *   2. The browser's full IANA zone list (via Intl.supportedValuesOf),
 *      so obscure zones like "Pacific/Chatham" are still findable
 *
 * Each city has a tz (IANA identifier), display metadata, and aliases
 * covering common abbreviations (CST, GMT) and alternate spellings.
 */

import { formatOffset, zoneOffsetMinutes } from "./time";

export interface City {
  /** Display name — usually the city. */
  name: string;
  /** Country name for display. */
  country: string;
  /** ISO 3166-1 alpha-2 code for flag rendering / grouping. */
  countryCode: string;
  /** IANA time zone identifier. */
  tz: string;
  /** Extra search terms: state/province, abbreviations, alternate spellings. */
  aliases?: string[];
  /** Rough population in millions — used as a tiebreaker for search ranking. */
  population?: number;
}

export interface SearchHit {
  /** Stable identifier for the hit — either a city name + tz, or just a tz. */
  id: string;
  /** Primary display label, e.g. "Calgary, Canada". */
  label: string;
  /** Secondary line: "America/Edmonton · MDT / MST". */
  sublabel: string;
  /** IANA zone to use when this hit is selected. */
  tz: string;
  /** Short name the user picked — "Houston", "Riyadh" — used as the zone label. */
  name: string;
  /** Country name for display on the row; undefined for IANA-only hits. */
  country?: string;
  /** The matched substring for highlighting (future use). */
  match?: string;
}

// ---------------------------------------------------------------------------
// Curated city list
//
// Not exhaustive — just the cities people actually search for. Users can
// always fall back to typing the raw IANA name. Populations are rounded
// and only used for ranking; exact values don't matter.
// ---------------------------------------------------------------------------

export const CITIES: City[] = [
  // North America
  {
    name: "New York",
    country: "United States",
    countryCode: "US",
    tz: "America/New_York",
    aliases: ["NYC", "EST", "EDT", "Eastern Time", "New York City"],
    population: 8.3,
  },
  {
    name: "Los Angeles",
    country: "United States",
    countryCode: "US",
    tz: "America/Los_Angeles",
    aliases: ["LA", "PST", "PDT", "Pacific Time"],
    population: 3.9,
  },
  {
    name: "Chicago",
    country: "United States",
    countryCode: "US",
    tz: "America/Chicago",
    aliases: ["CST", "CDT", "Central Time"],
    population: 2.7,
  },
  {
    name: "Houston",
    country: "United States",
    countryCode: "US",
    tz: "America/Chicago",
    aliases: ["Texas", "CST", "CDT"],
    population: 2.3,
  },
  {
    name: "Dallas",
    country: "United States",
    countryCode: "US",
    tz: "America/Chicago",
    aliases: ["Texas", "CST", "CDT"],
    population: 1.3,
  },
  {
    name: "Denver",
    country: "United States",
    countryCode: "US",
    tz: "America/Denver",
    aliases: ["MST", "MDT", "Mountain Time", "Colorado"],
    population: 0.7,
  },
  {
    name: "Phoenix",
    country: "United States",
    countryCode: "US",
    tz: "America/Phoenix",
    aliases: ["MST", "Arizona", "no DST"],
    population: 1.6,
  },
  {
    name: "Seattle",
    country: "United States",
    countryCode: "US",
    tz: "America/Los_Angeles",
    aliases: ["PST", "PDT", "Washington"],
    population: 0.7,
  },
  {
    name: "San Francisco",
    country: "United States",
    countryCode: "US",
    tz: "America/Los_Angeles",
    aliases: ["SF", "PST", "PDT", "Bay Area"],
    population: 0.9,
  },
  {
    name: "Miami",
    country: "United States",
    countryCode: "US",
    tz: "America/New_York",
    aliases: ["EST", "EDT", "Florida"],
    population: 0.5,
  },
  {
    name: "Atlanta",
    country: "United States",
    countryCode: "US",
    tz: "America/New_York",
    aliases: ["EST", "EDT", "Georgia"],
    population: 0.5,
  },
  {
    name: "Boston",
    country: "United States",
    countryCode: "US",
    tz: "America/New_York",
    aliases: ["EST", "EDT", "Massachusetts"],
    population: 0.7,
  },
  {
    name: "Washington DC",
    country: "United States",
    countryCode: "US",
    tz: "America/New_York",
    aliases: ["DC", "EST", "EDT"],
    population: 0.7,
  },
  {
    name: "Honolulu",
    country: "United States",
    countryCode: "US",
    tz: "Pacific/Honolulu",
    aliases: ["Hawaii", "HST"],
    population: 0.4,
  },
  {
    name: "Anchorage",
    country: "United States",
    countryCode: "US",
    tz: "America/Anchorage",
    aliases: ["Alaska", "AKST", "AKDT"],
    population: 0.3,
  },

  {
    name: "Toronto",
    country: "Canada",
    countryCode: "CA",
    tz: "America/Toronto",
    aliases: ["Ontario", "EST", "EDT"],
    population: 2.9,
  },
  {
    name: "Montreal",
    country: "Canada",
    countryCode: "CA",
    tz: "America/Toronto",
    aliases: ["Quebec", "EST", "EDT"],
    population: 1.8,
  },
  {
    name: "Ottawa",
    country: "Canada",
    countryCode: "CA",
    tz: "America/Toronto",
    aliases: ["Ontario", "EST", "EDT"],
    population: 1.0,
  },
  {
    name: "Calgary",
    country: "Canada",
    countryCode: "CA",
    tz: "America/Edmonton",
    aliases: ["Alberta", "MST", "MDT"],
    population: 1.3,
  },
  {
    name: "Edmonton",
    country: "Canada",
    countryCode: "CA",
    tz: "America/Edmonton",
    aliases: ["Alberta", "MST", "MDT"],
    population: 1.0,
  },
  {
    name: "Vancouver",
    country: "Canada",
    countryCode: "CA",
    tz: "America/Vancouver",
    aliases: ["BC", "British Columbia", "PST", "PDT"],
    population: 0.7,
  },
  {
    name: "Winnipeg",
    country: "Canada",
    countryCode: "CA",
    tz: "America/Winnipeg",
    aliases: ["Manitoba", "CST", "CDT"],
    population: 0.7,
  },
  {
    name: "Halifax",
    country: "Canada",
    countryCode: "CA",
    tz: "America/Halifax",
    aliases: ["Nova Scotia", "AST", "ADT", "Atlantic Time"],
    population: 0.4,
  },
  {
    name: "St. John's",
    country: "Canada",
    countryCode: "CA",
    tz: "America/St_Johns",
    aliases: ["Newfoundland", "NST", "NDT"],
    population: 0.1,
  },

  {
    name: "Mexico City",
    country: "Mexico",
    countryCode: "MX",
    tz: "America/Mexico_City",
    aliases: ["CDMX", "CST", "CDT"],
    population: 9.2,
  },
  {
    name: "Guadalajara",
    country: "Mexico",
    countryCode: "MX",
    tz: "America/Mexico_City",
    aliases: ["Jalisco"],
    population: 1.5,
  },
  {
    name: "Tijuana",
    country: "Mexico",
    countryCode: "MX",
    tz: "America/Tijuana",
    aliases: ["Baja California"],
    population: 1.9,
  },
  {
    name: "Cancún",
    country: "Mexico",
    countryCode: "MX",
    tz: "America/Cancun",
    aliases: ["Cancun", "Quintana Roo", "EST"],
    population: 0.9,
  },

  // South America
  {
    name: "São Paulo",
    country: "Brazil",
    countryCode: "BR",
    tz: "America/Sao_Paulo",
    aliases: ["Sao Paulo", "BRT"],
    population: 12.3,
  },
  {
    name: "Rio de Janeiro",
    country: "Brazil",
    countryCode: "BR",
    tz: "America/Sao_Paulo",
    aliases: ["Rio", "BRT"],
    population: 6.7,
  },
  {
    name: "Brasília",
    country: "Brazil",
    countryCode: "BR",
    tz: "America/Sao_Paulo",
    aliases: ["Brasilia", "BRT"],
    population: 3.1,
  },
  {
    name: "Buenos Aires",
    country: "Argentina",
    countryCode: "AR",
    tz: "America/Argentina/Buenos_Aires",
    aliases: ["ART"],
    population: 3.1,
  },
  {
    name: "Santiago",
    country: "Chile",
    countryCode: "CL",
    tz: "America/Santiago",
    aliases: ["CLT", "CLST"],
    population: 6.2,
  },
  {
    name: "Lima",
    country: "Peru",
    countryCode: "PE",
    tz: "America/Lima",
    aliases: ["PET"],
    population: 10.0,
  },
  {
    name: "Bogotá",
    country: "Colombia",
    countryCode: "CO",
    tz: "America/Bogota",
    aliases: ["Bogota", "COT"],
    population: 7.4,
  },
  {
    name: "Caracas",
    country: "Venezuela",
    countryCode: "VE",
    tz: "America/Caracas",
    aliases: ["VET"],
    population: 2.1,
  },
  {
    name: "Quito",
    country: "Ecuador",
    countryCode: "EC",
    tz: "America/Guayaquil",
    aliases: ["ECT"],
    population: 1.9,
  },
  {
    name: "La Paz",
    country: "Bolivia",
    countryCode: "BO",
    tz: "America/La_Paz",
    aliases: ["BOT"],
    population: 0.8,
  },
  {
    name: "Montevideo",
    country: "Uruguay",
    countryCode: "UY",
    tz: "America/Montevideo",
    aliases: ["UYT"],
    population: 1.3,
  },
  {
    name: "Asunción",
    country: "Paraguay",
    countryCode: "PY",
    tz: "America/Asuncion",
    aliases: ["Asuncion", "PYT"],
    population: 0.5,
  },

  // Europe
  {
    name: "London",
    country: "United Kingdom",
    countryCode: "GB",
    tz: "Europe/London",
    aliases: ["UK", "GMT", "BST"],
    population: 9.0,
  },
  {
    name: "Dublin",
    country: "Ireland",
    countryCode: "IE",
    tz: "Europe/Dublin",
    aliases: ["GMT", "IST"],
    population: 1.4,
  },
  {
    name: "Paris",
    country: "France",
    countryCode: "FR",
    tz: "Europe/Paris",
    aliases: ["CET", "CEST"],
    population: 2.2,
  },
  {
    name: "Berlin",
    country: "Germany",
    countryCode: "DE",
    tz: "Europe/Berlin",
    aliases: ["CET", "CEST"],
    population: 3.7,
  },
  {
    name: "Munich",
    country: "Germany",
    countryCode: "DE",
    tz: "Europe/Berlin",
    aliases: ["Bavaria", "CET", "CEST"],
    population: 1.5,
  },
  {
    name: "Frankfurt",
    country: "Germany",
    countryCode: "DE",
    tz: "Europe/Berlin",
    aliases: ["CET", "CEST"],
    population: 0.8,
  },
  {
    name: "Madrid",
    country: "Spain",
    countryCode: "ES",
    tz: "Europe/Madrid",
    aliases: ["CET", "CEST"],
    population: 3.3,
  },
  {
    name: "Barcelona",
    country: "Spain",
    countryCode: "ES",
    tz: "Europe/Madrid",
    aliases: ["Catalonia", "CET", "CEST"],
    population: 1.6,
  },
  {
    name: "Rome",
    country: "Italy",
    countryCode: "IT",
    tz: "Europe/Rome",
    aliases: ["CET", "CEST"],
    population: 2.9,
  },
  {
    name: "Milan",
    country: "Italy",
    countryCode: "IT",
    tz: "Europe/Rome",
    aliases: ["CET", "CEST"],
    population: 1.4,
  },
  {
    name: "Amsterdam",
    country: "Netherlands",
    countryCode: "NL",
    tz: "Europe/Amsterdam",
    aliases: ["CET", "CEST"],
    population: 0.9,
  },
  {
    name: "Brussels",
    country: "Belgium",
    countryCode: "BE",
    tz: "Europe/Brussels",
    aliases: ["CET", "CEST"],
    population: 1.2,
  },
  {
    name: "Zurich",
    country: "Switzerland",
    countryCode: "CH",
    tz: "Europe/Zurich",
    aliases: ["CET", "CEST"],
    population: 0.4,
  },
  {
    name: "Geneva",
    country: "Switzerland",
    countryCode: "CH",
    tz: "Europe/Zurich",
    aliases: ["CET", "CEST"],
    population: 0.2,
  },
  {
    name: "Vienna",
    country: "Austria",
    countryCode: "AT",
    tz: "Europe/Vienna",
    aliases: ["CET", "CEST"],
    population: 2.0,
  },
  {
    name: "Prague",
    country: "Czechia",
    countryCode: "CZ",
    tz: "Europe/Prague",
    aliases: ["CET", "CEST", "Czech Republic"],
    population: 1.3,
  },
  {
    name: "Warsaw",
    country: "Poland",
    countryCode: "PL",
    tz: "Europe/Warsaw",
    aliases: ["CET", "CEST"],
    population: 1.8,
  },
  {
    name: "Stockholm",
    country: "Sweden",
    countryCode: "SE",
    tz: "Europe/Stockholm",
    aliases: ["CET", "CEST"],
    population: 1.0,
  },
  {
    name: "Oslo",
    country: "Norway",
    countryCode: "NO",
    tz: "Europe/Oslo",
    aliases: ["CET", "CEST"],
    population: 0.7,
  },
  {
    name: "Copenhagen",
    country: "Denmark",
    countryCode: "DK",
    tz: "Europe/Copenhagen",
    aliases: ["CET", "CEST"],
    population: 0.7,
  },
  {
    name: "Helsinki",
    country: "Finland",
    countryCode: "FI",
    tz: "Europe/Helsinki",
    aliases: ["EET", "EEST"],
    population: 0.7,
  },
  {
    name: "Reykjavik",
    country: "Iceland",
    countryCode: "IS",
    tz: "Atlantic/Reykjavik",
    aliases: ["GMT"],
    population: 0.1,
  },
  {
    name: "Lisbon",
    country: "Portugal",
    countryCode: "PT",
    tz: "Europe/Lisbon",
    aliases: ["WET", "WEST"],
    population: 0.5,
  },
  {
    name: "Athens",
    country: "Greece",
    countryCode: "GR",
    tz: "Europe/Athens",
    aliases: ["EET", "EEST"],
    population: 3.2,
  },
  {
    name: "Istanbul",
    country: "Türkiye",
    countryCode: "TR",
    tz: "Europe/Istanbul",
    aliases: ["Turkey", "TRT"],
    population: 15.4,
  },
  {
    name: "Moscow",
    country: "Russia",
    countryCode: "RU",
    tz: "Europe/Moscow",
    aliases: ["MSK"],
    population: 12.6,
  },
  {
    name: "St. Petersburg",
    country: "Russia",
    countryCode: "RU",
    tz: "Europe/Moscow",
    aliases: ["MSK"],
    population: 5.4,
  },
  {
    name: "Kyiv",
    country: "Ukraine",
    countryCode: "UA",
    tz: "Europe/Kyiv",
    aliases: ["Kiev", "EET", "EEST"],
    population: 3.0,
  },
  {
    name: "Budapest",
    country: "Hungary",
    countryCode: "HU",
    tz: "Europe/Budapest",
    aliases: ["CET", "CEST"],
    population: 1.7,
  },
  {
    name: "Bucharest",
    country: "Romania",
    countryCode: "RO",
    tz: "Europe/Bucharest",
    aliases: ["EET", "EEST"],
    population: 1.8,
  },

  // Middle East
  {
    name: "Dubai",
    country: "United Arab Emirates",
    countryCode: "AE",
    tz: "Asia/Dubai",
    aliases: ["UAE", "GST"],
    population: 3.6,
  },
  {
    name: "Abu Dhabi",
    country: "United Arab Emirates",
    countryCode: "AE",
    tz: "Asia/Dubai",
    aliases: ["UAE", "GST"],
    population: 1.5,
  },
  {
    name: "Riyadh",
    country: "Saudi Arabia",
    countryCode: "SA",
    tz: "Asia/Riyadh",
    aliases: ["AST", "Saudi", "KSA"],
    population: 7.7,
  },
  {
    name: "Jeddah",
    country: "Saudi Arabia",
    countryCode: "SA",
    tz: "Asia/Riyadh",
    aliases: ["AST"],
    population: 4.7,
  },
  {
    name: "Dhahran",
    country: "Saudi Arabia",
    countryCode: "SA",
    tz: "Asia/Riyadh",
    aliases: ["AST", "Eastern Province"],
    population: 0.2,
  },
  {
    name: "Doha",
    country: "Qatar",
    countryCode: "QA",
    tz: "Asia/Qatar",
    aliases: ["AST"],
    population: 2.4,
  },
  {
    name: "Kuwait City",
    country: "Kuwait",
    countryCode: "KW",
    tz: "Asia/Kuwait",
    aliases: ["AST"],
    population: 3.1,
  },
  {
    name: "Manama",
    country: "Bahrain",
    countryCode: "BH",
    tz: "Asia/Bahrain",
    aliases: ["AST"],
    population: 0.7,
  },
  {
    name: "Muscat",
    country: "Oman",
    countryCode: "OM",
    tz: "Asia/Muscat",
    aliases: ["GST"],
    population: 1.6,
  },
  {
    name: "Tel Aviv",
    country: "Israel",
    countryCode: "IL",
    tz: "Asia/Jerusalem",
    aliases: ["IST", "IDT"],
    population: 0.5,
  },
  {
    name: "Jerusalem",
    country: "Israel",
    countryCode: "IL",
    tz: "Asia/Jerusalem",
    aliases: ["IST", "IDT"],
    population: 0.9,
  },
  {
    name: "Amman",
    country: "Jordan",
    countryCode: "JO",
    tz: "Asia/Amman",
    aliases: ["EET", "EEST"],
    population: 4.1,
  },
  {
    name: "Beirut",
    country: "Lebanon",
    countryCode: "LB",
    tz: "Asia/Beirut",
    aliases: ["EET", "EEST"],
    population: 2.4,
  },
  {
    name: "Tehran",
    country: "Iran",
    countryCode: "IR",
    tz: "Asia/Tehran",
    aliases: ["IRST", "IRDT"],
    population: 8.7,
  },
  {
    name: "Baghdad",
    country: "Iraq",
    countryCode: "IQ",
    tz: "Asia/Baghdad",
    aliases: ["AST"],
    population: 7.1,
  },

  // Africa
  {
    name: "Cairo",
    country: "Egypt",
    countryCode: "EG",
    tz: "Africa/Cairo",
    aliases: ["EET", "EEST"],
    population: 21.3,
  },
  {
    name: "Lagos",
    country: "Nigeria",
    countryCode: "NG",
    tz: "Africa/Lagos",
    aliases: ["WAT"],
    population: 15.4,
  },
  {
    name: "Nairobi",
    country: "Kenya",
    countryCode: "KE",
    tz: "Africa/Nairobi",
    aliases: ["EAT"],
    population: 4.9,
  },
  {
    name: "Johannesburg",
    country: "South Africa",
    countryCode: "ZA",
    tz: "Africa/Johannesburg",
    aliases: ["SAST"],
    population: 5.6,
  },
  {
    name: "Cape Town",
    country: "South Africa",
    countryCode: "ZA",
    tz: "Africa/Johannesburg",
    aliases: ["SAST"],
    population: 4.6,
  },
  {
    name: "Casablanca",
    country: "Morocco",
    countryCode: "MA",
    tz: "Africa/Casablanca",
    aliases: ["WET", "WEST"],
    population: 3.7,
  },
  {
    name: "Algiers",
    country: "Algeria",
    countryCode: "DZ",
    tz: "Africa/Algiers",
    aliases: ["CET"],
    population: 2.8,
  },
  {
    name: "Tunis",
    country: "Tunisia",
    countryCode: "TN",
    tz: "Africa/Tunis",
    aliases: ["CET"],
    population: 1.1,
  },
  {
    name: "Addis Ababa",
    country: "Ethiopia",
    countryCode: "ET",
    tz: "Africa/Addis_Ababa",
    aliases: ["EAT"],
    population: 5.0,
  },
  {
    name: "Dakar",
    country: "Senegal",
    countryCode: "SN",
    tz: "Africa/Dakar",
    aliases: ["GMT"],
    population: 2.6,
  },
  {
    name: "Accra",
    country: "Ghana",
    countryCode: "GH",
    tz: "Africa/Accra",
    aliases: ["GMT"],
    population: 2.5,
  },

  // Asia (South, Southeast)
  {
    name: "Mumbai",
    country: "India",
    countryCode: "IN",
    tz: "Asia/Kolkata",
    aliases: ["IST", "Bombay"],
    population: 20.7,
  },
  {
    name: "Delhi",
    country: "India",
    countryCode: "IN",
    tz: "Asia/Kolkata",
    aliases: ["IST", "New Delhi"],
    population: 32.1,
  },
  {
    name: "Bangalore",
    country: "India",
    countryCode: "IN",
    tz: "Asia/Kolkata",
    aliases: ["IST", "Bengaluru"],
    population: 13.6,
  },
  {
    name: "Chennai",
    country: "India",
    countryCode: "IN",
    tz: "Asia/Kolkata",
    aliases: ["IST", "Madras"],
    population: 11.5,
  },
  {
    name: "Kolkata",
    country: "India",
    countryCode: "IN",
    tz: "Asia/Kolkata",
    aliases: ["IST", "Calcutta"],
    population: 15.3,
  },
  {
    name: "Hyderabad",
    country: "India",
    countryCode: "IN",
    tz: "Asia/Kolkata",
    aliases: ["IST"],
    population: 10.5,
  },
  {
    name: "Karachi",
    country: "Pakistan",
    countryCode: "PK",
    tz: "Asia/Karachi",
    aliases: ["PKT"],
    population: 16.8,
  },
  {
    name: "Lahore",
    country: "Pakistan",
    countryCode: "PK",
    tz: "Asia/Karachi",
    aliases: ["PKT"],
    population: 13.5,
  },
  {
    name: "Islamabad",
    country: "Pakistan",
    countryCode: "PK",
    tz: "Asia/Karachi",
    aliases: ["PKT"],
    population: 1.0,
  },
  {
    name: "Dhaka",
    country: "Bangladesh",
    countryCode: "BD",
    tz: "Asia/Dhaka",
    aliases: ["BST"],
    population: 22.5,
  },
  {
    name: "Colombo",
    country: "Sri Lanka",
    countryCode: "LK",
    tz: "Asia/Colombo",
    aliases: ["IST"],
    population: 0.8,
  },
  {
    name: "Kathmandu",
    country: "Nepal",
    countryCode: "NP",
    tz: "Asia/Kathmandu",
    aliases: ["NPT"],
    population: 1.5,
  },
  {
    name: "Kabul",
    country: "Afghanistan",
    countryCode: "AF",
    tz: "Asia/Kabul",
    aliases: ["AFT"],
    population: 4.6,
  },

  {
    name: "Bangkok",
    country: "Thailand",
    countryCode: "TH",
    tz: "Asia/Bangkok",
    aliases: ["ICT"],
    population: 10.7,
  },
  {
    name: "Jakarta",
    country: "Indonesia",
    countryCode: "ID",
    tz: "Asia/Jakarta",
    aliases: ["WIB"],
    population: 11.2,
  },
  {
    name: "Bali",
    country: "Indonesia",
    countryCode: "ID",
    tz: "Asia/Makassar",
    aliases: ["WITA", "Denpasar"],
    population: 0.9,
  },
  {
    name: "Manila",
    country: "Philippines",
    countryCode: "PH",
    tz: "Asia/Manila",
    aliases: ["PHT"],
    population: 13.9,
  },
  {
    name: "Hanoi",
    country: "Vietnam",
    countryCode: "VN",
    tz: "Asia/Bangkok",
    aliases: ["ICT"],
    population: 8.1,
  },
  {
    name: "Ho Chi Minh City",
    country: "Vietnam",
    countryCode: "VN",
    tz: "Asia/Ho_Chi_Minh",
    aliases: ["Saigon", "ICT"],
    population: 9.3,
  },
  {
    name: "Kuala Lumpur",
    country: "Malaysia",
    countryCode: "MY",
    tz: "Asia/Kuala_Lumpur",
    aliases: ["MYT", "KL"],
    population: 8.0,
  },
  {
    name: "Singapore",
    country: "Singapore",
    countryCode: "SG",
    tz: "Asia/Singapore",
    aliases: ["SGT"],
    population: 5.6,
  },
  {
    name: "Yangon",
    country: "Myanmar",
    countryCode: "MM",
    tz: "Asia/Yangon",
    aliases: ["MMT", "Rangoon"],
    population: 5.2,
  },
  {
    name: "Phnom Penh",
    country: "Cambodia",
    countryCode: "KH",
    tz: "Asia/Phnom_Penh",
    aliases: ["ICT"],
    population: 2.1,
  },

  // Asia (East)
  {
    name: "Tokyo",
    country: "Japan",
    countryCode: "JP",
    tz: "Asia/Tokyo",
    aliases: ["JST"],
    population: 37.0,
  },
  {
    name: "Osaka",
    country: "Japan",
    countryCode: "JP",
    tz: "Asia/Tokyo",
    aliases: ["JST"],
    population: 19.0,
  },
  {
    name: "Seoul",
    country: "South Korea",
    countryCode: "KR",
    tz: "Asia/Seoul",
    aliases: ["KST"],
    population: 9.8,
  },
  {
    name: "Beijing",
    country: "China",
    countryCode: "CN",
    tz: "Asia/Shanghai",
    aliases: ["CST", "China Standard Time"],
    population: 21.9,
  },
  {
    name: "Shanghai",
    country: "China",
    countryCode: "CN",
    tz: "Asia/Shanghai",
    aliases: ["CST"],
    population: 24.9,
  },
  {
    name: "Shenzhen",
    country: "China",
    countryCode: "CN",
    tz: "Asia/Shanghai",
    aliases: ["CST"],
    population: 17.6,
  },
  {
    name: "Guangzhou",
    country: "China",
    countryCode: "CN",
    tz: "Asia/Shanghai",
    aliases: ["Canton", "CST"],
    population: 15.3,
  },
  {
    name: "Hong Kong",
    country: "Hong Kong",
    countryCode: "HK",
    tz: "Asia/Hong_Kong",
    aliases: ["HKT"],
    population: 7.5,
  },
  {
    name: "Taipei",
    country: "Taiwan",
    countryCode: "TW",
    tz: "Asia/Taipei",
    aliases: ["CST", "Taiwan"],
    population: 2.7,
  },
  {
    name: "Ulaanbaatar",
    country: "Mongolia",
    countryCode: "MN",
    tz: "Asia/Ulaanbaatar",
    aliases: ["ULAT"],
    population: 1.6,
  },

  // Central Asia / Russia east
  {
    name: "Tashkent",
    country: "Uzbekistan",
    countryCode: "UZ",
    tz: "Asia/Tashkent",
    aliases: ["UZT"],
    population: 2.6,
  },
  {
    name: "Almaty",
    country: "Kazakhstan",
    countryCode: "KZ",
    tz: "Asia/Almaty",
    aliases: ["ALMT"],
    population: 2.0,
  },
  {
    name: "Vladivostok",
    country: "Russia",
    countryCode: "RU",
    tz: "Asia/Vladivostok",
    aliases: ["VLAT"],
    population: 0.6,
  },
  {
    name: "Novosibirsk",
    country: "Russia",
    countryCode: "RU",
    tz: "Asia/Novosibirsk",
    aliases: ["NOVT"],
    population: 1.6,
  },

  // Oceania
  {
    name: "Sydney",
    country: "Australia",
    countryCode: "AU",
    tz: "Australia/Sydney",
    aliases: ["AEST", "AEDT", "NSW"],
    population: 5.4,
  },
  {
    name: "Melbourne",
    country: "Australia",
    countryCode: "AU",
    tz: "Australia/Melbourne",
    aliases: ["AEST", "AEDT", "Victoria"],
    population: 5.2,
  },
  {
    name: "Brisbane",
    country: "Australia",
    countryCode: "AU",
    tz: "Australia/Brisbane",
    aliases: ["AEST", "Queensland"],
    population: 2.6,
  },
  {
    name: "Perth",
    country: "Australia",
    countryCode: "AU",
    tz: "Australia/Perth",
    aliases: ["AWST", "Western Australia"],
    population: 2.2,
  },
  {
    name: "Adelaide",
    country: "Australia",
    countryCode: "AU",
    tz: "Australia/Adelaide",
    aliases: ["ACST", "ACDT", "South Australia"],
    population: 1.4,
  },
  {
    name: "Darwin",
    country: "Australia",
    countryCode: "AU",
    tz: "Australia/Darwin",
    aliases: ["ACST", "Northern Territory"],
    population: 0.1,
  },
  {
    name: "Hobart",
    country: "Australia",
    countryCode: "AU",
    tz: "Australia/Hobart",
    aliases: ["AEST", "AEDT", "Tasmania"],
    population: 0.2,
  },
  {
    name: "Auckland",
    country: "New Zealand",
    countryCode: "NZ",
    tz: "Pacific/Auckland",
    aliases: ["NZST", "NZDT", "NZ"],
    population: 1.7,
  },
  {
    name: "Wellington",
    country: "New Zealand",
    countryCode: "NZ",
    tz: "Pacific/Auckland",
    aliases: ["NZST", "NZDT"],
    population: 0.4,
  },
  {
    name: "Fiji",
    country: "Fiji",
    countryCode: "FJ",
    tz: "Pacific/Fiji",
    aliases: ["FJT", "Suva"],
    population: 0.2,
  },

  // UTC meta-zone
  {
    name: "UTC",
    country: "Coordinated Universal Time",
    countryCode: "--",
    tz: "UTC",
    aliases: ["GMT", "Zulu", "Z"],
  },
];

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/**
 * Search the city catalog + full IANA list for matches.
 *
 * Scoring:
 *   - Exact prefix match on name    = highest
 *   - Word-start match on name      = high
 *   - Prefix on alias/country       = medium
 *   - Substring anywhere            = low
 *   - IANA-only (no city) matches   = lowest
 *
 * Population is used as a tiebreaker among equal-score hits so typing
 * "san" surfaces San Francisco ahead of San Juan.
 */
export function searchZones(query: string, limit = 12): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return [];

  const scored: { hit: SearchHit; score: number; pop: number }[] = [];

  for (const city of CITIES) {
    const score = scoreCity(city, q);
    if (score > 0) {
      scored.push({
        hit: {
          id: `${city.name}|${city.tz}`,
          label: `${city.name}, ${city.country}`,
          sublabel: formatZoneSublabel(city.tz),
          tz: city.tz,
          name: city.name,
          country: city.country,
        },
        score,
        pop: city.population ?? 0,
      });
    }
  }

  // Dedupe cities that have already been matched by tz if the user typed
  // the IANA name directly — handled below when we add IANA fallback hits.
  const matchedTzs = new Set(scored.map((s) => s.hit.tz));

  for (const tz of getAllIanaZones()) {
    if (matchedTzs.has(tz)) continue;
    if (tz.toLowerCase().includes(q)) {
      scored.push({
        hit: {
          id: tz,
          label: humanizeIana(tz),
          sublabel: formatZoneSublabel(tz),
          tz,
          name: shortNameFromIana(tz),
        },
        score: 5, // lower than curated matches
        pop: 0,
      });
    }
  }

  scored.sort(
    (a, b) => b.score - a.score || b.pop - a.pop || a.hit.label.localeCompare(b.hit.label),
  );
  return scored.slice(0, limit).map((s) => s.hit);
}

function scoreCity(city: City, q: string): number {
  const name = city.name.toLowerCase();
  const country = city.country.toLowerCase();
  const tz = city.tz.toLowerCase();

  if (name === q) return 100;
  if (name.startsWith(q)) return 90;
  if (startsAtWord(name, q)) return 80;
  if (country.startsWith(q)) return 70;
  if (startsAtWord(country, q)) return 60;

  for (const a of city.aliases ?? []) {
    const al = a.toLowerCase();
    if (al === q) return 75;
    if (al.startsWith(q)) return 55;
    if (startsAtWord(al, q)) return 45;
  }

  if (tz.includes(q)) return 30;
  if (name.includes(q)) return 20;
  if (country.includes(q)) return 15;
  for (const a of city.aliases ?? []) {
    if (a.toLowerCase().includes(q)) return 10;
  }
  return 0;
}

function startsAtWord(haystack: string, needle: string): boolean {
  const idx = haystack.indexOf(needle);
  if (idx < 0) return false;
  if (idx === 0) return true;
  const prev = haystack[idx - 1];
  return /[\s/_-]/.test(prev);
}

/**
 * Turn "America/Argentina/Buenos_Aires" into "Buenos Aires, Argentina (America)".
 * Rough heuristic for display when we have no curated city entry.
 */
export function humanizeIana(tz: string): string {
  const parts = tz.split("/").map((p) => p.replace(/_/g, " "));
  if (parts.length === 1) return parts[0];
  const city = parts[parts.length - 1];
  const region = parts[0];
  return `${city} · ${region}`;
}

/** Just the city segment of an IANA name: "America/Los_Angeles" → "Los Angeles". */
export function shortNameFromIana(tz: string): string {
  const parts = tz.split("/");
  return parts[parts.length - 1].replace(/_/g, " ");
}

// Cache the IANA list — Intl.supportedValuesOf is cheap but called on every keystroke.
let _ianaCache: string[] | null = null;
function getAllIanaZones(): string[] {
  if (_ianaCache) return _ianaCache;
  try {
    _ianaCache = Intl.supportedValuesOf("timeZone");
  } catch {
    _ianaCache = [];
  }
  return _ianaCache;
}

// ---------------------------------------------------------------------------
// Zone metadata helpers
// ---------------------------------------------------------------------------

/**
 * Build a short subtitle line for a zone, like "America/Edmonton · MDT".
 * The abbreviation comes from Intl and so reflects the current moment's
 * DST state, which is the most useful thing to show in a picker.
 */
export function formatZoneSublabel(tz: string, at: Date = new Date()): string {
  return `${tz} · ${zoneAbbreviation(tz, at)}`;
}

/**
 * Return the zone's current identifier for display: always the UTC
 * offset in `UTC±H(:MM)` form, optionally followed by a named
 * abbreviation in parens when Intl knows one (e.g. `UTC-4 (EDT)`,
 * `UTC+2 (CEST)`, `UTC+9 (JST)`).
 *
 * Offset-always keeps the output consistent across every zone; the
 * named suffix adds the familiar label when it exists, without lying
 * when it doesn't. Intl's generic `GMT±N` fallback is suppressed here
 * — if Intl can't offer a real name, we don't fabricate one.
 */
export function zoneAbbreviation(tz: string, at: Date = new Date()): string {
  const offset = formatOffset(zoneOffsetMinutes(at, tz));
  const named = namedAbbreviation(tz, at);
  return named ? `${offset} (${named})` : offset;
}

/**
 * Ask Intl for the zone's short-name ("EDT", "CEST"). Returns null
 * when Intl only produces the generic `GMT±N` fallback (e.g., for
 * Asia/Kolkata in Chrome).
 */
function namedAbbreviation(tz: string, at: Date): string | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "short",
    }).formatToParts(at);
    const raw = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
    return /^[A-Z]{2,6}$/.test(raw) ? raw : null;
  } catch {
    return null;
  }
}

/** The browser's detected IANA zone, or UTC as a fallback. */
export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** First curated city for a given tz, used when we want a nicer label than the IANA name. */
export function firstCityForTz(tz: string): City | undefined {
  return CITIES.find((c) => c.tz === tz);
}

/**
 * Resolve a zone's display name, honoring the user's chosen label before
 * falling back to the first curated city or the raw IANA segment. Used
 * anywhere we render a zone — grid row, mobile column, validity bar, PDF.
 *
 * The home zone stores its user label in `homeLabelOverride` rather than
 * on the ZoneConfig, so pass it explicitly when rendering the home row.
 */
export function resolveZoneName(
  zone: { tz: string; label?: string },
  homeLabelOverride?: string,
): string {
  if (homeLabelOverride) return homeLabelOverride;
  if (zone.label) return zone.label;
  const city = firstCityForTz(zone.tz);
  if (city) return city.name;
  return humanizeIana(zone.tz);
}
