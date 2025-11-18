/**
 * ESPN MCP SERVER
 * Multi-source sports data API combining ESPN, CFBD, and NCAA
 * Created by Kevin - The Botosphere
 */

import express from 'express';
import cors from 'cors';
import { 
  getCurrentGame, 
  getTeamSchedule, 
  getScoreboard, 
  getRankings,
  clearCache as clearESPNCache
} from './espn-api.js';
import {
  getRecruiting,
  getTeamTalent,
  getAdvancedStats,
  getBettingLines,
  getSPRatings,
  getTeamRecords,
  clearCFBDCache
} from './cfbd-api.js';
import {
  getNCAAScoreboad,
  getNCAAankings,
  clearNCAACache
} from './ncaa-api.js';
import {
  formatGameResponse,
  formatScheduleResponse,
  formatScoreboardResponse,
  formatRankingsResponse
} from './formatter.js';

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

/**
 * ROOT ENDPOINT - Server info and available endpoints
 */
app.get('/', (req, res) => {
  res.json({
    name: 'ESPN MCP Server',
    version: '2.0.0',
    description: 'Multi-source college sports data API',
    sources: ['ESPN', 'CollegeFootballData.com', 'NCAA.com'],
    endpoints: {
      mcp: {
        '/mcp': 'MCP protocol endpoint (POST, requires Bearer token)'
      },
      espn: {
        '/score': 'Get current/recent game score for a team',
        '/schedule': 'Get team schedule',
        '/scoreboard': 'Get today\'s games across all teams',
        '/rankings': 'Get AP Top 25 rankings'
      },
      cfbd: {
        '/cfbd/recruiting': 'Get recruiting class rankings',
        '/cfbd/talent': 'Get team talent composite',
        '/cfbd/stats': 'Get advanced team statistics',
        '/cfbd/betting': 'Get betting lines',
        '/cfbd/ratings': 'Get SP+ ratings',
        '/cfbd/records': 'Get team records'
      },
      ncaa: {
        '/ncaa/scoreboard': 'Get NCAA scoreboard (all divisions)',
        '/ncaa/rankings': 'Get NCAA rankings'
      },
      utility: {
        '/health': 'Health check',
        '/clear-cache': 'Clear all caches'
      }
    },
    examples: {
      mcp: 'POST /mcp with Bearer token',
      score: '/score?team=oklahoma&sport=football&format=text',
      schedule: '/schedule?team=oklahoma&sport=football&limit=5',
      scoreboard: '/scoreboard?sport=football',
      recruiting: '/cfbd/recruiting?team=oklahoma&year=2025',
      ncaa: '/ncaa/scoreboard?sport=football&division=fbs'
    },
    status: 'operational',
    timestamp: new Date().toISOString()
  });
});

/**
 * HEALTH CHECK
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

/**
 * MCP ENDPOINT - For bot integration
 * Requires Bearer token authentication
 */
app.post('/mcp', async (req, res) => {
  try {
    // Check authentication
    const authHeader = req.headers.authorization;
    const apiKey = process.env.MCP_API_KEY || 'default-key-change-me';
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false,
        error: 'Missing or invalid authorization header. Use: Authorization: Bearer YOUR_API_KEY' 
      });
    }
    
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (token !== apiKey) {
      return res.status(401).json({ 
        success: false,
        error: 'Invalid API key' 
      });
    }
    
    // Parse MCP request
    const { tool, parameters = {} } = req.body;
    
    if (!tool) {
      return res.status(400).json({ 
        success: false,
        error: 'Tool name required in request body' 
      });
    }
    
    console.log(`MCP request: ${tool}`, parameters);
    
    // Route to appropriate function
    let result;
    
    switch (tool) {
      case 'get_score':
      case 'score':
        const team = parameters.team || 'oklahoma';
        const sport = parameters.sport || 'football';
        const game = await getCurrentGame(team, sport);
        result = game ? formatGameResponse(game) : `No recent games found for ${team}`;
        break;
        
      case 'get_schedule':
      case 'schedule':
        const schedTeam = parameters.team || 'oklahoma';
        const schedSport = parameters.sport || 'football';
        const limit = parameters.limit || 5;
        const schedule = await getTeamSchedule(schedTeam, schedSport);
        result = formatScheduleResponse(schedule, limit);
        break;
        
      case 'get_scoreboard':
      case 'scoreboard':
        const sbSport = parameters.sport || 'football';
        const scoreboard = await getScoreboard(sbSport);
        result = formatScoreboardResponse(scoreboard);
        break;
        
      case 'get_rankings':
      case 'rankings':
        const rankSport = parameters.sport || 'football';
        const rankings = await getRankings(rankSport);
        result = rankings ? formatRankingsResponse(rankings, 25) : 'No rankings available';
        break;
        
      case 'get_recruiting':
      case 'recruiting':
        const recTeam = parameters.team || 'oklahoma';
        const recYear = parameters.year;
        const recruiting = await getRecruiting(recTeam, recYear);
        if (recruiting) {
          result = `🎓 ${recruiting.team} ${recruiting.year} Recruiting Class:\n` +
                   `• National Rank: #${recruiting.rank}\n` +
                   `• Total Points: ${recruiting.points}\n` +
                   `• Commits: ${recruiting.commits}\n` +
                   `• Average Star Rating: ${recruiting.avgStars}⭐`;
        } else {
          result = `No recruiting data found for ${recTeam}`;
        }
        break;
        
      case 'get_talent':
      case 'talent':
        const talentTeam = parameters.team || 'oklahoma';
        const talentYear = parameters.year;
        const talent = await getTeamTalent(talentTeam, talentYear);
        if (talent) {
          result = `💪 ${talent.team} ${talent.year} Talent Composite:\n` +
                   `• Talent Rating: ${talent.talent}\n` +
                   `• National Rank: #${talent.rank}`;
        } else {
          result = `No talent data found for ${talentTeam}`;
        }
        break;
        
      case 'get_stats':
      case 'stats':
      case 'advanced_stats':
        const statsTeam = parameters.team || 'oklahoma';
        const statsYear = parameters.year;
        const stats = await getAdvancedStats(statsTeam, statsYear);
        if (stats) {
          result = `📊 ${stats.team} ${stats.year} Advanced Stats:\n\n` +
                   `Offense:\n` +
                   `• EPA per Play: ${stats.offense.ppa?.toFixed(3) || 'N/A'}\n` +
                   `• Success Rate: ${stats.offense.successRate?.toFixed(1) || 'N/A'}%\n` +
                   `• Explosiveness: ${stats.offense.explosiveness?.toFixed(3) || 'N/A'}\n\n` +
                   `Defense:\n` +
                   `• EPA per Play: ${stats.defense.ppa?.toFixed(3) || 'N/A'}\n` +
                   `• Success Rate: ${stats.defense.successRate?.toFixed(1) || 'N/A'}%\n` +
                   `• Havoc Rate: ${stats.defense.havoc?.total?.toFixed(1) || 'N/A'}%`;
        } else {
          result = `No stats found for ${statsTeam}`;
        }
        break;
        
      case 'get_betting':
      case 'betting':
      case 'betting_lines':
        const betTeam = parameters.team || 'oklahoma';
        const betYear = parameters.year;
        const betWeek = parameters.week;
        const lines = await getBettingLines(betTeam, betYear, betWeek);
        if (lines && lines.length > 0) {
          const latest = lines[0];
          const line = latest.lines && latest.lines.length > 0 ? latest.lines[0] : null;
          if (line) {
            result = `💰 ${latest.awayTeam} at ${latest.homeTeam} Betting Lines:\n` +
                     `• Spread: ${line.formattedSpread || 'N/A'}\n` +
                     `• Over/Under: ${line.overUnder || 'N/A'}\n` +
                     `• ${latest.homeTeam} ML: ${line.homeMoneyline || 'N/A'}\n` +
                     `• ${latest.awayTeam} ML: ${line.awayMoneyline || 'N/A'}`;
          } else {
            result = `Betting lines found but no odds available for ${betTeam}`;
          }
        } else {
          result = `No betting lines found for ${betTeam}`;
        }
        break;
        
      case 'get_ratings':
      case 'ratings':
      case 'sp_ratings':
        const ratTeam = parameters.team || 'oklahoma';
        const ratYear = parameters.year;
        const ratings = await getSPRatings(ratTeam, ratYear);
        if (ratings) {
          result = `⚡ ${ratings.team} ${ratings.year} SP+ Ratings:\n` +
                   `• Overall: ${ratings.rating?.toFixed(1)} (#${ratings.ranking})\n` +
                   `• Offense: ${ratings.offense?.rating?.toFixed(1)} (#${ratings.offense?.ranking})\n` +
                   `• Defense: ${ratings.defense?.rating?.toFixed(1)} (#${ratings.defense?.ranking})\n` +
                   `• Special Teams: ${ratings.specialTeams?.rating?.toFixed(1)}`;
        } else {
          result = `No SP+ ratings found for ${ratTeam}`;
        }
        break;
        
      case 'get_records':
      case 'records':
        const recTeamName = parameters.team || 'oklahoma';
        const recYearVal = parameters.year;
        const records = await getTeamRecords(recTeamName, recYearVal);
        if (records) {
          result = `📋 ${records.team} ${records.year} Records:\n` +
                   `• Overall: ${records.total?.wins}-${records.total?.losses}\n` +
                   `• Conference: ${records.conferenceGames?.wins}-${records.conferenceGames?.losses}\n` +
                   `• Home: ${records.homeGames?.wins}-${records.homeGames?.losses}\n` +
                   `• Away: ${records.awayGames?.wins}-${records.awayGames?.losses}`;
        } else {
          result = `No records found for ${recTeamName}`;
        }
        break;
        
      case 'ncaa_scoreboard':
        const ncaaSport = parameters.sport || 'football';
        const ncaaDiv = parameters.division || 'fbs';
        const ncaaDate = parameters.date;
        const ncaaScoreboard = await getNCAAScoreboad(ncaaSport, ncaaDiv, ncaaDate);
        if (ncaaScoreboard.games && ncaaScoreboard.games.length > 0) {
          result = `🏈 ${ncaaSport.toUpperCase()} ${ncaaDiv.toUpperCase()} Games:\n\n`;
          ncaaScoreboard.games.slice(0, 10).forEach((game, i) => {
            result += `${i + 1}. ${game.away.shortName} ${game.away.score || 0} at ${game.home.shortName} ${game.home.score || 0}`;
            if (game.status) result += ` (${game.status})`;
            result += '\n';
          });
        } else {
          result = `No ${ncaaSport} games found for ${ncaaDiv.toUpperCase()}`;
        }
        break;
        
      case 'ncaa_rankings':
        const ncaaRankSport = parameters.sport || 'football';
        const ncaaRankDiv = parameters.division || 'fbs';
        const ncaaPoll = parameters.poll || 'associated-press';
        const ncaaRankings = await getNCAAankings(ncaaRankSport, ncaaRankDiv, ncaaPoll);
        if (ncaaRankings && ncaaRankings.rankings) {
          result = `🏆 ${ncaaPoll.toUpperCase()} ${ncaaRankSport.toUpperCase()} Rankings:\n\n`;
          ncaaRankings.rankings.slice(0, 25).forEach(team => {
            result += `${team.rank}. ${team.school} (${team.record})`;
            if (team.points) result += ` - ${team.points} pts`;
            result += '\n';
          });
        } else {
          result = 'No NCAA rankings available';
        }
        break;
        
      default:
        return res.status(400).json({ 
          success: false,
          error: `Unknown tool: ${tool}`,
          availableTools: [
            'get_score', 'get_schedule', 'get_scoreboard', 'get_rankings',
            'get_recruiting', 'get_talent', 'get_stats', 'get_betting',
            'get_ratings', 'get_records', 'ncaa_scoreboard', 'ncaa_rankings'
          ]
        });
    }
    
    // Return MCP response
    res.json({
      success: true,
      tool,
      parameters,
      result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('MCP endpoint error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      tool: req.body?.tool
    });
  }
});

/**
 * ESPN ENDPOINTS
 */

// Get current game score
app.get('/score', async (req, res) => {
  try {
    const { team, sport = 'football', format = 'json' } = req.query;
    
    if (!team) {
      return res.status(400).json({ error: 'Team parameter required' });
    }
    
    const game = await getCurrentGame(team, sport);
    
    if (!game) {
      return res.json({ 
        message: `No recent or upcoming games found for ${team}`,
        team,
        sport
      });
    }
    
    if (format === 'text') {
      const formatted = formatGameResponse(game);
      return res.send(formatted);
    }
    
    res.json(game);
  } catch (error) {
    console.error('Score error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get team schedule
app.get('/schedule', async (req, res) => {
  try {
    const { team, sport = 'football', limit = 10, format = 'json' } = req.query;
    
    if (!team) {
      return res.status(400).json({ error: 'Team parameter required' });
    }
    
    const schedule = await getTeamSchedule(team, sport);
    
    if (format === 'text') {
      const formatted = formatScheduleResponse(schedule, parseInt(limit));
      return res.send(formatted);
    }
    
    // Limit results
    if (schedule.events) {
      schedule.events = schedule.events.slice(0, parseInt(limit));
    }
    
    res.json(schedule);
  } catch (error) {
    console.error('Schedule error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get scoreboard
app.get('/scoreboard', async (req, res) => {
  try {
    const { sport = 'football', date, format = 'json' } = req.query;
    
    const scoreboard = await getScoreboard(sport, date);
    
    if (format === 'text') {
      const formatted = formatScoreboardResponse(scoreboard);
      return res.send(formatted);
    }
    
    res.json(scoreboard);
  } catch (error) {
    console.error('Scoreboard error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get rankings
app.get('/rankings', async (req, res) => {
  try {
    const { sport = 'football', top = 25, format = 'json' } = req.query;
    
    const rankings = await getRankings(sport);
    
    if (!rankings) {
      return res.json({ message: 'No rankings available' });
    }
    
    if (format === 'text') {
      const formatted = formatRankingsResponse(rankings, parseInt(top));
      return res.send(formatted);
    }
    
    res.json(rankings);
  } catch (error) {
    console.error('Rankings error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * CFBD ENDPOINTS (Advanced analytics)
 */

// Get recruiting rankings
app.get('/cfbd/recruiting', async (req, res) => {
  try {
    const { team, year, format = 'json' } = req.query;
    
    if (!team) {
      return res.status(400).json({ error: 'Team parameter required' });
    }
    
    const recruiting = await getRecruiting(team, year ? parseInt(year) : undefined);
    
    if (!recruiting) {
      return res.json({ message: `No recruiting data found for ${team}` });
    }
    
    if (format === 'text') {
      return res.send(
        `🎓 ${recruiting.team} ${recruiting.year} Recruiting Class:\n` +
        `• National Rank: #${recruiting.rank}\n` +
        `• Total Points: ${recruiting.points}\n` +
        `• Commits: ${recruiting.commits}\n` +
        `• Average Star Rating: ${recruiting.avgStars}⭐`
      );
    }
    
    res.json(recruiting);
  } catch (error) {
    console.error('Recruiting error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get team talent
app.get('/cfbd/talent', async (req, res) => {
  try {
    const { team, year, format = 'json' } = req.query;
    
    if (!team) {
      return res.status(400).json({ error: 'Team parameter required' });
    }
    
    const talent = await getTeamTalent(team, year ? parseInt(year) : undefined);
    
    if (!talent) {
      return res.json({ message: `No talent data found for ${team}` });
    }
    
    if (format === 'text') {
      return res.send(
        `💪 ${talent.team} ${talent.year} Talent Composite:\n` +
        `• Talent Rating: ${talent.talent}\n` +
        `• National Rank: #${talent.rank}`
      );
    }
    
    res.json(talent);
  } catch (error) {
    console.error('Talent error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get advanced stats
app.get('/cfbd/stats', async (req, res) => {
  try {
    const { team, year, format = 'json' } = req.query;
    
    if (!team) {
      return res.status(400).json({ error: 'Team parameter required' });
    }
    
    const stats = await getAdvancedStats(team, year ? parseInt(year) : undefined);
    
    if (!stats) {
      return res.json({ message: `No stats found for ${team}` });
    }
    
    if (format === 'text') {
      return res.send(
        `📊 ${stats.team} ${stats.year} Advanced Stats:\n\n` +
        `Offense:\n` +
        `• EPA per Play: ${stats.offense.ppa?.toFixed(3) || 'N/A'}\n` +
        `• Success Rate: ${stats.offense.successRate?.toFixed(1) || 'N/A'}%\n` +
        `• Explosiveness: ${stats.offense.explosiveness?.toFixed(3) || 'N/A'}\n\n` +
        `Defense:\n` +
        `• EPA per Play: ${stats.defense.ppa?.toFixed(3) || 'N/A'}\n` +
        `• Success Rate: ${stats.defense.successRate?.toFixed(1) || 'N/A'}%\n` +
        `• Havoc Rate: ${stats.defense.havoc?.total?.toFixed(1) || 'N/A'}%`
      );
    }
    
    res.json(stats);
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get betting lines
app.get('/cfbd/betting', async (req, res) => {
  try {
    const { team, year, week, format = 'json' } = req.query;
    
    if (!team) {
      return res.status(400).json({ error: 'Team parameter required' });
    }
    
    const lines = await getBettingLines(
      team, 
      year ? parseInt(year) : undefined,
      week ? parseInt(week) : undefined
    );
    
    if (!lines || lines.length === 0) {
      return res.json({ message: `No betting lines found for ${team}` });
    }
    
    if (format === 'text') {
      const latest = lines[0];
      const line = latest.lines[0];
      return res.send(
        `💰 ${latest.awayTeam} at ${latest.homeTeam} Betting Lines:\n` +
        `• Spread: ${line?.formattedSpread || 'N/A'}\n` +
        `• Over/Under: ${line?.overUnder || 'N/A'}\n` +
        `• ${latest.homeTeam} Moneyline: ${line?.homeMoneyline || 'N/A'}\n` +
        `• ${latest.awayTeam} Moneyline: ${line?.awayMoneyline || 'N/A'}`
      );
    }
    
    res.json(lines);
  } catch (error) {
    console.error('Betting error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get SP+ ratings
app.get('/cfbd/ratings', async (req, res) => {
  try {
    const { team, year, format = 'json' } = req.query;
    
    if (!team) {
      return res.status(400).json({ error: 'Team parameter required' });
    }
    
    const ratings = await getSPRatings(team, year ? parseInt(year) : undefined);
    
    if (!ratings) {
      return res.json({ message: `No SP+ ratings found for ${team}` });
    }
    
    if (format === 'text') {
      return res.send(
        `⚡ ${ratings.team} ${ratings.year} SP+ Ratings:\n` +
        `• Overall: ${ratings.rating?.toFixed(1)} (#${ratings.ranking})\n` +
        `• Offense: ${ratings.offense.rating?.toFixed(1)} (#${ratings.offense.ranking})\n` +
        `• Defense: ${ratings.defense.rating?.toFixed(1)} (#${ratings.defense.ranking})\n` +
        `• Special Teams: ${ratings.specialTeams.rating?.toFixed(1)}`
      );
    }
    
    res.json(ratings);
  } catch (error) {
    console.error('Ratings error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get team records
app.get('/cfbd/records', async (req, res) => {
  try {
    const { team, year, format = 'json' } = req.query;
    
    if (!team) {
      return res.status(400).json({ error: 'Team parameter required' });
    }
    
    const records = await getTeamRecords(team, year ? parseInt(year) : undefined);
    
    if (!records) {
      return res.json({ message: `No records found for ${team}` });
    }
    
    if (format === 'text') {
      return res.send(
        `📋 ${records.team} ${records.year} Records:\n` +
        `• Overall: ${records.total.wins}-${records.total.losses}\n` +
        `• Conference: ${records.conferenceGames.wins}-${records.conferenceGames.losses}\n` +
        `• Home: ${records.homeGames.wins}-${records.homeGames.losses}\n` +
        `• Away: ${records.awayGames.wins}-${records.awayGames.losses}`
      );
    }
    
    res.json(records);
  } catch (error) {
    console.error('Records error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * NCAA ENDPOINTS (Multi-division coverage)
 */

// Get NCAA scoreboard
app.get('/ncaa/scoreboard', async (req, res) => {
  try {
    const { sport = 'football', division = 'fbs', date, format = 'json' } = req.query;
    
    const scoreboard = await getNCAAScoreboad(sport, division, date);
    
    if (format === 'text') {
      if (!scoreboard.games || scoreboard.games.length === 0) {
        return res.send(`No ${sport} games found for ${division.toUpperCase()}`);
      }
      
      let text = `🏈 ${sport.toUpperCase()} ${division.toUpperCase()} Games:\n\n`;
      scoreboard.games.forEach((game, i) => {
        text += `${i + 1}. ${game.away.shortName} ${game.away.score || 0} at ${game.home.shortName} ${game.home.score || 0}`;
        if (game.status) text += ` (${game.status})`;
        text += '\n';
      });
      return res.send(text);
    }
    
    res.json(scoreboard);
  } catch (error) {
    console.error('NCAA scoreboard error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get NCAA rankings
app.get('/ncaa/rankings', async (req, res) => {
  try {
    const { 
      sport = 'football', 
      division = 'fbs', 
      poll = 'associated-press',
      format = 'json' 
    } = req.query;
    
    const rankings = await getNCAAankings(sport, division, poll);
    
    if (!rankings) {
      return res.json({ message: 'No rankings available' });
    }
    
    if (format === 'text') {
      let text = `🏆 ${poll.toUpperCase()} ${sport.toUpperCase()} Rankings:\n\n`;
      rankings.rankings.slice(0, 25).forEach(team => {
        text += `${team.rank}. ${team.school} (${team.record})`;
        if (team.points) text += ` - ${team.points} pts`;
        text += '\n';
      });
      return res.send(text);
    }
    
    res.json(rankings);
  } catch (error) {
    console.error('NCAA rankings error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * UTILITY ENDPOINTS
 */

// Clear all caches
app.post('/clear-cache', (req, res) => {
  clearESPNCache();
  clearCFBDCache();
  clearNCAACache();
  
  res.json({ 
    message: 'All caches cleared successfully',
    timestamp: new Date().toISOString()
  });
});

/**
 * ERROR HANDLING
 */
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    availableEndpoints: [
      'POST /mcp (with Bearer token)',
      '/score', '/schedule', '/scoreboard', '/rankings',
      '/cfbd/recruiting', '/cfbd/talent', '/cfbd/stats',
      '/ncaa/scoreboard', '/ncaa/rankings'
    ]
  });
});

app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

/**
 * START SERVER
 */
app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('ESPN MCP SERVER');
  console.log('Multi-Source College Sports Data API');
  console.log('='.repeat(60));
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`MCP endpoint: http://localhost:${PORT}/mcp (POST)`);
  console.log(`Documentation: http://localhost:${PORT}/`);
  console.log('='.repeat(60));
  console.log('Sources:');
  console.log('  • ESPN API (real-time scores & schedules)');
  console.log('  • CFBD API (analytics, recruiting, betting)');
  console.log('  • NCAA API (multi-division coverage)');
  console.log('='.repeat(60));
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log('='.repeat(60));
});

