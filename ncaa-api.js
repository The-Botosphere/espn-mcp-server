
/**
 * NCAA API INTEGRATION
 * Multi-division coverage for all NCAA sports
 * No API key required - public endpoints
 */

import fetch from 'node-fetch';

const NCAA_BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports';

// Cache configuration
const CACHE_DURATION = {
  SCOREBOARD: 5 * 60 * 1000,      // 5 minutes
  RANKINGS: 24 * 60 * 60 * 1000   // 24 hours
};

const cache = new Map();

/**
 * Sport and division mappings
 */
const SPORT_MAP = {
  'football': {
    'fbs': 'football/college-football',
    'fcs': 'football/college-football',  // FCS is part of college-football API
    'd2': 'football/college-football',
    'd3': 'football/college-football'
  },
  'basketball': {
    'fbs': 'basketball/mens-college-basketball',
    'fcs': 'basketball/mens-college-basketball',
    'd1': 'basketball/mens-college-basketball',
    'd2': 'basketball/mens-college-basketball',
    'd3': 'basketball/mens-college-basketball'
  },
  'baseball': {
    'd1': 'baseball/college-baseball',
    'd2': 'baseball/college-baseball',
    'd3': 'baseball/college-baseball'
  },
  'softball': {
    'd1': 'softball/college-softball',
    'd2': 'softball/college-softball',
    'd3': 'softball/college-softball'
  }
};

/**
 * Fetch from NCAA/ESPN API
 */
async function fetchNCAA(url) {
  console.log(`Fetching NCAA: ${url}`);
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Botosphere-MCP-Server/1.0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`NCAA API error: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
    
  } catch (error) {
    console.error('NCAA fetch error:', error);
    throw error;
  }
}

/**
 * Cache helpers
 */
function getCached(key, maxAge) {
  const cached = cache.get(key);
  if (!cached) return null;
  
  const age = Date.now() - cached.timestamp;
  if (age > maxAge) {
    cache.delete(key);
    return null;
  }
  
  console.log(`Cache hit: ${key}`);
  return cached.data;
}

function setCache(key, data) {
  cache.set(key, {
    data,
    timestamp: Date.now()
  });
}

/**
 * Get sport path for API
 */
function getSportPath(sport, division) {
  const sportLower = sport.toLowerCase();
  const divisionLower = division.toLowerCase();
  
  if (SPORT_MAP[sportLower] && SPORT_MAP[sportLower][divisionLower]) {
    return SPORT_MAP[sportLower][divisionLower];
  }
  
  // Default to FBS football
  return 'football/college-football';
}

/**
 * Get NCAA scoreboard for any sport/division
 */
export async function getNCAAScoreboard(sport = 'football', division = 'fbs', date = null) {
  const dateStr = date || new Date().toISOString().split('T')[0].replace(/-/g, '');
  const cacheKey = `ncaa_scoreboard_${sport}_${division}_${dateStr}`;
  const cached = getCached(cacheKey, CACHE_DURATION.SCOREBOARD);
  if (cached) return cached;
  
  try {
    const sportPath = getSportPath(sport, division);
    const url = `${NCAA_BASE_URL}/${sportPath}/scoreboard?dates=${dateStr}`;
    
    const data = await fetchNCAA(url);
    
    if (!data.events || data.events.length === 0) {
      return {
        error: true,
        message: `No ${sport} games found for ${division.toUpperCase()} on ${dateStr}`
      };
    }
    
    // Filter by division if needed
    let filteredEvents = data.events;
    
    if (division === 'fcs') {
      // FCS teams typically in lower conferences
      filteredEvents = data.events.filter(event => {
        const competition = event.competitions?.[0];
        const homeTeam = competition?.competitors?.find(t => t.homeAway === 'home');
        const awayTeam = competition?.competitors?.find(t => t.homeAway === 'away');
        
        // This is a simplified filter - FCS detection would need conference data
        // For now, return all games
        return true;
      });
    }
    
    const games = filteredEvents.map(event => {
      const competition = event.competitions[0];
      const homeTeam = competition.competitors.find(t => t.homeAway === 'home');
      const awayTeam = competition.competitors.find(t => t.homeAway === 'away');
      const status = competition.status;
      
      return {
        name: event.name,
        status: status.type.description,
        isLive: status.type.state === 'in',
        period: status.period,
        clock: status.displayClock,
        homeTeam: {
          name: homeTeam.team.displayName,
          abbreviation: homeTeam.team.abbreviation,
          score: homeTeam.score,
          record: homeTeam.records?.[0]?.summary,
          conference: homeTeam.team.conferenceId
        },
        awayTeam: {
          name: awayTeam.team.displayName,
          abbreviation: awayTeam.team.abbreviation,
          score: awayTeam.score,
          record: awayTeam.records?.[0]?.summary,
          conference: awayTeam.team.conferenceId
        },
        venue: competition.venue?.fullName,
        broadcast: competition.broadcasts?.[0]?.names?.[0]
      };
    });
    
    const result = {
      sport: sport,
      division: division.toUpperCase(),
      date: dateStr,
      games: games
    };
    
    setCache(cacheKey, result);
    return result;
    
  } catch (error) {
    return {
      error: true,
      message: `Failed to get NCAA scoreboard: ${error.message}`
    };
  }
}

/**
 * Get NCAA rankings
 */
export async function getNCAAankings(sport = 'football', division = 'fbs', poll = 'ap') {
  const cacheKey = `ncaa_rankings_${sport}_${division}_${poll}`;
  const cached = getCached(cacheKey, CACHE_DURATION.RANKINGS);
  if (cached) return cached;
  
  try {
    const sportPath = getSportPath(sport, division);
    const url = `${NCAA_BASE_URL}/${sportPath}/rankings`;
    
    const data = await fetchNCAA(url);
    
    if (!data.rankings || data.rankings.length === 0) {
      return {
        error: true,
        message: `No rankings available for ${sport} ${division.toUpperCase()}`
      };
    }
    
    // Find the requested poll
    let ranking = data.rankings[0];
    if (poll !== 'ap') {
      const found = data.rankings.find(r => 
        r.name.toLowerCase().includes(poll.toLowerCase())
      );
      if (found) ranking = found;
    }
    
    const teams = ranking.ranks.map(rank => ({
      rank: rank.current,
      previousRank: rank.previous,
      team: rank.team.displayName,
      abbreviation: rank.team.abbreviation,
      record: rank.recordSummary,
      points: rank.points,
      firstPlaceVotes: rank.firstPlaceVotes
    }));
    
    const result = {
      sport: sport,
      division: division.toUpperCase(),
      poll: ranking.name,
      week: ranking.week,
      season: ranking.season,
      teams: teams
    };
    
    setCache(cacheKey, result);
    return result;
    
  } catch (error) {
    return {
      error: true,
      message: `Failed to get NCAA rankings: ${error.message}`
    };
  }
}

/**
 * Get conference standings (useful for all divisions)
 */
export async function getConferenceStandings(conference, sport = 'football') {
  try {
    const sportPath = getSportPath(sport, 'fbs');
    const url = `${NCAA_BASE_URL}/${sportPath}/standings`;
    
    const data = await fetchNCAA(url);
    
    if (!data.children || data.children.length === 0) {
      return {
        error: true,
        message: 'No standings data available'
      };
    }
    
    // Find the requested conference
    const conferenceLower = conference.toLowerCase();
    const conferenceData = data.children.find(c => 
      c.name.toLowerCase().includes(conferenceLower)
    );
    
    if (!conferenceData) {
      return {
        error: true,
        message: `Conference "${conference}" not found`
      };
    }
    
    const standings = conferenceData.standings.entries.map(entry => ({
      team: entry.team.displayName,
      record: entry.stats.find(s => s.name === 'overall')?.displayValue,
      conferenceRecord: entry.stats.find(s => s.name === 'vs. Conf.')?.displayValue,
      streak: entry.stats.find(s => s.name === 'streak')?.displayValue
    }));
    
    return {
      conference: conferenceData.name,
      standings: standings
    };
    
  } catch (error) {
    return {
      error: true,
      message: `Failed to get standings: ${error.message}`
    };
  }
}

/**
 * Clear NCAA cache
 */
export function clearCache() {
  cache.clear();
  console.log('NCAA cache cleared');
}
