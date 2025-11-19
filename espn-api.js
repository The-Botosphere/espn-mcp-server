/**
 * ESPN API INTEGRATION
 * Real-time scores, schedules, rankings from ESPN
 * No API key required - public endpoints
 */

import fetch from 'node-fetch';

const ESPN_BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports';

// Team name to ESPN ID mapping for major college teams
const TEAM_MAP = {
  // Big 12
  'oklahoma': '201',
  'ou': '201',
  'sooners': '201',
  'texas': '251',
  'ut': '251',
  'longhorns': '251',
  'oklahoma state': '197',
  'osu': '197',
  'cowboys': '197',
  'baylor': '239',
  'tcu': '2628',
  'texas tech': '2641',
  'kansas': '2305',
  'kansas state': '2306',
  'iowa state': '66',
  'west virginia': '277',
  
  // SEC
  'alabama': '333',
  'bama': '333',
  'georgia': '61',
  'uga': '61',
  'lsu': '99',
  'florida': '57',
  'tennessee': '2633',
  'auburn': '2',
  'texas a&m': '245',
  'tamu': '245',
  'arkansas': '8',
  'missouri': '142',
  'kentucky': '96',
  'mississippi state': '344',
  'ole miss': '145',
  'south carolina': '2579',
  'vanderbilt': '238',
  
  // Big Ten
  'ohio state': '194',
  'osu': '194',
  'michigan': '130',
  'penn state': '213',
  'wisconsin': '275',
  'iowa': '2294',
  'nebraska': '158',
  'minnesota': '135',
  'northwestern': '77',
  'illinois': '356',
  'purdue': '2509',
  'indiana': '84',
  'michigan state': '127',
  'maryland': '120',
  'rutgers': '164',
  
  // ACC
  'clemson': '228',
  'miami': '2390',
  'florida state': '52',
  'fsu': '52',
  'north carolina': '153',
  'unc': '153',
  'nc state': '152',
  'virginia tech': '259',
  'virginia': '258',
  'pittsburgh': '221',
  'louisville': '97',
  'duke': '150',
  'wake forest': '154',
  'boston college': '103',
  'syracuse': '183',
  'georgia tech': '59',
  
  // Pac-12 / Other
  'usc': '30',
  'ucla': '26',
  'oregon': '2483',
  'washington': '264',
  'stanford': '24',
  'notre dame': '87',
  'byu': '252',
  'utah': '254',
  'colorado': '38',
  'arizona': '12',
  'arizona state': '9',
  'washington state': '265',
  'oregon state': '204',
  'california': '25',
  'cal': '25'
};

// Cache configuration
const CACHE_DURATION = {
  LIVE_GAME: 60 * 1000,           // 1 minute for live games
  COMPLETED_GAME: 24 * 60 * 60 * 1000,  // 24 hours for completed
  SCHEDULE: 24 * 60 * 60 * 1000,  // 24 hours
  RANKINGS: 24 * 60 * 60 * 1000,  // 24 hours
  SCOREBOARD: 5 * 60 * 1000       // 5 minutes
};

const cache = new Map();

/**
 * Get team ESPN ID from name
 */
function getTeamId(teamName) {
  const normalized = teamName.toLowerCase().trim();
  return TEAM_MAP[normalized] || null;
}

/**
 * Fetch from ESPN API with error handling
 */
async function fetchESPN(url) {
  console.log(`Fetching ESPN: ${url}`);
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Botosphere-MCP-Server/1.0'
      }
    });
    
    console.log(`ESPN Response Status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      console.error(`ESPN API returned error status: ${response.status}`);
      throw new Error(`ESPN API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`ESPN Data received, events count: ${data.events?.length || 0}`);
    
    return data;
  } catch (error) {
    console.error('ESPN fetch error:', error.message);
    console.error('Error stack:', error.stack);
    throw error;
  }
}

/**
 * Cache helper with TTL
 */
function getCached(key, maxAge) {
  const cached = cache.get(key);
  if (!cached) return null;
  
  const age = Date.now() - cached.timestamp;
  if (age > maxAge) {
    cache.delete(key);
    return null;
  }
  
  console.log(`Cache hit: ${key} (age: ${Math.floor(age / 1000)}s)`);
  return cached.data;
}

function setCache(key, data) {
  cache.set(key, {
    data,
    timestamp: Date.now()
  });
}

/**
 * Get current or most recent game score for a team
 */
export async function getCurrentGame(teamName, sport = 'football') {
  console.log(`getCurrentGame called for: ${teamName}, sport: ${sport}`);
  
  const teamId = getTeamId(teamName);
  
  if (!teamId) {
    console.log(`Team not found: ${teamName}`);
    return {
      error: true,
      message: `Team "${teamName}" not found. Try: oklahoma, texas, alabama, ohio state, etc.`
    };
  }
  
  console.log(`Team ID found: ${teamId} for ${teamName}`);
  
  try {
    const sportPath = sport === 'football' ? 'football/college-football' : 
                      sport === 'basketball' ? 'basketball/mens-college-basketball' :
                      'football/college-football';
    
    const url = `${ESPN_BASE_URL}/${sportPath}/teams/${teamId}/schedule`;
    const data = await fetchESPN(url);
    
    if (!data.events || data.events.length === 0) {
      console.log('No events found in ESPN schedule data');
      return {
        error: true,
        message: `No games found for ${teamName}`
      };
    }
    
    console.log(`Found ${data.events.length} events in schedule`);
    // Log first 3 events for debugging
    data.events.slice(0, 3).forEach((event, i) => {
      const comp = event.competitions?.[0];
      console.log(`Event ${i}: ${event.name} - Date: ${comp?.date} - Status: ${comp?.status?.type?.description} - Completed: ${comp?.status?.type?.completed}`);
    });
    
    // Find most recent or current game
    const now = new Date();
    console.log(`Current time: ${now.toISOString()}`);
    let currentGame = null;
    
    // First, look for in-progress game
    console.log('Searching for live game...');
    for (const event of data.events) {
      const competition = event.competitions?.[0];
      if (competition?.status?.type?.state === 'in') {
        console.log(`Found live game: ${event.name}`);
        currentGame = event;
        break;
      }
    }
    
    // If no live game, get most recent completed game (within last 7 days)
    if (!currentGame) {
      console.log('No live game found, searching for recent completed games...');
      const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
      console.log(`Searching from ${sevenDaysAgo.toISOString()} to ${now.toISOString()}`);
      let recentGames = [];
      
      for (const event of data.events) {
        const competition = event.competitions?.[0];
        const gameDate = new Date(competition?.date);
        const isCompleted = competition?.status?.type?.completed;
        const inDateRange = gameDate <= now && gameDate >= sevenDaysAgo;
        
        console.log(`Checking: ${event.name} - Date: ${gameDate.toISOString()} - Completed: ${isCompleted} - InRange: ${inDateRange}`);
        
        if (inDateRange && isCompleted) {
          console.log(`  ✓ Adding to recent games: ${event.name}`);
          recentGames.push(event);
        }
      }
      
      console.log(`Found ${recentGames.length} recent completed games`);
      
      // Sort by date descending and take most recent
      if (recentGames.length > 0) {
        recentGames.sort((a, b) => {
          const dateA = new Date(a.competitions[0].date);
          const dateB = new Date(b.competitions[0].date);
          return dateB - dateA;
        });
        currentGame = recentGames[0];
        console.log(`Most recent game: ${currentGame.name}`);
      }
    }
    
    if (!currentGame) {
      console.log('No recent or current game found for', teamName);
      console.log('Total events in schedule:', data.events.length);
      if (data.events.length > 0) {
        console.log('First event date:', data.events[0].competitions?.[0]?.date);
        console.log('First event status:', data.events[0].competitions?.[0]?.status?.type?.description);
      }
      return {
        error: true,
        message: `No recent game found for ${teamName} in the last 7 days. The team may be between games or the schedule data may not be updated yet.`
      };
    }
    
    const competition = currentGame.competitions[0];
    const homeTeam = competition.competitors.find(t => t.homeAway === 'home');
    const awayTeam = competition.competitors.find(t => t.homeAway === 'away');
    const status = competition.status;
    
    return {
      game: {
        name: currentGame.name,
        date: competition.date,
        status: status.type.description,
        period: status.period,
        clock: status.displayClock,
        isLive: status.type.state === 'in',
        isCompleted: status.type.completed,
        homeTeam: {
          name: homeTeam.team.displayName,
          abbreviation: homeTeam.team.abbreviation,
          score: homeTeam.score,
          record: homeTeam.records?.[0]?.summary
        },
        awayTeam: {
          name: awayTeam.team.displayName,
          abbreviation: awayTeam.team.abbreviation,
          score: awayTeam.score,
          record: awayTeam.records?.[0]?.summary
        },
        venue: competition.venue?.fullName,
        broadcast: competition.broadcasts?.[0]?.names?.[0]
      }
    };
    
  } catch (error) {
    return {
      error: true,
      message: `Failed to get game data: ${error.message}`
    };
  }
}

/**
 * Get team schedule
 */
export async function getTeamSchedule(teamName, sport = 'football', limit = 5) {
  const teamId = getTeamId(teamName);
  
  if (!teamId) {
    return {
      error: true,
      message: `Team "${teamName}" not found`
    };
  }
  
  const cacheKey = `schedule_${teamId}_${sport}`;
  const cached = getCached(cacheKey, CACHE_DURATION.SCHEDULE);
  if (cached) return cached;
  
  try {
    const sportPath = sport === 'football' ? 'football/college-football' : 
                      sport === 'basketball' ? 'basketball/mens-college-basketball' :
                      'football/college-football';
    
    const url = `${ESPN_BASE_URL}/${sportPath}/teams/${teamId}/schedule`;
    const data = await fetchESPN(url);
    
    if (!data.events || data.events.length === 0) {
      return {
        error: true,
        message: `No schedule found for ${teamName}`
      };
    }
    
    const now = new Date();
    const upcomingGames = data.events
      .filter(event => {
        const gameDate = new Date(event.competitions?.[0]?.date);
        return gameDate >= now;
      })
      .slice(0, limit)
      .map(event => {
        const competition = event.competitions[0];
        const homeTeam = competition.competitors.find(t => t.homeAway === 'home');
        const awayTeam = competition.competitors.find(t => t.homeAway === 'away');
        
        return {
          date: competition.date,
          opponent: homeTeam.team.id === teamId ? awayTeam.team.displayName : homeTeam.team.displayName,
          location: homeTeam.team.id === teamId ? 'Home' : 'Away',
          venue: competition.venue?.fullName,
          broadcast: competition.broadcasts?.[0]?.names?.[0],
          time: new Date(competition.date).toLocaleString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            timeZoneName: 'short'
          })
        };
      });
    
    const result = {
      team: teamName,
      games: upcomingGames
    };
    
    setCache(cacheKey, result);
    return result;
    
  } catch (error) {
    return {
      error: true,
      message: `Failed to get schedule: ${error.message}`
    };
  }
}

/**
 * Get scoreboard for all games today
 */
export async function getScoreboard(sport = 'football', date = null) {
  const dateStr = date || new Date().toISOString().split('T')[0].replace(/-/g, '');
  const cacheKey = `scoreboard_${sport}_${dateStr}`;
  const cached = getCached(cacheKey, CACHE_DURATION.SCOREBOARD);
  if (cached) return cached;
  
  try {
    const sportPath = sport === 'football' ? 'football/college-football' : 
                      sport === 'basketball' ? 'basketball/mens-college-basketball' :
                      'football/college-football';
    
    const url = `${ESPN_BASE_URL}/${sportPath}/scoreboard?dates=${dateStr}`;
    const data = await fetchESPN(url);
    
    if (!data.events || data.events.length === 0) {
      return {
        error: true,
        message: `No games found for ${dateStr}`
      };
    }
    
    const games = data.events.map(event => {
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
          record: homeTeam.records?.[0]?.summary
        },
        awayTeam: {
          name: awayTeam.team.displayName,
          abbreviation: awayTeam.team.abbreviation,
          score: awayTeam.score,
          record: awayTeam.records?.[0]?.summary
        },
        broadcast: competition.broadcasts?.[0]?.names?.[0]
      };
    });
    
    const result = {
      date: dateStr,
      games
    };
    
    setCache(cacheKey, result);
    return result;
    
  } catch (error) {
    return {
      error: true,
      message: `Failed to get scoreboard: ${error.message}`
    };
  }
}

/**
 * Get rankings (AP Top 25)
 */
export async function getRankings(sport = 'football', poll = 'ap') {
  const cacheKey = `rankings_${sport}_${poll}`;
  const cached = getCached(cacheKey, CACHE_DURATION.RANKINGS);
  if (cached) return cached;
  
  try {
    const sportPath = sport === 'football' ? 'football/college-football' : 
                      sport === 'basketball' ? 'basketball/mens-college-basketball' :
                      'football/college-football';
    
    const url = `${ESPN_BASE_URL}/${sportPath}/rankings`;
    const data = await fetchESPN(url);
    
    if (!data.rankings || data.rankings.length === 0) {
      return {
        error: true,
        message: 'No rankings available'
      };
    }
    
    // Find the requested poll (default to first available)
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
      points: rank.points
    }));
    
    const result = {
      poll: ranking.name,
      week: ranking.week,
      season: ranking.season,
      teams
    };
    
    setCache(cacheKey, result);
    return result;
    
  } catch (error) {
    return {
      error: true,
      message: `Failed to get rankings: ${error.message}`
    };
  }
}

/**
 * Clear ESPN cache
 */
export function clearCache() {
  cache.clear();
  console.log('ESPN cache cleared');
}
