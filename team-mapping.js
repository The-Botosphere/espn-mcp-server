/**
 * ESPN TEAM ID MAPPINGS
 * Maps school names/abbreviations to ESPN team IDs
 * Used to fetch schedules, scores, and stats
 */

export const TEAM_MAPPINGS = {
  // Big 12 Schools
  "oklahoma": 201,
  "ou": 201,
  "sooners": 201,
  "oklahoma-sooners": 201,
  
  "texas": 251,
  "ut": 251,
  "longhorns": 251,
  "texas-longhorns": 251,
  
  "oklahoma-state": 197,
  "osu": 197,
  "okstate": 197,
  "cowboys": 197,
  
  "texas-tech": 2641,
  "ttu": 2641,
  "red-raiders": 2641,
  
  "baylor": 239,
  "bears": 239,
  
  "tcu": 2628,
  "horned-frogs": 2628,
  
  "kansas": 2305,
  "ku": 2305,
  "jayhawks": 2305,
  
  "kansas-state": 2306,
  "ksu": 2306,
  "k-state": 2306,
  "wildcats": 2306,
  
  "iowa-state": 66,
  "cyclones": 66,
  
  "west-virginia": 277,
  "wvu": 277,
  "mountaineers": 277,
  
  // SEC Schools
  "alabama": 333,
  "bama": 333,
  "crimson-tide": 333,
  
  "georgia": 61,
  "uga": 61,
  "bulldogs": 61,
  
  "lsu": 99,
  "tigers-lsu": 99,
  
  "tennessee": 2633,
  "vols": 2633,
  "volunteers": 2633,
  
  "florida": 57,
  "gators": 57,
  
  "auburn": 2,
  "tigers-auburn": 2,
  
  "texas-am": 245,
  "tamu": 245,
  "aggies": 245,
  
  "ole-miss": 145,
  "mississippi": 145,
  "rebels": 145,
  
  "mississippi-state": 344,
  "msu": 344,
  "bulldogs-msu": 344,
  
  "arkansas": 8,
  "razorbacks": 8,
  
  "missouri": 142,
  "mizzou": 142,
  
  "south-carolina": 2579,
  "gamecocks": 2579,
  
  "kentucky": 96,
  "wildcats-uk": 96,
  
  "vanderbilt": 238,
  "vandy": 238,
  "commodores": 238,
  
  // Big Ten Schools
  "ohio-state": 194,
  "osu-buckeyes": 194,
  "buckeyes": 194,
  
  "michigan": 130,
  "wolverines": 130,
  
  "penn-state": 213,
  "psu": 213,
  "nittany-lions": 213,
  
  "wisconsin": 275,
  "badgers": 275,
  
  "oregon": 2483,
  "ducks": 2483,
  
  "usc": 30,
  "trojans": 30,
  "southern-cal": 30,
  
  "washington": 264,
  "huskies": 264,
  
  "ucla": 26,
  "bruins": 26,
  
  "nebraska": 158,
  "huskers": 158,
  
  "iowa": 2294,
  "hawkeyes": 2294,
  
  "michigan-state": 127,
  "spartans": 127,
  
  "minnesota": 135,
  "gophers": 135,
  
  "maryland": 120,
  "terrapins": 120,
  "terps": 120,
  
  "rutgers": 164,
  "scarlet-knights": 164,
  
  "illinois": 356,
  "fighting-illini": 356,
  
  "northwestern": 77,
  "wildcats-nw": 77,
  
  "purdue": 2509,
  "boilermakers": 2509,
  
  "indiana": 84,
  "hoosiers": 84,
  
  // ACC Schools
  "clemson": 228,
  "tigers-clemson": 228,
  
  "miami": 2390,
  "hurricanes": 2390,
  
  "florida-state": 52,
  "fsu": 52,
  "seminoles": 52,
  
  "notre-dame": 87,
  "nd": 87,
  "fighting-irish": 87,
  
  "duke": 150,
  "blue-devils": 150,
  
  "north-carolina": 153,
  "unc": 153,
  "tar-heels": 153,
  
  "nc-state": 152,
  "wolfpack": 152,
  
  "virginia": 258,
  "uva": 258,
  "cavaliers": 258,
  
  "virginia-tech": 259,
  "vt": 259,
  "hokies": 259,
  
  "pittsburgh": 221,
  "pitt": 221,
  "panthers": 221,
  
  "louisville": 97,
  "cards": 97,
  "cardinals": 97,
  
  "georgia-tech": 59,
  "gt": 59,
  "yellow-jackets": 59,
  
  "boston-college": 103,
  "bc": 103,
  "eagles": 103,
  
  "syracuse": 183,
  "orange": 183,
  
  "wake-forest": 154,
  "demon-deacons": 154
};

/**
 * SPORT MAPPINGS
 * Maps sport names to ESPN API paths
 */
export const SPORT_MAPPINGS = {
  "football": {
    path: "football/college-football",
    name: "Football"
  },
  "mens-basketball": {
    path: "basketball/mens-college-basketball",
    name: "Men's Basketball"
  },
  "womens-basketball": {
    path: "basketball/womens-college-basketball",
    name: "Women's Basketball"
  },
  "baseball": {
    path: "baseball/college-baseball",
    name: "Baseball"
  },
  "softball": {
    path: "softball/college-softball",
    name: "Softball"
  }
};

/**
 * Get ESPN team ID from various team name formats
 */
export function getTeamId(teamName) {
  if (!teamName) return null;
  
  const normalized = teamName.toLowerCase().trim().replace(/\s+/g, "-");
  return TEAM_MAPPINGS[normalized] || null;
}

/**
 * Get sport path for ESPN API
 */
export function getSportPath(sportName) {
  if (!sportName) return SPORT_MAPPINGS["football"]; // Default to football
  
  const normalized = sportName.toLowerCase().trim();
  return SPORT_MAPPINGS[normalized] || SPORT_MAPPINGS["football"];
}

/**
 * Get reverse mapping - Team ID to school name
 */
export function getSchoolName(teamId) {
  const entry = Object.entries(TEAM_MAPPINGS).find(([key, id]) => id === teamId);
  return entry ? entry[0] : null;
}
