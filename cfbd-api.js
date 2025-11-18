/**
 * COLLEGE FOOTBALL DATA API INTEGRATION
 * Advanced analytics, recruiting, betting lines, and team talent metrics
 * API Key required (free): https://collegefootballdata.com
 */

import fetch from 'node-fetch';

const CFBD_BASE_URL = 'https://api.collegefootballdata.com';
const CFBD_API_KEY = process.env.CFBD_API_KEY || '';

// Cache for CFBD data
const cache = new Map();
const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours (data updates less frequently)

/**
 * Fetch with cache and API key
 */
async function fetchCFBD(endpoint) {
  const cached = cache.get(endpoint);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log(`CFBD cache hit: ${endpoint}`);
    return cached.data;
  }
  
  const url = `${CFBD_BASE_URL}${endpoint}`;
  console.log(`Fetching from CFBD: ${url}`);
  
  const headers = {
    'Accept': 'application/json'
  };
  
  if (CFBD_API_KEY) {
    headers['Authorization'] = `Bearer ${CFBD_API_KEY}`;
  }
  
  const response = await fetch(url, { headers });
  
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('CFBD API key required. Get one free at https://collegefootballdata.com');
    }
    throw new Error(`CFBD API error: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  
  cache.set(endpoint, {
    data,
    timestamp: Date.now()
  });
  
  return data;
}

/**
 * Get recruiting rankings for a team
 */
export async function getRecruiting(teamName, year = new Date().getFullYear()) {
  const endpoint = `/recruiting/teams?year=${year}&team=${encodeURIComponent(teamName)}`;
  const data = await fetchCFBD(endpoint);
  
  if (!data || data.length === 0) {
    return null;
  }
  
  const teamData = data[0];
  
  return {
    year,
    team: teamData.team,
    rank: teamData.rank,
    points: teamData.points,
    commits: teamData.commits || 0,
    avgRating: teamData.avgRating || 0,
    avgStars: teamData.avgStars || 0
  };
}

/**
 * Get team talent composite (roster talent rating)
 */
export async function getTeamTalent(teamName, year = new Date().getFullYear()) {
  const endpoint = `/talent?year=${year}`;
  const data = await fetchCFBD(endpoint);
  
  if (!data || data.length === 0) {
    return null;
  }
  
  const teamData = data.find(t => 
    t.school.toLowerCase() === teamName.toLowerCase()
  );
  
  if (!teamData) {
    return null;
  }
  
  return {
    year,
    team: teamData.school,
    talent: teamData.talent,
    rank: data.findIndex(t => t.school === teamData.school) + 1
  };
}

/**
 * Get advanced team stats (EPA, Success Rate, etc.)
 */
export async function getAdvancedStats(teamName, year = new Date().getFullYear()) {
  const endpoint = `/stats/season/advanced?year=${year}&team=${encodeURIComponent(teamName)}`;
  const data = await fetchCFBD(endpoint);
  
  if (!data || data.length === 0) {
    return null;
  }
  
  const teamData = data[0];
  const offense = teamData.offense || {};
  const defense = teamData.defense || {};
  
  return {
    year,
    team: teamData.team,
    offense: {
      plays: offense.plays,
      drives: offense.drives,
      ppa: offense.ppa, // Predicted Points Added per play
      successRate: offense.successRate,
      explosiveness: offense.explosiveness,
      powerSuccess: offense.powerSuccess,
      stuffRate: offense.stuffRate,
      lineYards: offense.lineYards,
      secondLevelYards: offense.secondLevelYards,
      openFieldYards: offense.openFieldYards
    },
    defense: {
      plays: defense.plays,
      drives: defense.drives,
      ppa: defense.ppa,
      successRate: defense.successRate,
      explosiveness: defense.explosiveness,
      powerSuccess: defense.powerSuccess,
      stuffRate: defense.stuffRate,
      lineYards: defense.lineYards,
      secondLevelYards: defense.secondLevelYards,
      openFieldYards: defense.openFieldYards,
      havoc: defense.havoc // Havoc rate (TFLs, sacks, PBUs, INTs)
    }
  };
}

/**
 * Get betting lines for team games
 */
export async function getBettingLines(teamName, year = new Date().getFullYear(), week = null) {
  let endpoint = `/lines?year=${year}&team=${encodeURIComponent(teamName)}`;
  if (week) {
    endpoint += `&week=${week}`;
  }
  
  const data = await fetchCFBD(endpoint);
  
  if (!data || data.length === 0) {
    return null;
  }
  
  return data.map(game => ({
    id: game.id,
    season: game.season,
    week: game.week,
    seasonType: game.seasonType,
    startDate: game.startDate,
    homeTeam: game.homeTeam,
    awayTeam: game.awayTeam,
    homeScore: game.homeScore,
    awayScore: game.awayScore,
    lines: game.lines?.map(line => ({
      provider: line.provider,
      spread: line.spread,
      formattedSpread: line.formattedSpread,
      overUnder: line.overUnder,
      overUnderOpen: line.overUnderOpen,
      homeMoneyline: line.homeMoneyline,
      awayMoneyline: line.awayMoneyline
    })) || []
  }));
}

/**
 * Get SP+ ratings (advanced team ratings)
 */
export async function getSPRatings(teamName, year = new Date().getFullYear()) {
  const endpoint = `/ratings/sp?year=${year}&team=${encodeURIComponent(teamName)}`;
  const data = await fetchCFBD(endpoint);
  
  if (!data || data.length === 0) {
    return null;
  }
  
  const teamData = data[0];
  
  return {
    year,
    team: teamData.team,
    conference: teamData.conference,
    rating: teamData.rating,
    ranking: teamData.ranking,
    secondOrderWins: teamData.secondOrderWins,
    sos: teamData.sos, // Strength of Schedule
    offense: {
      rating: teamData.offense?.rating,
      ranking: teamData.offense?.ranking
    },
    defense: {
      rating: teamData.defense?.rating,
      ranking: teamData.defense?.ranking
    },
    specialTeams: {
      rating: teamData.specialTeams?.rating,
      ranking: teamData.specialTeams?.ranking
    }
  };
}

/**
 * Get team records by year
 */
export async function getTeamRecords(teamName, year = new Date().getFullYear()) {
  const endpoint = `/records?year=${year}&team=${encodeURIComponent(teamName)}`;
  const data = await fetchCFBD(endpoint);
  
  if (!data || data.length === 0) {
    return null;
  }
  
  const teamData = data[0];
  
  return {
    year,
    team: teamData.team,
    conference: teamData.conference,
    division: teamData.division,
    total: {
      games: teamData.total?.games,
      wins: teamData.total?.wins,
      losses: teamData.total?.losses,
      ties: teamData.total?.ties
    },
    conferenceGames: {
      games: teamData.conferenceGames?.games,
      wins: teamData.conferenceGames?.wins,
      losses: teamData.conferenceGames?.losses,
      ties: teamData.conferenceGames?.ties
    },
    homeGames: {
      games: teamData.homeGames?.games,
      wins: teamData.homeGames?.wins,
      losses: teamData.homeGames?.losses,
      ties: teamData.homeGames?.ties
    },
    awayGames: {
      games: teamData.awayGames?.games,
      wins: teamData.awayGames?.wins,
      losses: teamData.awayGames?.losses,
      ties: teamData.awayGames?.ties
    }
  };
}

/**
 * Clear CFBD cache
 */
export function clearCFBDCache() {
  cache.clear();
  console.log('CFBD cache cleared');
}
