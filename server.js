/**
 * ESPN MCP SERVER - COMPLETE WITH ALL API INTEGRATIONS
 * Multi-source sports data API combining ESPN, CFBD, and NCAA
 * JSON-RPC 2.0 Compliant MCP Server
 * Created for The Botosphere - Boomer Bot
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
  clearCache as clearCFBDCache
} from './cfbd-api.js';
import {
  getNCAAScoreboard,
  getNCAAankings,
  getConferenceStandings,
  clearCache as clearNCAACache
} from './ncaa-api.js';

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
 * ROOT ENDPOINT - Server info
 */
app.get('/', (req, res) => {
  res.json({
    name: 'ESPN MCP Server',
    version: '2.0.0',
    description: 'Multi-source college sports data API - JSON-RPC 2.0 Compliant',
    sources: ['ESPN', 'CollegeFootballData.com', 'NCAA.com'],
    mcpEndpoint: 'POST /mcp (requires Bearer token)',
    tools: 12,
    status: 'operational',
    timestamp: new Date().toISOString(),
    note: 'CFBD tools require CFBD_API_KEY environment variable'
  });
});

/**
 * HEALTH CHECK
 */
app.get('/health', (req, res) => {
  const hasCFBDKey = !!process.env.CFBD_API_KEY;
  
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    cfbdEnabled: hasCFBDKey,
    timestamp: new Date().toISOString()
  });
});

/**
 * MCP ENDPOINT - JSON-RPC 2.0 COMPLIANT
 * Handles tool discovery and tool calls
 */
app.post('/mcp', async (req, res) => {
  try {
    // Authentication check
    const authHeader = req.headers.authorization;
    const apiKey = process.env.MCP_API_KEY || 'sk_live_boomerbot_a8f7d2e9c4b1x6m3n5p9q2r8t4w7y1z3';
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.json({
        jsonrpc: '2.0',
        error: {
          code: -32001,
          message: 'Missing or invalid authorization header. Use: Authorization: Bearer YOUR_API_KEY'
        },
        id: req.body?.id || null
      });
    }
    
    const token = authHeader.substring(7);
    
    if (token !== apiKey) {
      return res.json({
        jsonrpc: '2.0',
        error: {
          code: -32002,
          message: 'Invalid API key'
        },
        id: req.body?.id || null
      });
    }
    
    // Parse JSON-RPC request
    const { jsonrpc, method, params = {}, id } = req.body;
    
    // Validate JSON-RPC version
    if (jsonrpc !== '2.0') {
      return res.json({
        jsonrpc: '2.0',
        error: {
          code: -32600,
          message: 'Invalid Request: jsonrpc must be "2.0"'
        },
        id: id || null
      });
    }
    
    // Validate method exists
    if (!method) {
      return res.json({
        jsonrpc: '2.0',
        error: {
          code: -32600,
          message: 'Invalid Request: method is required'
        },
        id: id || null
      });
    }
    
    console.log(`JSON-RPC Method: ${method}`, params);
    
    // ===== TOOL DISCOVERY =====
    if (method === 'tools/list') {
      return res.json({
        jsonrpc: '2.0',
        id: id,
        result: {
          tools: [
            // ESPN TOOLS
            {
              name: 'get_score',
              description: 'Get current or most recent game score for a specific team. Returns live score if game is in progress, or final score from most recent completed game.',
              inputSchema: {
                type: 'object',
                properties: {
                  team: {
                    type: 'string',
                    description: 'Team name (e.g., "oklahoma", "texas", "alabama")'
                  },
                  sport: {
                    type: 'string',
                    description: 'Sport type (default: "football")',
                    enum: ['football', 'basketball', 'baseball']
                  }
                },
                required: ['team']
              }
            },
            {
              name: 'get_schedule',
              description: 'Get upcoming schedule for a specific team, including game dates, opponents, locations, and broadcast info.',
              inputSchema: {
                type: 'object',
                properties: {
                  team: {
                    type: 'string',
                    description: 'Team name'
                  },
                  sport: {
                    type: 'string',
                    description: 'Sport type (default: "football")'
                  },
                  limit: {
                    type: 'number',
                    description: 'Number of games to return (default: 5, max: 20)'
                  }
                },
                required: ['team']
              }
            },
            {
              name: 'get_scoreboard',
              description: 'Get scoreboard showing all games for today across all teams. Shows live scores and final scores.',
              inputSchema: {
                type: 'object',
                properties: {
                  sport: {
                    type: 'string',
                    description: 'Sport type (default: "football")'
                  },
                  date: {
                    type: 'string',
                    description: 'Date in YYYYMMDD format (default: today)'
                  }
                },
                required: []
              }
            },
            {
              name: 'get_rankings',
              description: 'Get current AP Top 25 rankings or other poll rankings.',
              inputSchema: {
                type: 'object',
                properties: {
                  sport: {
                    type: 'string',
                    description: 'Sport type (default: "football")'
                  },
                  poll: {
                    type: 'string',
                    description: 'Poll type: "ap" (AP Top 25) or "coaches" (default: "ap")'
                  }
                },
                required: []
              }
            },
            
            // CFBD TOOLS (Advanced Analytics)
            {
              name: 'get_stats',
              description: 'Get advanced team statistics including offensive/defensive efficiency, EPA (Expected Points Added), success rates, and explosiveness metrics. Requires CFBD API key.',
              inputSchema: {
                type: 'object',
                properties: {
                  team: {
                    type: 'string',
                    description: 'Team name'
                  },
                  year: {
                    type: 'number',
                    description: 'Season year (default: current year)'
                  },
                  stat_type: {
                    type: 'string',
                    description: 'Type of stats: "offense", "defense", or "both" (default: "both")'
                  }
                },
                required: ['team']
              }
            },
            {
              name: 'get_recruiting',
              description: 'Get recruiting class rankings, including national ranking, average star rating, number of commits, and top recruits. Requires CFBD API key.',
              inputSchema: {
                type: 'object',
                properties: {
                  team: {
                    type: 'string',
                    description: 'Team name'
                  },
                  year: {
                    type: 'number',
                    description: 'Recruiting class year (default: current year)'
                  }
                },
                required: ['team']
              }
            },
            {
              name: 'get_talent',
              description: 'Get team talent composite score - a measure of overall roster talent based on recruiting rankings. Requires CFBD API key.',
              inputSchema: {
                type: 'object',
                properties: {
                  team: {
                    type: 'string',
                    description: 'Team name'
                  },
                  year: {
                    type: 'number',
                    description: 'Season year (default: current year)'
                  }
                },
                required: ['team']
              }
            },
            {
              name: 'get_betting',
              description: 'Get betting lines including point spreads, over/under, and moneyline for upcoming games. Requires CFBD API key.',
              inputSchema: {
                type: 'object',
                properties: {
                  team: {
                    type: 'string',
                    description: 'Team name'
                  },
                  week: {
                    type: 'number',
                    description: 'Week number (optional)'
                  }
                },
                required: ['team']
              }
            },
            {
              name: 'get_ratings',
              description: 'Get SP+ ratings (statistical power ratings) for teams including offensive, defensive, and special teams ratings. Requires CFBD API key.',
              inputSchema: {
                type: 'object',
                properties: {
                  team: {
                    type: 'string',
                    description: 'Team name'
                  },
                  year: {
                    type: 'number',
                    description: 'Season year (default: current year)'
                  }
                },
                required: ['team']
              }
            },
            {
              name: 'get_records',
              description: 'Get team win-loss records including overall, home, away, and conference records. Requires CFBD API key.',
              inputSchema: {
                type: 'object',
                properties: {
                  team: {
                    type: 'string',
                    description: 'Team name'
                  },
                  year: {
                    type: 'number',
                    description: 'Season year (default: current year)'
                  }
                },
                required: ['team']
              }
            },
            
            // NCAA TOOLS (Multi-division)
            {
              name: 'get_ncaa_scoreboard',
              description: 'Get NCAA scoreboard for any sport and any division (FBS, FCS, Division II, Division III).',
              inputSchema: {
                type: 'object',
                properties: {
                  sport: {
                    type: 'string',
                    description: 'Sport (e.g., "football", "basketball", "baseball", "softball")'
                  },
                  division: {
                    type: 'string',
                    description: 'Division: "fbs", "fcs", "d2", "d3" (default: "fbs")'
                  },
                  date: {
                    type: 'string',
                    description: 'Date in YYYYMMDD format (default: today)'
                  }
                },
                required: ['sport']
              }
            },
            {
              name: 'get_ncaa_rankings',
              description: 'Get NCAA poll rankings for any sport and division.',
              inputSchema: {
                type: 'object',
                properties: {
                  sport: {
                    type: 'string',
                    description: 'Sport name'
                  },
                  division: {
                    type: 'string',
                    description: 'Division: "fbs", "fcs", "d2", "d3" (default: "fbs")'
                  },
                  poll: {
                    type: 'string',
                    description: 'Poll type: "ap", "coaches", "playoff" (default: "ap")'
                  }
                },
                required: ['sport']
              }
            }
          ]
        }
      });
    }
    
    // ===== TOOL CALLS =====
    if (method === 'tools/call') {
      const { name, arguments: args } = params;
      
      if (!name) {
        return res.json({
          jsonrpc: '2.0',
          error: {
            code: -32602,
            message: 'Invalid params: tool name is required'
          },
          id: id
        });
      }
      
      console.log(`Tool call: ${name}`, args);
      
      // Route to appropriate handler
      let result;
      
      try {
        switch (name) {
          // ESPN TOOLS
          case 'get_score':
            result = await handleGetScore(args);
            break;
          case 'get_schedule':
            result = await handleGetSchedule(args);
            break;
          case 'get_scoreboard':
            result = await handleGetScoreboard(args);
            break;
          case 'get_rankings':
            result = await handleGetRankings(args);
            break;
          
          // CFBD TOOLS
          case 'get_stats':
            result = await handleGetStats(args);
            break;
          case 'get_recruiting':
            result = await handleGetRecruiting(args);
            break;
          case 'get_talent':
            result = await handleGetTalent(args);
            break;
          case 'get_betting':
            result = await handleGetBetting(args);
            break;
          case 'get_ratings':
            result = await handleGetRatings(args);
            break;
          case 'get_records':
            result = await handleGetRecords(args);
            break;
          
          // NCAA TOOLS
          case 'get_ncaa_scoreboard':
            result = await handleGetNCAAScoreboard(args);
            break;
          case 'get_ncaa_rankings':
            result = await handleGetNCAAankings(args);
            break;
          
          default:
            return res.json({
              jsonrpc: '2.0',
              error: {
                code: -32601,
                message: `Unknown tool: ${name}. Use tools/list to see available tools.`
              },
              id: id
            });
        }
        
        // Return successful result
        return res.json({
          jsonrpc: '2.0',
          id: id,
          result: {
            content: [
              {
                type: 'text',
                text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
              }
            ]
          }
        });
        
      } catch (error) {
        console.error(`Tool ${name} error:`, error);
        return res.json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: `Tool execution failed: ${error.message}`
          },
          id: id
        });
      }
    }
    
    // Unknown method
    return res.json({
      jsonrpc: '2.0',
      error: {
        code: -32601,
        message: `Method not found: ${method}`
      },
      id: id
    });
    
  } catch (error) {
    console.error('MCP endpoint error:', error);
    return res.json({
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: 'Internal error',
        data: error.message
      },
      id: req.body?.id || null
    });
  }
});

/**
 * TOOL HANDLERS - ESPN
 */

async function handleGetScore(args) {
  const { team, sport = 'football' } = args;
  const result = await getCurrentGame(team, sport);
  
  if (result.error) {
    return result.message;
  }
  
  const game = result.game;
  let text = `${game.name}\n`;
  text += `${game.status}`;
  
  if (game.isLive) {
    text += ` - ${game.period}Q ${game.clock}\n`;
  } else {
    text += `\n`;
  }
  
  text += `\n${game.awayTeam.name} (${game.awayTeam.record}): ${game.awayTeam.score}`;
  text += `\n${game.homeTeam.name} (${game.homeTeam.record}): ${game.homeTeam.score}`;
  
  if (game.venue) {
    text += `\n\nVenue: ${game.venue}`;
  }
  if (game.broadcast) {
    text += `\nTV: ${game.broadcast}`;
  }
  
  return text;
}

async function handleGetSchedule(args) {
  const { team, sport = 'football', limit = 5 } = args;
  const result = await getTeamSchedule(team, sport, limit);
  
  if (result.error) {
    return result.message;
  }
  
  let text = `Upcoming Schedule for ${result.team}:\n\n`;
  
  result.games.forEach((game, i) => {
    text += `${i + 1}. ${game.time}\n`;
    text += `   vs ${game.opponent} (${game.location})\n`;
    if (game.venue) {
      text += `   ${game.venue}\n`;
    }
    if (game.broadcast) {
      text += `   TV: ${game.broadcast}\n`;
    }
    text += `\n`;
  });
  
  return text;
}

async function handleGetScoreboard(args) {
  const { sport = 'football', date } = args;
  const result = await getScoreboard(sport, date);
  
  if (result.error) {
    return result.message;
  }
  
  let text = `Scoreboard for ${result.date}:\n\n`;
  
  result.games.forEach(game => {
    text += `${game.awayTeam.name} ${game.awayTeam.score} @ ${game.homeTeam.name} ${game.homeTeam.score}`;
    text += ` - ${game.status}`;
    if (game.isLive) {
      text += ` (${game.period}Q ${game.clock})`;
    }
    text += `\n`;
  });
  
  return text;
}

async function handleGetRankings(args) {
  const { sport = 'football', poll = 'ap' } = args;
  const result = await getRankings(sport, poll);
  
  if (result.error) {
    return result.message;
  }
  
  let text = `${result.poll} - Week ${result.week}\n\n`;
  
  result.teams.slice(0, 25).forEach(team => {
    text += `${team.rank}. ${team.team} (${team.record})`;
    if (team.points) {
      text += ` - ${team.points} pts`;
    }
    text += `\n`;
  });
  
  return text;
}

/**
 * TOOL HANDLERS - CFBD
 */

async function handleGetStats(args) {
  const { team, year, stat_type = 'both' } = args;
  const result = await getAdvancedStats(team, year, stat_type);
  
  if (result.error) {
    return result.message;
  }
  
  let text = `Advanced Stats for ${result.team} (${result.year}):\n\n`;
  
  if (result.offense) {
    text += `OFFENSE:\n`;
    text += `  EPA/Play: ${result.offense.ppa?.toFixed(3) || 'N/A'}\n`;
    text += `  Success Rate: ${(result.offense.successRate * 100)?.toFixed(1) || 'N/A'}%\n`;
    text += `  Explosiveness: ${result.offense.explosiveness?.toFixed(3) || 'N/A'}\n`;
    text += `  Stuff Rate: ${(result.offense.stuffRate * 100)?.toFixed(1) || 'N/A'}%\n\n`;
  }
  
  if (result.defense) {
    text += `DEFENSE:\n`;
    text += `  EPA/Play Allowed: ${result.defense.ppa?.toFixed(3) || 'N/A'}\n`;
    text += `  Success Rate Allowed: ${(result.defense.successRate * 100)?.toFixed(1) || 'N/A'}%\n`;
    text += `  Explosiveness Allowed: ${result.defense.explosiveness?.toFixed(3) || 'N/A'}\n`;
    text += `  Stuff Rate: ${(result.defense.stuffRate * 100)?.toFixed(1) || 'N/A'}%\n`;
  }
  
  return text;
}

async function handleGetRecruiting(args) {
  const { team, year } = args;
  const result = await getRecruiting(team, year);
  
  if (result.error) {
    return result.message;
  }
  
  let text = `Recruiting Class for ${result.team} (${result.year}):\n\n`;
  text += `National Rank: #${result.rank}\n`;
  text += `Total Points: ${result.points}\n`;
  text += `Number of Commits: ${result.commits}\n`;
  text += `Average Rating: ${result.average?.toFixed(2)} stars\n`;
  
  return text;
}

async function handleGetTalent(args) {
  const { team, year } = args;
  const result = await getTeamTalent(team, year);
  
  if (result.error) {
    return result.message;
  }
  
  return `Talent Composite for ${result.team} (${result.year}): ${result.talent?.toFixed(2) || 'N/A'}`;
}

async function handleGetBetting(args) {
  const { team, week } = args;
  const result = await getBettingLines(team, week);
  
  if (result.error) {
    return result.message;
  }
  
  let text = `Betting Lines for ${result.team}:\n\n`;
  
  result.games.forEach(game => {
    text += `${game.awayTeam} @ ${game.homeTeam}\n`;
    if (game.spread) {
      text += `  Spread: ${game.spread}\n`;
    }
    if (game.overUnder) {
      text += `  Over/Under: ${game.overUnder}\n`;
    }
    if (game.provider) {
      text += `  Source: ${game.provider}\n`;
    }
    text += `\n`;
  });
  
  return text;
}

async function handleGetRatings(args) {
  const { team, year } = args;
  const result = await getSPRatings(team, year);
  
  if (result.error) {
    return result.message;
  }
  
  let text = `SP+ Ratings for ${result.team} (${result.year}):\n\n`;
  text += `Overall Rating: ${result.rating?.toFixed(2) || 'N/A'}\n`;
  text += `National Rank: #${result.ranking || 'N/A'}\n`;
  text += `Offense: ${result.offense?.toFixed(2) || 'N/A'}\n`;
  text += `Defense: ${result.defense?.toFixed(2) || 'N/A'}\n`;
  text += `Special Teams: ${result.specialTeams?.toFixed(2) || 'N/A'}\n`;
  
  return text;
}

async function handleGetRecords(args) {
  const { team, year } = args;
  const result = await getTeamRecords(team, year);
  
  if (result.error) {
    return result.message;
  }
  
  let text = `Records for ${result.team} (${result.year}):\n\n`;
  text += `Overall: ${result.total.wins}-${result.total.losses}`;
  if (result.total.ties) text += `-${result.total.ties}`;
  text += `\n`;
  
  text += `Conference: ${result.conferenceGames.wins}-${result.conferenceGames.losses}\n`;
  text += `Home: ${result.homeGames.wins}-${result.homeGames.losses}\n`;
  text += `Away: ${result.awayGames.wins}-${result.awayGames.losses}\n`;
  
  return text;
}

/**
 * TOOL HANDLERS - NCAA
 */

async function handleGetNCAAScoreboard(args) {
  const { sport, division = 'fbs', date } = args;
  const result = await getNCAAScoreboard(sport, division, date);
  
  if (result.error) {
    return result.message;
  }
  
  let text = `${result.sport.toUpperCase()} ${result.division} Scoreboard (${result.date}):\n\n`;
  
  result.games.forEach(game => {
    text += `${game.awayTeam.name} ${game.awayTeam.score} @ ${game.homeTeam.name} ${game.homeTeam.score}`;
    text += ` - ${game.status}`;
    if (game.isLive) {
      text += ` (${game.period}Q ${game.clock})`;
    }
    text += `\n`;
  });
  
  return text;
}

async function handleGetNCAAankings(args) {
  const { sport, division = 'fbs', poll = 'ap' } = args;
  const result = await getNCAAankings(sport, division, poll);
  
  if (result.error) {
    return result.message;
  }
  
  let text = `${result.sport.toUpperCase()} ${result.division} - ${result.poll}\n`;
  text += `Week ${result.week}, Season ${result.season}\n\n`;
  
  result.teams.slice(0, 25).forEach(team => {
    text += `${team.rank}. ${team.team} (${team.record})`;
    if (team.points) {
      text += ` - ${team.points} pts`;
    }
    text += `\n`;
  });
  
  return text;
}

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
    availableEndpoints: {
      'POST /mcp': 'MCP JSON-RPC 2.0 endpoint (requires Bearer token)',
      'GET /': 'Server information',
      'GET /health': 'Health check',
      'POST /clear-cache': 'Clear all caches'
    }
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
  console.log('ESPN MCP SERVER - FULLY INTEGRATED');
  console.log('='.repeat(60));
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`MCP endpoint: http://localhost:${PORT}/mcp (POST with Bearer token)`);
  console.log('='.repeat(60));
  console.log('Data Sources:');
  console.log('  ✓ ESPN API (scores, schedules, rankings)');
  console.log(`  ${process.env.CFBD_API_KEY ? '✓' : '✗'} CFBD API (analytics, recruiting, betting)`);
  console.log('  ✓ NCAA API (multi-division coverage)');
  console.log('='.repeat(60));
  console.log('12 Tools Available:');
  console.log('  ESPN: get_score, get_schedule, get_scoreboard, get_rankings');
  console.log('  CFBD: get_stats, get_recruiting, get_talent, get_betting, get_ratings, get_records');
  console.log('  NCAA: get_ncaa_scoreboard, get_ncaa_rankings');
  console.log('='.repeat(60));
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log('='.repeat(60));
  
  if (!process.env.CFBD_API_KEY) {
    console.log('\n⚠️  WARNING: CFBD_API_KEY not set!');
    console.log('CFBD tools will not work without an API key.');
    console.log('Get free key at: https://collegefootballdata.com\n');
  }
});
