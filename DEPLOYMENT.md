# Deployment Guide

Complete guide for deploying ESPN MCP Server to Railway.

## Prerequisites

- GitHub account
- Railway account (free tier available)
- Code pushed to GitHub repository

## Deployment Steps

### Step 1: Prepare Repository

Ensure your repo has these files:
- ✅ `package.json`
- ✅ `Dockerfile`
- ✅ `.gitignore`
- ✅ All JavaScript files
```bash
# Verify all files are committed
git status

# If you have changes, commit them
git add .
git commit -m "Ready for deployment"
git push origin main
```

### Step 2: Deploy to Railway

1. **Go to Railway**: https://railway.app

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Authorize GitHub if needed

3. **Select Repository**
   - Choose `espn-mcp-server`
   - Railway detects Dockerfile automatically

4. **Wait for Deployment** (2-3 minutes)
   - Railway builds Docker image
   - Starts the server
   - Assigns public URL

5. **Get Your URL**
   - Click your project
   - Go to "Settings" → "Networking"
   - Click "Generate Domain"
   - Copy URL: `your-app-name.up.railway.app`

### Step 3: Configure Environment (Optional)

If using CollegeFootballData.com API:

1. **Get API Key**
   - Go to https://collegefootballdata.com
   - Sign up (free)
   - Generate API key

2. **Add to Railway**
   - Railway dashboard → Your project
   - Click "Variables" tab
   - Click "New Variable"
   - Name: `CFBD_API_KEY`
   - Value: [paste your key]
   - Click "Add"

3. **Redeploy**
   - Railway automatically redeploys
   - Wait 1-2 minutes

### Step 4: Test Deployment

Test your endpoints:
```bash
# Health check
curl https://your-app-name.up.railway.app/health

# Get Oklahoma score
curl https://your-app-name.up.railway.app/score?team=oklahoma

# Get schedule
curl https://your-app-name.up.railway.app/schedule?team=oklahoma&limit=3

# Test CFBD (if key configured)
curl https://your-app-name.up.railway.app/cfbd/recruiting?team=oklahoma
```

Expected responses:
- Health check: `{"status":"healthy",...}`
- Score: Game data or "No recent games"
- Schedule: Array of upcoming games

### Step 5: Monitor Deployment

**View Logs:**
- Railway dashboard → Your project
- Click "Deployments" tab
- Click latest deployment
- View real-time logs

**Check Metrics:**
- Railway dashboard → Your project
- Click "Metrics" tab
- View CPU, Memory, Network usage

## Updating Your Deployment

When you make code changes:
```bash
# Make your changes
# Test locally first

# Commit and push
git add .
git commit -m "Description of changes"
git push origin main
```

Railway automatically:
1. Detects the push
2. Rebuilds Docker image
3. Deploys new version
4. Zero downtime deployment

## Custom Domain (Optional)

Add your own domain:

1. **Railway Settings**
   - Settings → Networking
   - Click "Custom Domain"
   - Enter your domain: `api.yourdomain.com`

2. **DNS Configuration**
   - Add CNAME record in your DNS provider
   - Point to Railway domain
   - Wait for DNS propagation (5-30 minutes)

## Troubleshooting

### "Build Failed"
- Check Railway logs for errors
- Verify `Dockerfile` is correct
- Ensure `package.json` has all dependencies

### "Server Not Responding"
- Check if deployment is running (Railway dashboard)
- View logs for startup errors
- Verify PORT environment variable (Railway sets automatically)

### "API Errors"
- ESPN API is rate-limited, usually brief
- CFBD requires API key for some endpoints
- NCAA API occasionally has downtime

### "High Memory Usage"
- Normal for caching data
- Railway free tier: 512MB RAM
- Upgrade to hobby tier if needed ($5/month)

## Cost Estimate

**Railway Free Tier:**
- $5 free credit per month
- ~500 hours of runtime
- 512MB RAM, 1GB storage
- **Cost: FREE** for this app

**Railway Hobby Tier** ($5/month):
- Unlimited hours
- 512MB RAM
- 1GB storage
- **Recommended for production**

## Scaling

This server can handle:
- 1,000+ requests/minute
- Multiple school bots
- All on single Railway instance

No scaling needed until:
- 50+ school bots
- 10,000+ requests/minute
- Then upgrade to Pro tier

## Security

**Built-in Security:**
- ✅ CORS enabled (safe cross-origin)
- ✅ No authentication needed (public APIs)
- ✅ Rate limiting via caching
- ✅ Input validation on all endpoints

**API Keys:**
- Only CFBD key needed
- Stored as environment variable
- Never committed to GitHub

## Support

**Issues?**
- Check Railway documentation: https://docs.railway.app
- Check ESPN API status
- Review server logs

**Questions?**
- Open GitHub issue
- Contact: kevin@thebotosphere.com

## Next Steps

After deployment:
1. ✅ Test all endpoints
2. ✅ Configure PaymeGPT bot to use your API
3. ✅ Monitor usage for 24 hours
4. ✅ Set up alerts (Railway settings)
5. ✅ Launch Boomer Bot!

---

**Deployment complete!** 🚀

Your ESPN MCP Server is now live and ready to power your bots.
