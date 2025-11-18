# CollegeFootballData.com API Setup

How to get and configure your free CFBD API key for advanced analytics.

## What is CFBD?

CollegeFootballData.com provides advanced college football data:
- Recruiting rankings and class ratings
- Team talent composites
- Advanced statistics (EPA, Success Rate, etc.)
- Betting lines and spreads
- SP+ ratings
- Historical team records

**Cost:** FREE for personal/educational use

## Why Use CFBD?

ESPN doesn't provide:
- ❌ Recruiting rankings
- ❌ Advanced analytics (EPA, Success Rate)
- ❌ Betting lines
- ❌ Team talent ratings
- ❌ Historical statistical trends

CFBD provides ALL of these **for free**.

## Getting Your API Key

### Step 1: Create Account

1. Go to: https://collegefootballdata.com

2. Click "Log In" or "Sign Up"

3. Create account with:
   - Email address
   - Password
   - Agree to terms

4. Verify your email (check inbox)

### Step 2: Generate API Key

1. Log in to CFBD

2. Click your profile (top right)

3. Click "API Keys" or "Account Settings"

4. Click "Generate New Key"

5. **Copy your API key** (it looks like this):
```
   abcd1234efgh5678ijkl9012mnop3456qrst7890uvwx1234yz567890
```

6. **Save it somewhere safe!** You won't see it again.

### Step 3: Add to Railway

1. Go to Railway dashboard: https://railway.app

2. Click your `espn-mcp-server` project

3. Click "Variables" tab

4. Click "New Variable"

5. Enter:
   - **Variable name:** `CFBD_API_KEY`
   - **Value:** [paste your API key]

6. Click "Add"

7. Railway automatically redeploys (wait 1-2 minutes)

### Step 4: Test It Works
```bash
# Test recruiting endpoint
curl https://your-app.up.railway.app/cfbd/recruiting?team=oklahoma

# Expected: Recruiting class data
# If error "API key required" → Key not set correctly
```

## Local Development Setup

If testing locally:
```bash
# Create .env file in project root
echo "CFBD_API_KEY=your_key_here" > .env

# The server reads it automatically
npm start

# Test locally
curl http://localhost:8080/cfbd/recruiting?team=oklahoma
```

## API Key Limits

**Free Tier:**
- ✅ Unlimited requests per day
- ✅ No credit card required
- ✅ All endpoints available
- ⚠️ Rate limited to ~100 requests/minute

**Our Caching:**
- CFBD data cached 6 hours
- Stays well under rate limits
- Even with 1000+ users

## What Works Without API Key?

**ESPN endpoints work without CFBD:**
- ✅ `/score` - Live scores
- ✅ `/schedule` - Team schedules
- ✅ `/scoreboard` - Today's games
- ✅ `/rankings` - AP Top 25

**CFBD endpoints require key:**
- ❌ `/cfbd/recruiting` - Requires key
- ❌ `/cfbd/talent` - Requires key
- ❌ `/cfbd/stats` - Requires key
- ❌ `/cfbd/betting` - Requires key

**NCAA endpoints work without CFBD:**
- ✅ `/ncaa/scoreboard` - NCAA games
- ✅ `/ncaa/rankings` - NCAA rankings

## Troubleshooting

### "CFBD API key required" Error

**Problem:** API key not configured

**Solution:**
```bash
# Check Railway environment variables
Railway → Your project → Variables → Check CFBD_API_KEY exists

# If missing, add it:
Variable name: CFBD_API_KEY
Value: [your key]
```

### "401 Unauthorized" Error

**Problem:** API key invalid or expired

**Solution:**
1. Go to CFBD website
2. Generate new API key
3. Update Railway variable
4. Redeploy

### "Rate limit exceeded" Error

**Problem:** Too many requests (rare with our caching)

**Solution:**
- Wait 1 minute (limit resets)
- Our 6-hour cache prevents this
- Contact CFBD support if persistent

### Data Returns Empty

**Problem:** Team name not recognized

**Solution:**
```bash
# Use full team name
✅ team=oklahoma
✅ team=texas
✅ team=alabama

# Not abbreviations
❌ team=ou
❌ team=ut
❌ team=bama
```

## Available CFBD Data

### Recruiting Rankings
```bash
GET /cfbd/recruiting?team=oklahoma&year=2025

Returns:
- National rank
- Total points
- Number of commits
- Average star rating
```

### Team Talent
```bash
GET /cfbd/talent?team=oklahoma&year=2024

Returns:
- Talent composite score
- National talent ranking
```

### Advanced Stats
```bash
GET /cfbd/stats?team=oklahoma&year=2024

Returns:
- EPA per play (offense & defense)
- Success rate
- Explosiveness
- Havoc rate
- Line yards
```

### Betting Lines
```bash
GET /cfbd/betting?team=oklahoma&year=2024&week=10

Returns:
- Point spread
- Over/under
- Moneyline
- Multiple sportsbooks
```

### SP+ Ratings
```bash
GET /cfbd/ratings?team=oklahoma&year=2024

Returns:
- Overall SP+ rating
- Offensive rating
- Defensive rating
- Strength of schedule
```

## Data Freshness

**CFBD updates:**
- Recruiting: Daily during signing period
- Stats: Weekly (after all games)
- Ratings: Weekly (usually Tuesday)
- Betting: Multiple times per day

**Our cache:** 6 hours
- Balances freshness with API limits
- Sufficient for weekly-updating data

## Cost Analysis

**CFBD API:**
- Cost: $0/month (free tier)
- Rate limit: ~100 req/min
- Data: Complete CFB database

**With our caching:**
- Actual API calls: ~10-20/day per school
- Well under free tier limit
- Zero cost to operate

**At scale (50 schools):**
- API calls: ~500-1000/day total
- Still FREE (under limits)
- No additional cost

## Support

**CFBD Issues:**
- Documentation: https://api.collegefootballdata.com/api/docs
- Email: admin@collegefootballdata.com
- Twitter: @CFB_Data

**Server Issues:**
- Check Railway logs
- Verify API key in environment
- Test endpoints individually

## Optional: Advanced Usage

### Multiple API Keys (Future)

If you scale to 100+ schools:
- Get multiple free API keys
- Rotate keys to distribute load
- Add key rotation logic

### Data Export

Save CFBD data locally:
```bash
# Export recruiting data
curl https://your-app.up.railway.app/cfbd/recruiting?team=oklahoma > recruiting.json

# Process with other tools
# Build historical database
```

## Summary

✅ **Get free CFBD API key** → 5 minutes  
✅ **Add to Railway environment** → 2 minutes  
✅ **Test endpoints** → 2 minutes  
✅ **Total setup time:** <10 minutes  

**Result:** Advanced analytics for all school bots! 🚀
