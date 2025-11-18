/**
 * NCAA.COM API INTEGRATION
 * Multi-sport NCAA data across all divisions (FBS, FCS, D2, D3)
 * Covers sports ESPN doesn't track well
 */

import fetch from 'node-fetch';

const NCAA_BASE_URL = 'https://data.ncaa.com/casablanca/scoreboard';

// NCAA Sport IDs
const NCAA_SPORTS = {
  'football': {
    fbs: 'football/fbs',
    fcs: 'football/fcs', 
    d2: 'football/d2',
    d3: 'football/d3'
  },
  'basketball': {
    men_d1: 'basketball-men/d1',
    women_d1: 'basketball-women/d1',
    men_d2: 'basketball-men/d2',
    women_d2: 'basketball-women/d2',
    men_d3: 'basketball-men/d3',
    women_d3: 'basketball-women/d3'
  },
  'baseball': {
    d1: 'baseball/d1',
    d2: 'baseball/d2',
    d3: 'baseball/d3'
  },
  'softball': {
    d1: 'softball/d1',
    d2: 'softball/d2',
    d3: 'softball/d3'
  },
  'volleyball': {
    women_d1: 'volleyball-women/d1',
    women_d2: 'volleyball-women/d2',
    women_d3: 'volleyball-women/d3'
  },
  'soccer': {
    men_d1: 'soccer-men/d1',
    women_d1: 'soccer-women/d1',
    men_d2: 'soccer-men/d2',
    women_d2: 'soccer-women/d2',
    men_d3: 'soccer-men/d3',
    women_d3: 'soccer-women/d3'
  }
};

// Cache
const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch NCAA data with cache
 */
async function fetchNCAA(url) {
  const cached = cache.get(url);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log(`NCAA cache hit: ${url}`);
    return cached.data;
  }
  
  console.log(`Fetching from NCAA: ${url}`);
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`NCAA API error: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  
  cache.set(url, {
    data,
    timestamp: Date.now()
  });
  
  return data;
}

/**
 * Get scoreboard for a sport/division
 */
export async function getNCAAScoreboad(sport = 'football', division = 'fbs', date = null) {
  // Build sport path
  let sportPath;
  if (sport === 'football') {
    sportPath = NCAA_SPORTS.football[division] || NCAA_SPORTS.football.fbs;
  } else if (sport === 'mens-basketball' || sport === 'basketball') {
    sportPath = NCAA_SPORTS.basketball.men_d1;
  } else if (sport === 'womens-basketball') {
    sportPath = NCAA_SPORTS.basketball.women_d1;
  } else if (sport === 'baseball') {
    sportPath = NCAA_SPORTS.baseball.d1;
  } else if (sport === 'softball') {
    sportPath = NCAA_SPORTS.softball.d1;
  } else {
    sportPath = NCAA_SPORTS.football.fbs; // Default
  }
  
  // Format date (YYYYMMDD)
  let dateStr = '';
  if (date) {
    dateStr = date;
  } else {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    dateStr = `${year}${month}${day}`;
  }
  
  const url = `${NCAA_BASE_URL}/${sportPath}/${dateStr}/scoreboard.json`;
  const data = await fetchNCAA(url);
  
  if (!data || !data.games) {
    return {
      games: [],
      sport: sportPath,
      date: dateStr
    };
  }
  
  return {
    games: data.games.map(parseNCAGame),
    sport: sportPath,
    date: dateStr
  };
}

/**
 * Get rankings for a sport/division
 */
export async function getNCAAankings(sport = 'football', division = 'fbs', poll = 'associated-press') {
  // Build sport path
  let sportPath;
  if (sport === 'football') {
    sportPath = NCAA_SPORTS.football[division] || NCAA_SPORTS.football.fbs;
  } else if (sport === 'mens-basketball' || sport === 'basketball') {
    sportPath = NCAA_SPORTS.basketball.men_d1;
  } else {
    sportPath = NCAA_SPORTS.football.fbs;
  }
  
  const url = `https://data.ncaa.com/casablanca/rankings/${sportPath}/${poll}.json`;
  
  try {
    const data = await fetchNCAA(url);
    
    if (!data || !data.rankings) {
      return null;
    }
    
    return {
      poll: data.poll || poll,
      sport: sportPath,
      rankings: data.rankings.map(team => ({
        rank: team.current,
        previousRank: team.previous,
        school: team.school,
        conference: team.conference,
        record: team.record,
        points: team.points,
        firstPlaceVotes: team.firstPlaceVotes
      }))
    };
  } catch (error) {
    console.error('NCAA rankings error:', error.message);
    return null;
  }
}

/**
 * Parse NCAA game data
 */
function parseNCAGame(game) {
  const home = game.home || {};
  const away = game.away || {};
  
  return {
    id: game.game?.gameID,
    status: game.game?.gameState,
    url: game.game?.url,
    startTime: game.game?.startTime,
    startDate: game.game?.startDate,
    currentPeriod: game.game?.currentPeriod,
    finalMessage: game.game?.finalMessage,
    home: {
      name: home.names?.full,
      shortName: home.names?.short,
      abbrev: home.names?.seo,
      rank: home.rank,
      score: home.score,
      winner: home.winner,
      record: home.record
    },
    away: {
      name: away.names?.full,
      shortName: away.names?.short,
      abbrev: away.names?.seo,
      rank: away.rank,
      score: away.score,
      winner: away.winner,
      record: away.record
    },
    location: game.game?.location,
    network: game.game?.network
  };
}

/**
 * Clear NCAA cache
 */
export function clearNCAACache() {
  cache.clear();
  console.log('NCAA cache cleared');
}
