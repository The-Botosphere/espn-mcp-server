/**
 * COLLEGE FOOTBALL DATA API (CFBD) INTEGRATION
 * Advanced analytics, recruiting, betting lines, and more
 * Requires free API key from collegefootballdata.com
 */

import fetch from 'node-fetch';

const CFBD_BASE_URL = 'https://api.collegefootballdata.com';
const API_KEY = process.env.CFBD_API_KEY || '';

// Cache configuration
const CACHE_DURATION = {
  RECRUITING: 24 * 60 * 60 * 1000,   // 24 hours
  TALENT: 24 * 60 * 60 * 1000,       // 24 hours
  STATS: 6 * 60 * 60 * 1000,         // 6 hours
  BETTING: 1 * 60 * 60 * 1000,       // 1 hour
  RATINGS: 24 * 60 * 60 * 1000,      // 24 hours
  RECORDS: 24 * 60 * 60 * 1000       // 24 hours
};

const cache = new Map();

/**
 * Fetch from CFBD API with authentication
 */
async function fetchCFBD(endpoint, params = {}) {
  if (!API_KEY) {
    console.error('CFBD_API_KEY is not set!');
    throw new Error('CFBD_API_KEY environment variable not set. Get free key at https://collegefootballdata.com');
  }
  
  const queryString = new URLSearchParams(params).toString();
  const url = `${CFBD_BASE_URL}${endpoint}${queryString ? '?' + queryString : ''}`;
  
  console.log(`Fetching CFBD: ${url}`);
  
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Accept': 'application/json'
      }
    });
    
    console.log(`CFBD Response Status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      if (response.status === 401) {
        console.error('CFBD API key is invalid or expired');
        throw new Error('CFBD API key invalid. Check your CFBD_API_KEY environment variable.');
      }
      console.error(`CFBD API returned error: ${response.status}`);
      throw new Error(`CFBD API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`CFBD Data received, length: ${Array.isArray(data) ? data.length : 'N/A'}`);
    
    return data;
    
  } catch (error) {
    console.error('CFBD fetch error:', error);
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
 * Normalize team name for CFBD (they use full names with proper capitalization)
 */
function normalizeTeamName(teamName) {
  const normalized = teamName.toLowerCase().trim();
  
  const teamNameMap = {
    'oklahoma': 'Oklahoma',
    'ou': 'Oklahoma',
    'sooners': 'Oklahoma',
    'texas': 'Texas',
    'ut': 'Texas',
    'longhorns': 'Texas',
    'oklahoma state': 'Oklahoma State',
    'osu': 'Oklahoma State',
    'alabama': 'Alabama',
    'bama': 'Alabama',
    'georgia': 'Georgia',
    'uga': 'Georgia',
    'ohio state': 'Ohio State',
    'michigan': 'Michigan',
    'clemson': 'Clemson',
    'lsu': 'LSU',
    'florida': 'Florida',
    'texas a&m': 'Texas A&M',
    'tamu': 'Texas A&M',
    'auburn': 'Auburn',
    'penn state': 'Penn State',
    'notre dame': 'Notre Dame',
    'usc': 'USC',
    'oregon': 'Oregon',
    'wisconsin': 'Wisconsin',
    'miami': 'Miami',
    'florida state': 'Florida State',
    'fsu': 'Florida State',
    'tennessee': 'Tennessee',
    'nebraska': 'Nebraska',
    'baylor': 'Baylor',
    'tcu': 'TCU',
    'texas tech': 'Texas Tech'
  };
  
  return teamNameMap[normalized] || teamName;
}

/**
 * Get recruiting rankings
 */
export async function getRecruiting(teamName, year = null) {
  const team = normalizeTeamName(teamName);
  const currentYear = year || new Date().getFullYear();
  
  const cacheKey = `recruiting_${team}_${currentYear}`;
  const cached = getCached(cacheKey, CACHE_DURATION.RECRUITING);
  if (cached) return cached;
  
  try {
    const data = await fetchCFBD('/recruiting/teams', {
      year: currentYear,
      team: team
    });
    
    if (!data || data.length === 0) {
      return {
        error: true,
        message: `No recruiting data found for ${team} in ${currentYear}`
      };
    }
    
    const teamData = data[0];
    const result = {
      team: teamData.team,
      year: currentYear,
      rank: teamData.rank,
      points: teamData.points,
      commits: teamData.commits,
      average: teamData.average
    };
    
    setCache(cacheKey, result);
    return result;
    
  } catch (error) {
    return {
      error: true,
      message: `Failed to get recruiting data: ${error.message}`
    };
  }
}

/**
 * Get team talent composite
 */
export async function getTeamTalent(teamName, year = null) {
  const team = normalizeTeamName(teamName);
  const currentYear = year || new Date().getFullYear();
  
  const cacheKey = `talent_${team}_${currentYear}`;
  const cached = getCached(cacheKey, CACHE_DURATION.TALENT);
  if (cached) return cached;
  
  try {
    const data = await fetchCFBD('/talent', {
      year: currentYear
    });
    
    if (!data || data.length === 0) {
      return {
        error: true,
        message: `No talent data available for ${currentYear}`
      };
    }
    
    const teamData = data.find(t => t.school === team);
    
    if (!teamData) {
      return {
        error: true,
        message: `No talent data found for ${team} in ${currentYear}`
      };
    }
    
    const result = {
      team: teamData.school,
      year: currentYear,
      talent: teamData.talent
    };
    
    setCache(cacheKey, result);
    return result;
    
  } catch (error) {
    return {
      error: true,
      message: `Failed to get talent data: ${error.message}`
    };
  }
}

/**
 * Get advanced team statistics
 */
export async function getAdvancedStats(teamName, year = null, statType = 'both') {
  const team = normalizeTeamName(teamName);
  const currentYear = year || new Date().getFullYear();
  
  const cacheKey = `stats_${team}_${currentYear}_${statType}`;
  const cached = getCached(cacheKey, CACHE_DURATION.STATS);
  if (cached) return cached;
  
  try {
    const data = await fetchCFBD('/stats/season/advanced', {
      year: currentYear,
      team: team
    });
    
    if (!data || data.length === 0) {
      return {
        error: true,
        message: `No stats found for ${team} in ${currentYear}`
      };
    }
    
    const teamStats = data[0];
    
    let result = {
      team: teamStats.team,
      year: currentYear
    };
    
    if (statType === 'offense' || statType === 'both') {
      result.offense = {
        plays: teamStats.offense?.plays,
        ppa: teamStats.offense?.ppa,
        successRate: teamStats.offense?.successRate,
        explosiveness: teamStats.offense?.explosiveness,
        powerSuccess: teamStats.offense?.powerSuccess,
        stuffRate: teamStats.offense?.stuffRate,
        lineYards: teamStats.offense?.lineYards,
        secondLevelYards: teamStats.offense?.secondLevelYards,
        openFieldYards: teamStats.offense?.openFieldYards
      };
    }
    
    if (statType === 'defense' || statType === 'both') {
      result.defense = {
        plays: teamStats.defense?.plays,
        ppa: teamStats.defense?.ppa,
        successRate: teamStats.defense?.successRate,
        explosiveness: teamStats.defense?.explosiveness,
        powerSuccess: teamStats.defense?.powerSuccess,
        stuffRate: teamStats.defense?.stuffRate,
        lineYards: teamStats.defense?.lineYards,
        secondLevelYards: teamStats.defense?.secondLevelYards,
        openFieldYards: teamStats.defense?.openFieldYards
      };
    }
    
    setCache(cacheKey, result);
    return result;
    
  } catch (error) {
    return {
      error: true,
      message: `Failed to get stats: ${error.message}`
    };
  }
}

/**
 * Get betting lines
 */
export async function getBettingLines(teamName, week = null) {
  const team = normalizeTeamName(teamName);
  const currentYear = new Date().getFullYear();
  
  const params = {
    year: currentYear,
    team: team
  };
  
  if (week) {
    params.week = week;
  }
  
  try {
    const data = await fetchCFBD('/lines', params);
    
    if (!data || data.length === 0) {
      return {
        error: true,
        message: `No betting lines found for ${team}`
      };
    }
    
    const games = data.map(game => ({
      homeTeam: game.homeTeam,
      awayTeam: game.awayTeam,
      spread: game.lines?.[0]?.formattedSpread,
      overUnder: game.lines?.[0]?.overUnder,
      homeMoneyline: game.lines?.[0]?.homeMoneyline,
      awayMoneyline: game.lines?.[0]?.awayMoneyline,
      provider: game.lines?.[0]?.provider
    }));
    
    return {
      team: team,
      games: games
    };
    
  } catch (error) {
    return {
      error: true,
      message: `Failed to get betting lines: ${error.message}`
    };
  }
}

/**
 * Get SP+ ratings
 */
export async function getSPRatings(teamName, year = null) {
  const team = normalizeTeamName(teamName);
  const currentYear = year || new Date().getFullYear();
  
  const cacheKey = `ratings_${team}_${currentYear}`;
  const cached = getCached(cacheKey, CACHE_DURATION.RATINGS);
  if (cached) return cached;
  
  try {
    const data = await fetchCFBD('/ratings/sp', {
      year: currentYear,
      team: team
    });
    
    if (!data || data.length === 0) {
      return {
        error: true,
        message: `No SP+ ratings found for ${team} in ${currentYear}`
      };
    }
    
    const teamData = data[0];
    const result = {
      team: teamData.team,
      year: currentYear,
      rating: teamData.rating,
      ranking: teamData.ranking,
      offense: teamData.offense,
      defense: teamData.defense,
      specialTeams: teamData.specialTeams
    };
    
    setCache(cacheKey, result);
    return result;
    
  } catch (error) {
    return {
      error: true,
      message: `Failed to get SP+ ratings: ${error.message}`
    };
  }
}

/**
 * Get team records
 */
export async function getTeamRecords(teamName, year = null) {
  const team = normalizeTeamName(teamName);
  const currentYear = year || new Date().getFullYear();
  
  const cacheKey = `records_${team}_${currentYear}`;
  const cached = getCached(cacheKey, CACHE_DURATION.RECORDS);
  if (cached) return cached;
  
  try {
    const data = await fetchCFBD('/records', {
      year: currentYear,
      team: team
    });
    
    if (!data || data.length === 0) {
      return {
        error: true,
        message: `No records found for ${team} in ${currentYear}`
      };
    }
    
    const teamData = data[0];
    const result = {
      team: teamData.team,
      year: currentYear,
      total: {
        wins: teamData.total?.wins,
        losses: teamData.total?.losses,
        ties: teamData.total?.ties
      },
      conferenceGames: {
        wins: teamData.conferenceGames?.wins,
        losses: teamData.conferenceGames?.losses,
        ties: teamData.conferenceGames?.ties
      },
      homeGames: {
        wins: teamData.homeGames?.wins,
        losses: teamData.homeGames?.losses,
        ties: teamData.homeGames?.ties
      },
      awayGames: {
        wins: teamData.awayGames?.wins,
        losses: teamData.awayGames?.losses,
        ties: teamData.awayGames?.ties
      }
    };
    
    setCache(cacheKey, result);
    return result;
    
  } catch (error) {
    return {
      error: true,
      message: `Failed to get records: ${error.message}`
    };
  }
}

/**
 * Clear CFBD cache
 */
export function clearCache() {
  cache.clear();
  console.log('CFBD cache cleared');
}
