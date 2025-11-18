/**
 * ESPN API INTEGRATION
 * Fetches real-time sports data from ESPN's public APIs
 */

import fetch from 'node-fetch';
import { getTeamId, getSportPath } from './team-mapping.js';

const ESPN_BASE_URL = 'http://site.api.espn.com/apis/site/v2/sports';

// ADAPTIVE CACHE DURATIONS - Optimized for real-time performance
const CACHE_DURATIONS = {
  LIVE_GAME: 1 * 60 * 1000,              // 1 minute for live games (MAXIMUM REAL-TIME)
  COMPLETED_GAME: 24 * 60 * 60 * 1000,  // 24 hours for completed games (scores never change)
  UPCOMING_GAME: 6 * 60 * 60 * 1000,    // 6 hours for upcoming games (schedules rarely change)
  SCHEDULE: 24 * 60 * 60 * 1000,        // 24 hours for full schedules
  SCOREBOARD: 1 * 60 * 1000,            // 1 minute for scoreboards (when live games detected)
  SCOREBOARD_NO_LIVE: 15 * 60 * 1000,   // 15 minutes when no live games
  RANKINGS: 24 * 60 * 60 * 1000         // 24 hours for rankings (update weekly)
};

const cache = new Map();

/**
 * Fetch data with adaptive caching
 * Cache duration is determined by data type (live games get shorter cache)
 */
async function fetchWithCache(url, cacheKey, cacheDuration) {
  const cached = cache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < cacheDuration) {
    console.log(`Cache hit: ${cacheKey} (age: ${Math.floor((Date.now() - cached.timestamp) / 1000)}s)`);
    return cached.data;
  }
  
  console.log(`Fetching from ESPN: ${url}`);
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`ESPN API error: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  
  cache.set(cacheKey, {
    data,
    timestamp: Date.now()
  });
  
  console.log(`Cached: ${cacheKey} (duration: ${cacheDuration / 1000}s)`);
  
  return data;
}

/**
 * Get team schedule (includes scores for completed games)
 */
export async function getTeamSchedule(teamName, sport = 'football') {
  const teamId = getTeamId(teamName);
  
  if (!teamId) {
    throw new Error(`Team not found: ${teamName}`);
  }
  
  const sportConfig = getSportPath(sport);
  const url = `${ESPN_BASE_URL}/${sportConfig.path}/teams/${teamId}/schedule`;
  const cacheKey = `schedule-${teamId}-${sport}`;
  
  const data = await fetchWithCache(url, cacheKey, CACHE_DURATIONS.SCHEDULE);
  
  return {
    team: data.team,
    events: data.events || [],
    sport: sportConfig.name
  };
}

/**
 * Get most recent or current game with ADAPTIVE CACHING
 * Live games = 1 minute cache
 * Completed games = 24 hour cache
 * Upcoming games = 6 hour cache
 */
export async function getCurrentGame(teamName, sport = 'football') {
  const teamId = getTeamId(teamName);
  
  if (!teamId) {
    throw new Error(`Team not found: ${teamName}`);
  }
  
  const sportConfig = getSportPath(sport);
  const url = `${ESPN_BASE_URL}/${sportConfig.path}/teams/${teamId}/schedule`;
  
  // First, check if we have a cached game and determine its state
  const cacheKey = `current-game-${teamId}-${sport}`;
  const cached = cache.get(cacheKey);
  
  // Determine cache duration based on game state
  let cacheDuration = CACHE_DURATIONS.UPCOMING_GAME; // Default
  
  if (cached && cached.data) {
    const cachedGame = cached.data;
    const gameState = cachedGame.status?.state;
    
    if (gameState === 'in') {
      // Live game - use 1 minute cache
      cacheDuration = CACHE_DURATIONS.LIVE_GAME;
    } else if (gameState === 'post') {
      // Completed game - use 24 hour cache
      cacheDuration = CACHE_DURATIONS.COMPLETED_GAME;
    } else {
      // Upcoming game - use 6 hour cache
      cacheDuration = CACHE_DURATIONS.UPCOMING_GAME;
    }
    
    // Check if cache is still valid
    if (Date.now() - cached.timestamp < cacheDuration) {
      console.log(`Current game cache hit: ${cacheKey} (state: ${gameState}, age: ${Math.floor((Date.now() - cached.timestamp) / 1000)}s)`);
      return cachedGame;
    }
  }
  
  // Cache expired or doesn't exist - fetch fresh data
  console.log(`Fetching fresh schedule for current game: ${teamName}`);
  const scheduleData = await fetchWithCache(url, `schedule-${teamId}-${sport}`, CACHE_DURATIONS.SCHEDULE);
  const schedule = {
    team: scheduleData.team,
    events: scheduleData.events || [],
    sport: sportConfig.name
  };
  
  if (!schedule.events || schedule.events.length === 0) {
    return null;
  }
  
  // Find in-progress game (highest priority)
  const liveGame = schedule.events.find(event => 
    event.status?.type?.state === 'in'
  );
  
  if (liveGame) {
    const parsedGame = parseGameData(liveGame);
    console.log(`Found LIVE game - caching for ${CACHE_DURATIONS.LIVE_GAME / 1000}s`);
    cache.set(cacheKey, {
      data: parsedGame,
      timestamp: Date.now()
    });
    return parsedGame;
  }
  
  // Find most recent completed game
  const completedGames = schedule.events.filter(event => 
    event.status?.type?.state === 'post'
  );
  
  if (completedGames.length > 0) {
    const parsedGame = parseGameData(completedGames[0]);
    console.log(`Found COMPLETED game - caching for ${CACHE_DURATIONS.COMPLETED_GAME / 1000}s`);
    cache.set(cacheKey, {
      data: parsedGame,
      timestamp: Date.now()
    });
    return parsedGame;
  }
  
  // Return next upcoming game
  const upcomingGames = schedule.events.filter(event => 
    event.status?.type?.state === 'pre'
  );
  
  if (upcomingGames.length > 0) {
    const parsedGame = parseGameData(upcomingGames[0]);
    console.log(`Found UPCOMING game - caching for ${CACHE_DURATIONS.UPCOMING_GAME / 1000}s`);
    cache.set(cacheKey, {
      data: parsedGame,
      timestamp: Date.now()
    });
    return parsedGame;
  }
  
  return null;
}

/**
 * Get today's scoreboard across all teams with INTELLIGENT CACHING
 * Detects if any games are live and adjusts cache accordingly
 */
export async function getScoreboard(sport = 'football', date = null) {
  const sportConfig = getSportPath(sport);
  let url = `${ESPN_BASE_URL}/${sportConfig.path}/scoreboard`;
  
  if (date) {
    url += `?dates=${date}`; // Format: YYYYMMDD
  }
  
  const cacheKey = `scoreboard-${sport}-${date || 'today'}`;
  const cached = cache.get(cacheKey);
  
  // Check if we have cached data with live games
  let cacheDuration = CACHE_DURATIONS.SCOREBOARD_NO_LIVE;
  
  if (cached && cached.data) {
    const hasLiveGames = cached.data.events?.some(event => 
      event.status?.state === 'in'
    );
    
    if (hasLiveGames) {
      // Live games exist - use 1 minute cache for maximum real-time
      cacheDuration = CACHE_DURATIONS.SCOREBOARD;
      console.log(`Scoreboard has LIVE games - using ${cacheDuration / 1000}s cache`);
    } else {
      // No live games - use longer cache
      console.log(`Scoreboard has no live games - using ${cacheDuration / 1000}s cache`);
    }
    
    if (Date.now() - cached.timestamp < cacheDuration) {
      console.log(`Scoreboard cache hit: ${cacheKey} (age: ${Math.floor((Date.now() - cached.timestamp) / 1000)}s)`);
      return cached.data;
    }
  }
  
  // Fetch fresh data
  console.log(`Fetching fresh scoreboard data`);
  const data = await fetchWithCache(url, cacheKey, CACHE_DURATIONS.SCOREBOARD);
  
  const scoreboard = {
    events: (data.events || []).map(parseGameData),
    sport: sportConfig.name
  };
  
  // Check if any games are live and adjust future cache duration
  const hasLiveGames = scoreboard.events.some(event => 
    event.status?.state === 'in'
  );
  
  if (hasLiveGames) {
    console.log(`Scoreboard contains ${scoreboard.events.filter(e => e.status?.state === 'in').length} LIVE games`);
  }
  
  return scoreboard;
}

/**
 * Get rankings (AP Top 25, Coaches Poll)
 */
export async function getRankings(sport = 'football') {
  const sportConfig = getSportPath(sport);
  const url = `${ESPN_BASE_URL}/${sportConfig.path}/rankings`;
  const cacheKey = `rankings-${sport}`;
  
  const data = await fetchWithCache(url, cacheKey, CACHE_DURATIONS.RANKINGS);
  
  if (!data.rankings || data.rankings.length === 0) {
    return null;
  }
  
  return {
    rankings: data.rankings.map(ranking => ({
      name: ranking.name,
      type: ranking.type,
      teams: ranking.ranks?.map(rank => ({
        rank: rank.current,
        team: rank.team?.displayName || rank.team?.name,
        record: rank.recordSummary,
        points: rank.points
      })) || []
    })),
    sport: sportConfig.name
  };
}

/**
 * Parse game data into consistent format
 */
function parseGameData(event) {
  const competition = event.competitions?.[0];
  const status = event.status;
  
  const homeTeam = competition?.competitors?.find(c => c.homeAway === 'home');
  const awayTeam = competition?.competitors?.find(c => c.homeAway === 'away');
  
  return {
    id: event.id,
    name: event.name,
    shortName: event.shortName,
    date: event.date,
    
    status: {
      state: status?.type?.state, // 'pre', 'in', 'post'
      detail: status?.type?.detail,
      completed: status?.type?.completed,
      period: status?.period,
      clock: status?.displayClock
    },
    
    homeTeam: {
      id: homeTeam?.id,
      name: homeTeam?.team?.displayName,
      abbreviation: homeTeam?.team?.abbreviation,
      logo: homeTeam?.team?.logo,
      score: homeTeam?.score,
      record: homeTeam?.records?.[0]?.summary,
      rank: homeTeam?.curatedRank?.current
    },
    
    awayTeam: {
      id: awayTeam?.id,
      name: awayTeam?.team?.displayName,
      abbreviation: awayTeam?.team?.abbreviation,
      logo: awayTeam?.team?.logo,
      score: awayTeam?.score,
      record: awayTeam?.records?.[0]?.summary,
      rank: awayTeam?.curatedRank?.current
    },
    
    venue: {
      name: competition?.venue?.fullName,
      city: competition?.venue?.address?.city,
      state: competition?.venue?.address?.state
    },
    
    broadcast: competition?.broadcasts?.[0]?.names?.[0] || null,
    
    odds: competition?.odds?.[0] ? {
      spread: competition.odds[0].details,
      overUnder: competition.odds[0].overUnder
    } : null
  };
}

/**
 * Clear cache (useful for testing)
 */
export function clearCache() {
  cache.clear();
  console.log('Cache cleared');
}
