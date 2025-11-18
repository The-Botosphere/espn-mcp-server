/**
 * ESPN MCP SERVER
 * Multi-source sports data API combining ESPN, CFBD, and NCAA
 * JSON-RPC 2.0 compliant MCP endpoint
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
    version: '2.0.1',
    description: 'Multi-source college sports data API with JSON-RPC 2.0 MCP endpoint',
    sources: ['ESPN', 'CollegeFootballData.com', 'NCAA.com'],
    endpoints: {
      mcp: {
        '/mcp': 'JSON-RPC 2.0 MCP endpoint (POST, requires Bearer token)'
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
 * MCP ENDPOINT - JSON-RPC 2.0 compliant
 * Requires Bearer token authentication
 */
app.post('/mcp', async (req, res) => {
  try {
    // Check authentication
    const authHeader = req.headers.authorization;
    const apiKey = process.env.MCP_API_KEY || 'default-key-change-me';
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.json({
        jsonrpc: '2.0',
        error: {
          code: -32001,
          message: 'Missing or invalid authorization header'
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
    
    // Handle notifications (ignore them)
    if (method && method.startsWith('notifications/')) {
      console.log('🔕 Ignoring notification:', method);
      return res.status(200).end();
    }
    
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
    
    console.log(`JSON-RPC request: ${method}`, params);
    
    // Handle initialize (REQUIRED MCP handshake)
    if (method === 'initialize') {
      return res.json({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          serverInfo: {
            name: 'espn-mcp-server',
            version: '2.0.1',
            description: 'Multi-source college sports data API'
          },
          capabilities: {
            tools: {}
          }
        }
      });
    }
    
    // Handle tools/list (discovery)
    if (method === 'tools/list' || method === 'listTools') {
      return res.json({
        jsonrpc: '2.0',
        result: {
          tools: [
            {
              name: 'get_score',
              description: 'Get current or recent game score for a team',
              inputSchema: {
                type: 'object',
                properties: {
                  team: { type: 'string', description: 'Team name', default: 'oklahoma' },
                  sport: { type: 'string', description: 'Sport', default: 'football' }
                }
              }
            },
            {
              name: 'get_schedule',
              description: 'Get team schedule

