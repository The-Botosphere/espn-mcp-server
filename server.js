/**
 * ESPN MCP SERVER
 * Multi-source sports data API combining ESPN, CFBD, and NCAA
 * JSON-RPC 2.0 compliant MCP endpoint
 * Created by Kevin - The Botosphere
 */

import express from "express";
import cors from "cors";

import {
  getCurrentGame,
  getTeamSchedule,
  getScoreboard,
  getRankings,
  clearCache as clearESPNCache
} from "./espn-api.js";

import {
  getRecruiting,
  getTeamTalent,
  getAdvancedStats,
  getBettingLines,
  getSPRatings,
  getTeamRecords,
  clearCFBDCache
} from "./cfbd-api.js";

import {
  getNCAAScoreboad,
  getNCAAankings,
  clearNCAACache
} from "./ncaa-api.js";

import {
  formatGameResponse,
  formatScheduleResponse,
  formatScoreboardResponse,
  formatRankingsResponse
} from "./formatter.js";

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
 * ROOT ENDPOINT
 */
app.get("/", (req, res) => {
  res.json({
    name: "ESPN MCP Server",
    version: "2.0.2",
    description: "Multi-source college sports data API with video support",
    sources: ["ESPN", "CFBD", "NCAA"],
    status: "operational",
    timestamp: new Date().toISOString()
  });
});

/**
 * HEALTH CHECK
 */
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

/**
 * MCP ENDPOINT — JSON-RPC 2.0
 */
app.post("/mcp", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const apiKey = process.env.MCP_API_KEY || "default-key-change-me";

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.json({
        jsonrpc: "2.0",
        error: { code: -32001, message: "Missing authorization" },
        id: req.body?.id || null
      });
    }

    const token = authHeader.substring(7);
    if (token !== apiKey) {
      return res.json({
        jsonrpc: "2.0",
        error: { code: -32002, message: "Invalid API key" },
        id: req.body?.id || null
      });
    }

    const { jsonrpc, method, params = {}, id } = req.body;

    if (method && method.startsWith("notifications/")) {
      console.log("Ignoring notification:", method);
      return res.status(200).end();
    }

    if (jsonrpc !== "2.0") {
      return res.json({
        jsonrpc: "2.0",
        error: { code: -32600, message: "Invalid Request" },
        id: id || null
      });
    }

    if (!method) {
      return res.json({
        jsonrpc: "2.0",
        error: { code: -32600, message: "Method required" },
        id: id || null
      });
    }

    console.log(`JSON-RPC: ${method}`, params);
    /**
     * INITIALIZE
     */
    if (method === "initialize") {
      return res.json({
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          serverInfo: {
            name: "espn-mcp-server",
            version: "2.0.2",
            description: "College sports data API with video support"
          },
          capabilities: { tools: {} }
        }
      });
    }

    /**
     * TOOLS/LIST (with video tool added)
     */
    if (method === "tools/list" || method === "listTools") {
      return res.json({
        jsonrpc: "2.0",
        result: {
          tools: [
            {
              name: "get_score",
              description: "Get current or recent game score",
              inputSchema: {
                type: "object",
                properties: {
                  team: { type: "string", default: "oklahoma" },
                  sport: { type: "string", default: "football" }
                }
              }
            },
            {
              name: "get_schedule",
              description: "Get team schedule",
              inputSchema: {
                type: "object",
                properties: {
                  team: { type: "string", default: "oklahoma" },
                  sport: { type: "string", default: "football" },
                  limit: { type: "number", default: 5 }
                }
              }
            },
            {
              name: "get_scoreboard",
              description: "Get today's games",
              inputSchema: {
                type: "object",
                properties: {
                  sport: { type: "string", default: "football" }
                }
              }
            },
            {
              name: "get_rankings",
              description: "Get AP Top 25 rankings",
              inputSchema: {
                type: "object",
                properties: {
                  sport: { type: "string", default: "football" }
                }
              }
            },
            {
              name: "get_recruiting",
              description: "Get recruiting rankings",
              inputSchema: {
                type: "object",
                properties: {
                  team: { type: "string", default: "oklahoma" },
                  year: { type: "number" }
                }
              }
            },
            {
              name: "get_talent",
              description: "Get team talent rating",
              inputSchema: {
                type: "object",
                properties: {
                  team: { type: "string", default: "oklahoma" },
                  year: { type: "number" }
                }
              }
            },
            {
              name: "get_stats",
              description: "Get advanced team statistics",
              inputSchema: {
                type: "object",
                properties: {
                  team: { type: "string", default: "oklahoma" },
                  year: { type: "number" }
                }
              }
            },
            {
              name: "get_betting",
              description: "Get betting lines",
              inputSchema: {
                type: "object",
                properties: {
                  team: { type: "string", default: "oklahoma" },
                  year: { type: "number" },
                  week: { type: "number" }
                }
              }
            },
            {
              name: "get_ratings",
              description: "Get SP+ ratings",
              inputSchema: {
                type: "object",
                properties: {
                  team: { type: "string", default: "oklahoma" },
                  year: { type: "number" }
                }
              }
            },
            {
              name: "get_records",
              description: "Get team records",
              inputSchema: {
                type: "object",
                properties: {
                  team: { type: "string", default: "oklahoma" },
                  year: { type: "number" }
                }
              }
            },

            /**
             * ⭐ NEW VIDEO TOOL ⭐
             */
            {
              name: "get_video",
              description: "Return an embeddable video player for a YouTube video.",
              inputSchema: {
                type: "object",
                properties: {
                  videoId: { type: "string" },
                  title: { type: "string" },
                  description: { type: "string" }
                },
                required: ["videoId"]
              }
            }
          ]
        },
        id
      });
    }

    /**
     * TOOLS/CALL (with video handler)
     */
    if (method === "tools/call" || method === "callTool") {
      const toolName = params.name;
      const toolParams = params.arguments || {};

      let result;

      // ⭐ VIDEO TOOL RETURN BLOCK ⭐
      if (toolName === "get_video") {
        const vid = toolParams.videoId;
        const titleTxt = toolParams.title || "Video";
        const descTxt = toolParams.description || "";

        return res.json({
          jsonrpc: "2.0",
          result: {
            content: [
              {
                type: "video",
                video: {
                  url: `https://www.youtube.com/embed/${vid}`,
                  title: titleTxt,
                  description: descTxt
                }
              }
            ]
          },
          id
        });
      }

      /**
       * All Existing Tools
       */
      switch (toolName) {
        case "get_score": {
          const team = toolParams.team || "oklahoma";
          const sport = toolParams.sport || "football";
          const game = await getCurrentGame(team, sport);
          result = game
            ? formatGameResponse(game)
            : `No recent games found for ${team}`;
          break;
        }

        case "get_schedule": {
          const schedTeam = toolParams.team || "oklahoma";
          const schedSport = toolParams.sport || "football";
          const limit = toolParams.limit || 5;
          const schedule = await getTeamSchedule(schedTeam, schedSport);
          result = formatScheduleResponse(schedule, limit);
          break;
        }

        case "get_scoreboard": {
          const sbSport = toolParams.sport || "football";
          const scoreboard = await getScoreboard(sbSport);
          result = formatScoreboardResponse(scoreboard);
          break;
        }

        case "get_rankings": {
          const rankSport = toolParams.sport || "football";
          const rankings = await getRankings(rankSport);
          result = rankings
            ? formatRankingsResponse(rankings, 25)
            : "No rankings available";
          break;
        }

        case "get_recruiting": {
          const recTeam = toolParams.team || "oklahoma";
          const recYear = toolParams.year;
          const data = await getRecruiting(recTeam, recYear);
          if (data) {
            result =
              `🎓 ${data.team} ${data.year} Recruiting Class:\n` +
              `• National Rank: #${data.rank}\n` +
              `• Total Points: ${data.points}\n` +
              `• Commits: ${data.commits}\n` +
              `• Avg Stars: ${data.avgStars}⭐`;
          } else {
            result = `No recruiting data found for ${recTeam}`;
          }
          break;
        }

        case "get_talent": {
          const talentTeam = toolParams.team || "oklahoma";
          const talentYear = toolParams.year;
          const data = await getTeamTalent(talentTeam, talentYear);
          if (data) {
            result =
              `💪 ${data.team} ${data.year} Talent Composite:\n` +
              `• Talent Rating: ${data.talent}\n` +
              `• National Rank: #${data.rank}`;
          } else {
            result = `No talent data found for ${talentTeam}`;
          }
          break;
        }

      case "get_stats": {
  const statsTeam = toolParams.team || "oklahoma";
  const statsYear = toolParams.year;
  const stats = await getAdvancedStats(statsTeam, statsYear);

  if (stats) {
    result =
      `📊 ${stats.team} ${stats.year} Advanced Stats:\n\n` +
      `Offense:\n` +
      `• EPA per Play: ${stats.offense.ppa?.toFixed(3) || "N/A"}\n` +
      `• Success Rate: ${stats.offense.successRate?.toFixed(1) || "N/A"}%\n` +
      `• Explosiveness: ${stats.offense.explosiveness?.toFixed(3) || "N/A"}\n\n` +
      `Defense:\n` +
      `• EPA per Play: ${stats.defense.ppa?.toFixed(3) || "N/A"}\n` +
      `• Success Rate: ${stats.defense.successRate?.toFixed(1) || "N/A"}%\n` +
      `• Havoc Rate: ${stats.defense.havoc?.total?.toFixed(1) || "N/A"}%`;
  } else {
    result = `No stats found for ${statsTeam}`;
  }

  break;
}

case "get_betting": {
  const betTeam = toolParams.team || "oklahoma";
  const betYear = toolParams.year;
  const betWeek = toolParams.week;
  const lines = await getBettingLines(betTeam, betYear, betWeek);

  if (lines && lines.length > 0) {
    const latest = lines[0];
    const line =
      latest.lines && latest.lines.length > 0
        ? latest.lines[0]
        : null;

    if (line) {
      result =
        `💰 ${latest.awayTeam} at ${latest.homeTeam} Betting Lines:\n` +
        `• Spread: ${line.formattedSpread || "N/A"}\n` +
        `• Over/Under: ${line.overUnder || "N/A"}\n` +
        `• ${latest.homeTeam} ML: ${line.homeMoneyline || "N/A"}\n` +
        `• ${latest.awayTeam} ML: ${line.awayMoneyline || "N/A"}`;
    } else {
      result = "Betting lines found but no odds available";
    }
  } else {
    result = `No betting lines found for ${betTeam}`;
  }

  break;
}


        case "get_ratings": {
          const ratTeam = toolParams.team || "oklahoma";
          const ratYear = toolParams.year;
          const ratings = await getSPRatings(ratTeam, ratYear);

          if (ratings) {
            result =
              `⚡ ${ratings.team} ${ratings.year} SP+ Ratings:\n` +
              `• Overall: ${ratings.rating?.toFixed(1)} (#${ratings.ranking})\n` +
              `• Offense: ${ratings.offense?.rating?.toFixed(1)} (#${ratings.offense?.ranking})\n` +
              `• Defense: ${ratings.defense?.rating?.toFixed(1)} (#${ratings.defense?.ranking})`;
          } else {
            result = `No SP+ ratings found for ${ratTeam}`;
          }
          break;
        }

        case "get_records": {
          const recTeamName = toolParams.team || "oklahoma";
          const recYearVal = toolParams.year;
          const records = await getTeamRecords(recTeamName, recYearVal);

          if (records) {
            result =
              `📋 ${records.team} ${records.year} Records:\n` +
              `• Overall: ${records.total?.wins}-${records.total?.losses}\n` +
              `• Conference: ${records.conferenceGames?.wins}-${records.conferenceGames?.losses}\n` +
              `• Home: ${records.homeGames?.wins}-${records.homeGames?.losses}\n` +
              `• Away: ${records.awayGames?.wins}-${records.awayGames?.losses}`;
          } else {
            result = `No records found for ${recTeamName}`;
          }
          break;
        }

        default:
          return res.json({
            jsonrpc: "2.0",
            error: {
              code: -32601,
              message: `Unknown tool: ${toolName}`
            },
            id
          });
      }

      /**
       * SMART RESPONSE HANDLER
       * Allows either:
       * - Plain text
       * - Video player
       * - Raw structured content
       */
      if (typeof result === "string") {
        return res.json({
          jsonrpc: "2.0",
          result: { content: [{ type: "text", text: result }] },
          id
        });
      }

      return res.json({
        jsonrpc: "2.0",
        result,
        id
      });
    }

    return res.json({
      jsonrpc: "2.0",
      error: { code: -32601, message: `Method not found: ${method}` },
      id: id || null
    });
  } catch (error) {
    console.error("MCP error:", error);
    return res.json({
      jsonrpc: "2.0",
      error: { code: -32603, message: `Internal error: ${error.message}` },
      id: req.body?.id || null
    });
  }
});

/**
 * ESPN ENDPOINTS
 */
app.get("/score", async (req, res) => {
  try {
    const { team, sport = "football", format = "json" } = req.query;
    if (!team) return res.status(400).json({ error: "Team required" });
    const game = await getCurrentGame(team, sport);
    if (!game) return res.json({ message: `No games found for ${team}` });
    if (format === "text") return res.send(formatGameResponse(game));
    res.json(game);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/schedule", async (req, res) => {
  try {
    const { team, sport = "football", limit = 10, format = "json" } = req.query;
    if (!team) return res.status(400).json({ error: "Team required" });
    const schedule = await getTeamSchedule(team, sport);
    if (format === "text")
      return res.send(formatScheduleResponse(schedule, parseInt(limit)));
    if (schedule.events)
      schedule.events = schedule.events.slice(0, parseInt(limit));
    res.json(schedule);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/scoreboard", async (req, res) => {
  try {
    const { sport = "football", date, format = "json" } = req.query;
    const scoreboard = await getScoreboard(sport, date);
    if (format === "text")
      return res.send(formatScoreboardResponse(scoreboard));
    res.json(scoreboard);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/rankings", async (req, res) => {
  try {
    const { sport = "football", top = 25, format = "json" } = req.query;
  const rankings = await getRankings(sport);
    if (!rankings) return res.json({ message: "No rankings available" });
    if (format === "text")
      return res.send(formatRankingsResponse(rankings, parseInt(top)));
    res.json(rankings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * CFBD ENDPOINTS
 */
app.get("/cfbd/recruiting", async (req, res) => {
  try {
    const { team, year, format = "json" } = req.query;
    if (!team) return res.status(400).json({ error: "Team required" });
    const data = await getRecruiting(team, year ? parseInt(year) : undefined);
    if (!data) return res.json({ message: `No data for ${team}` });

    if (format === "text") {
      return res.send(
        `🎓 ${data.team} ${data.year} Recruiting:\n` +
          `• Rank: #${data.rank}\n` +
          `• Points: ${data.points}\n` +
          `• Commits: ${data.commits}\n` +
          `• Avg Stars: ${data.avgStars}⭐`
      );
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/cfbd/talent", async (req, res) => {
  try {
    const { team, year, format = "json" } = req.query;
    if (!team) return res.status(400).json({ error: "Team required" });
    const data = await getTeamTalent(team, year ? parseInt(year) : undefined);
    if (!data) return res.json({ message: `No data for ${team}` });
    if (format === "text") {
      return res.send(
        `💪 ${data.team} ${data.year} Talent:\n• Rating: ${data.talent}\n• Rank: #${data.rank}`
      );
    }
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/cfbd/stats", async (req, res) => {
  try {
    const { team, year } = req.query;
    if (!team) return res.status(400).json({ error: "Team required" });
    const data = await getAdvancedStats(
      team,
      year ? parseInt(year) : undefined
    );
    if (!data) return res.json({ message: `No data for ${team}` });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/cfbd/betting", async (req, res) => {
  try {
    const { team, year, week } = req.query;
    if (!team) return res.status(400).json({ error: "Team required" });
    const data = await getBettingLines(
      team,
      year ? parseInt(year) : undefined,
      week ? parseInt(week) : undefined
    );
    if (!data || data.length === 0)
      return res.json({ message: `No data for ${team}` });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/cfbd/ratings", async (req, res) => {
  try {
    const { team, year } = req.query;
    if (!team) return res.status(400).json({ error: "Team required" });
    const data = await getSPRatings(
      team,
      year ? parseInt(year) : undefined
    );
    if (!data) return res.json({ message: `No data for ${team}` });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/cfbd/records", async (req, res) => {
  try {
    const { team, year } = req.query;
    if (!team) return res.status(400).json({ error: "Team required" });
    const data = await getTeamRecords(
      team,
      year ? parseInt(year) : undefined
    );
    if (!data) return res.json({ message: `No data for ${team}` });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * NCAA ENDPOINTS
 */
app.get("/ncaa/scoreboard", async (req, res) => {
  try {
    const { sport = "football", division = "fbs", date } = req.query;
    const data = await getNCAAScoreboad(sport, division, date);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/ncaa/rankings", async (req, res) => {
  try {
    const {
      sport = "football",
      division = "fbs",
      poll = "associated-press"
    } = req.query;

    const data = await getNCAAankings(sport, division, poll);
    if (!data) return res.json({ message: "No rankings available" });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * UTILITY
 */
app.post("/clear-cache", (req, res) => {
  clearESPNCache();
  clearCFBDCache();
  clearNCAACache();
  res.json({
    message: "All caches cleared",
    timestamp: new Date().toISOString()
  });
});

app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

app.use((error, req, res, next) => {
  console.error("Server error:", error);
  res.status(500).json({ error: "Internal server error" });
});

/**
 * START SERVER
 */
app.listen(PORT, () => {
  console.log("=".repeat(60));
  console.log("ESPN MCP SERVER (VIDEO SUPPORTED)");
  console.log("=".repeat(60));
  console.log(`Port: ${PORT}`);
  console.log(`MCP endpoint: /mcp (POST, JSON-RPC 2.0)`);
  console.log("Sources: ESPN, CFBD, NCAA");
  console.log("=".repeat(60));
  console.log(`Started: ${new Date().toISOString()}`);
  console.log("=".repeat(60));
});

          const statsYear = toolParams.year;
          const stats = await getAdvancedStats(statsTeam, statsYear);
          if (stats) {
            result =
              `📊 ${stats.team} ${stats.year} Advanced Stats:\n\n` +
              `Offense:\n` +
              `• EPA per Play: ${stats.offense.ppa?.toFixed(3) || "N/A"}\n` +
              `• Success Rate: ${stats.offense.successRate?.toFixed(1) || "N/A"}%\n` +
              `• Explosiveness: ${stats.offense.explosiveness?.toFixed(3) || "N/A"}\n\n` +
              `Defense:\n` +
              `• EPA per Play: ${stats.defense.ppa?.toFixed(3) || "N/A"}\n` +
              `• Success Rate: ${stats.defense.successRate?.toFixed(1) || "N/A"}%\n` +
              `• Havoc Rate: ${stats.defense.havoc?.total?.toFixed(1) || "N/A"}%`;
          } else {
            result = `No stats found for ${statsTeam}`;
          }
          break;
        }
