/**
 * ESPN / CFBD / NCAA MCP SERVER
 * FULL VERSION — WITH TRADITIONAL + ADVANCED STATS SUPPORT
 * JSON-RPC 2.0 Compliant
 */

import express from 'express';
import cors from 'cors';

// ESPN
import {
  getCurrentGame,
  getTeamSchedule,
  getScoreboard,
  getRankings,
  clearCache as clearESPNCache
} from './espn-api.js';

// CFBD Advanced Stats + Recruiting + Ratings
import {
  getRecruiting,
  getTeamTalent,
  getAdvancedStats,
  getBettingLines,
  getSPRatings,
  getTeamRecords,
  clearCache as clearCFBDCache
} from './cfbd-api.js';

// 🚀 NEW — TRADITIONAL STATS
import { getTraditionalStats } from './stats.js';

// NCAA
import {
  getNCAAScoreboard,
  getNCAAankings,
  getConferenceStandings,
  clearCache as clearNCAACache
} from './ncaa-api.js';

const app = express();
const PORT = process.env.PORT || 8080;

/* ------------------------------
   Middleware
--------------------------------*/
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

/* ------------------------------
   ROOT ENDPOINT
--------------------------------*/
app.get('/', (req, res) => {
  res.json({
    name: 'ESPN MCP Server',
    version: '3.0.0',
    description: 'Multi-source sports engine for The Botosphere',
    sources: ['ESPN', 'CollegeFootballData', 'NCAA'],
    mcpEndpoint: 'POST /mcp',
    tools: 13,
    status: 'operational',
    timestamp: new Date().toISOString(),
  });
});

/* ------------------------------
   HEALTH
--------------------------------*/
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    cfbdEnabled: !!process.env.CFBD_API_KEY
  });
});

/* ------------------------------
   MCP ENDPOINT
--------------------------------*/
app.post('/mcp', async (req, res) => {
  try {
    const apiKey = process.env.MCP_API_KEY || 'sk_live_boomerbot_default_key';

    // AUTH CHECK
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.json({
        jsonrpc: "2.0",
        error: { code: -32001, message: "Missing Bearer token" },
        id: req.body?.id || null
      });
    }
    if (authHeader.substring(7) !== apiKey) {
      return res.json({
        jsonrpc: "2.0",
        error: { code: -32002, message: "Invalid API key" },
        id: req.body?.id || null
      });
    }

    // JSON-RPC parsing
    const { jsonrpc, method, params = {}, id } = req.body;

    if (jsonrpc !== '2.0') {
      return res.json({
        jsonrpc: "2.0",
        error: { code: -32600, message: "jsonrpc must be 2.0" },
        id
      });
    }

    console.log(`JSON-RPC Method = ${method}`);

    /* -------------------------------------
       INITIALIZE HANDSHAKE
    -------------------------------------*/
    if (method === "initialize") {
      return res.json({
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          serverInfo: {
            name: "BoomerBot Sports MCP",
            version: "3.0.0"
          }
        }
      });
    }

    /* -------------------------------------
       TOOL DISCOVERY
    -------------------------------------*/
    if (method === "tools/list") {
      return res.json({
        jsonrpc: "2.0",
        id,
        result: {
          tools: [
            // ESPN Tools
            {
              name: 'get_score',
              description: 'Get most recent or live game score.',
              inputSchema: {
                type: 'object',
                properties: {
                  team: { type: 'string' },
                  sport: { type: 'string', enum: ['football','basketball','baseball'], default:'football' }
                },
                required: ['team']
              }
            },
            {
              name: 'get_schedule',
              description: 'Get upcoming schedule.',
              inputSchema: {
                type:'object',
                properties:{
                  team:{type:'string'},
                  sport:{type:'string'},
                  limit:{type:'number'}
                },
                required:['team']
              }
            },
            {
              name:'get_scoreboard',
              description:'Full scoreboard for a date.',
              inputSchema:{
                type:'object',
                properties:{
                  sport:{type:'string'},
                  date:{type:'string'}
                }
              }
            },
            {
              name:'get_rankings',
              description:'AP/Coaches poll rankings.',
              inputSchema:{
                type:'object',
                properties:{
                  sport:{type:'string'},
                  poll:{type:'string'}
                }
              }
            },

            // 🚀 NEW: TRADITIONAL + ADVANCED STATS
            {
              name: 'get_stats',
              description: 'Get traditional stats, advanced analytics, or both.',
              inputSchema: {
                type: 'object',
                properties: {
                  team: { type:'string' },
                  year: { type:'number' },
                  stat_type: {
                    type:'string',
                    enum:['traditional','advanced','both'],
                    default:'traditional'
                  }
                },
                required:['team']
              }
            },

            // CFBD other tools
            {
              name:'get_recruiting',
              description:'Recruiting rankings.',
              inputSchema:{ type:'object', properties:{ team:{type:'string'}, year:{type:'number'} }, required:['team'] }
            },
            {
              name:'get_talent',
              description:'Team talent composite.',
              inputSchema:{ type:'object', properties:{ team:{type:'string'}, year:{type:'number'} }, required:['team'] }
            },
            {
              name:'get_betting',
              description:'Betting lines.',
              inputSchema:{ type:'object', properties:{ team:{type:'string'}, week:{type:'number'} }, required:['team'] }
            },
            {
              name:'get_ratings',
              description:'SP+ ratings.',
              inputSchema:{ type:'object', properties:{ team:{type:'string'}, year:{type:'number'} }, required:['team'] }
            },
            {
              name:'get_records',
              description:'Team records.',
              inputSchema:{ type:'object', properties:{ team:{type:'string'}, year:{type:'number'} }, required:['team'] }
            },

            // NCAA
            {
              name:'get_ncaa_scoreboard',
              description:'NCAA scoreboard all divisions.',
              inputSchema:{ type:'object', properties:{ sport:{type:'string'}, division:{type:'string'}, date:{type:'string'} }, required:['sport'] }
            },
            {
              name:'get_ncaa_rankings',
              description:'NCAA rankings.',
              inputSchema:{ type:'object', properties:{ sport:{type:'string'}, division:{type:'string'}, poll:{type:'string'} }, required:['sport'] }
            }
          ]
        }
      });
    }

    /* -------------------------------------
       TOOL EXECUTION
    -------------------------------------*/
    if (method === "tools/call") {
      const { name, arguments: args } = params;
      console.log(`Tool call = ${name}`);

      let result;

      switch (name) {

        /* -----------------------------
           ESPN
        ------------------------------*/
        case 'get_score':        result = await handleGetScore(args); break;
        case 'get_schedule':     result = await handleGetSchedule(args); break;
        case 'get_scoreboard':   result = await handleGetScoreboard(args); break;
        case 'get_rankings':     result = await handleGetRankings(args); break;

        /* -----------------------------
           CFBD — ADVANCED + TRADITIONAL
        ------------------------------*/
        case 'get_stats':        result = await handleGetStats(args); break;
        case 'get_recruiting':   result = await handleGetRecruiting(args); break;
        case 'get_talent':       result = await handleGetTalent(args); break;
        case 'get_betting':      result = await handleGetBetting(args); break;
        case 'get_ratings':      result = await handleGetRatings(args); break;
        case 'get_records':      result = await handleGetRecords(args); break;

        /* -----------------------------
           NCAA
        ------------------------------*/
        case 'get_ncaa_scoreboard': result = await handleGetNCAAScoreboard(args); break;
        case 'get_ncaa_rankings':   result = await handleGetNCAAankings(args); break;

        default:
          return res.json({
            jsonrpc:"2.0",
            error:{ code:-32601, message:`Unknown tool ${name}` },
            id
          });
      }

      return res.json({
        jsonrpc:"2.0",
        id,
        result:{
          content:[
            { type:'text', text: typeof result === 'string' ? result : JSON.stringify(result,null,2) }
          ]
        }
      });
    }

    // Notification handler
    if (method === "notifications/initialized") {
      return res.status(204).send();
    }

    // Unknown
    return res.json({
      jsonrpc:"2.0",
      error:{ code:-32601, message:`Unknown method ${method}` },
      id
    });

  } catch (error) {
    console.error("MCP error:", error);
    return res.json({
      jsonrpc:"2.0",
      error:{ code:-32603, message:"Internal Error", data:error.message },
      id:req.body?.id || null
    });
  }
});

/* -------------------------------------
   TOOL HANDLERS — ESPN
--------------------------------------*/

async function handleGetScore(args) {
  const { team, sport='football' } = args;
  return await getCurrentGame(team, sport);
}

async function handleGetSchedule(args) {
  const { team, sport='football', limit=5 } = args;
  return await getTeamSchedule(team, sport, limit);
}

async function handleGetScoreboard(args) {
  const { sport='football', date } = args;
  return await getScoreboard(sport, date);
}

async function handleGetRankings(args) {
  const { sport='football', poll='ap' } = args;
  return await getRankings(sport, poll);
}

/* -------------------------------------
   TOOL HANDLERS — CFBD TRADITIONAL + ADVANCED
--------------------------------------*/

async function handleGetStats(args) {
  const { team, year, stat_type='traditional' } = args;

  console.log(`CFBD get_stats: ${team} ${year} type=${stat_type}`);

  if (stat_type === "traditional") {
    return await getTraditionalStats(team, year);
  }

  if (stat_type === "advanced") {
    return await getAdvancedStats(team, year, 'both');
  }

  if (stat_type === "both") {
    const traditional = await getTraditionalStats(team, year);
    const advanced = await getAdvancedStats(team, year, 'both');
    return { team, year, traditional, advanced };
  }

  return { error: `Invalid stat_type: ${stat_type}` };
}

async function handleGetRecruiting(args) {
  const { team, year } = args;
  return await getRecruiting(team, year);
}

async function handleGetTalent(args) {
  const { team, year } = args;
  return await getTeamTalent(team, year);
}

async function handleGetBetting(args) {
  const { team, week } = args;
  return await getBettingLines(team, week);
}

async function handleGetRatings(args) {
  const { team, year } = args;
  return await getSPRatings(team, year);
}

async function handleGetRecords(args) {
  const { team, year } = args;
  return await getTeamRecords(team, year);
}

/* -------------------------------------
   NCAA TOOL HANDLERS
--------------------------------------*/

async function handleGetNCAAScoreboard(args) {
  const { sport, division='fbs', date } = args;
  return await getNCAAScoreboard(sport, division, date);
}

async function handleGetNCAAankings(args) {
  const { sport, division='fbs', poll='ap' } = args;
  return await getNCAAankings(sport, division, poll);
}

/* -------------------------------------
   CLEAR CACHE
--------------------------------------*/
app.post('/clear-cache', (req, res) => {
  clearESPNCache();
  clearCFBDCache();
  clearNCAACache();
  res.json({ message:"Caches cleared" });
});

/* -------------------------------------
   404 + ERROR HANDLERS
--------------------------------------*/
app.use((req,res)=>res.status(404).json({error:'Not Found'}));
app.use((err,req,res,next)=>res.status(500).json({error:'Server error', detail:err.message}));

/* -------------------------------------
   START SERVER
--------------------------------------*/
app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log(`BoomerBot MCP running on port ${PORT}`);
  console.log('='.repeat(60));
});
