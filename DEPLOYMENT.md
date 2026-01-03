# Final Deployment Steps

## ✅ Oracle Backend Deployed
Your oracle backend is live at: `https://vrf-oracle-backend.onrender.com`

## Next: Connect Vercel to Oracle Backend

### 1. Add Environment Variable to Vercel
1. Go to your Vercel project: https://vercel.com/dashboard
2. Click on your project (monkeyhand)
3. Go to **Settings** → **Environment Variables**
4. Add new variable:
   - **Name**: `ORACLE_BACKEND_URL`
   - **Value**: `https://vrf-oracle-backend.onrender.com`
   - **Environment**: Production, Preview, Development (select all)
5. Click **Save**

### 2. Redeploy Vercel
1. Go to **Deployments** tab
2. Click the **"..."** menu on the latest deployment
3. Click **"Redeploy"**
4. Wait for deployment to complete

### 3. Test the Integration
1. Visit your Vercel app: `https://monkeyhand.vercel.app`
2. Create a game
3. Start playing - the VRF should now work!

## Testing Oracle Backend Directly

You can test the oracle backend endpoints:

**Health Check**:
```bash
curl https://vrf-oracle-backend.onrender.com/health
```

**Test Roll** (requires game to be in correct state):
```bash
curl -X POST https://vrf-oracle-backend.onrender.com/api/roll-dice \
  -H "Content-Type: application/json" \
  -d '{"gameCode":"TEST","roundNumber":1}'
```

## Troubleshooting

If the game still gets stuck:
1. Check Vercel logs for errors
2. Check Render logs: https://dashboard.render.com → your service → Logs
3. Verify `ORACLE_BACKEND_URL` is set correctly in Vercel
4. Ensure `ADMIN_PRIVATE_KEY` is set in Render environment variables
