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
