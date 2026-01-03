# VRF Oracle Backend

Dedicated Node.js backend for handling Switchboard VRF operations.

## Deployment to Render

1. **Create New Web Service** on [Render](https://render.com)
   - Connect your GitHub repository
   - Select the `oracle-backend` directory as the root

2. **Configure Build Settings**:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment**: Node

3. **Add Environment Variables**:
   ```
   ADMIN_PRIVATE_KEY=your_private_key_here
   MONAD_RPC_URL=https://rpc-mainnet.monadinfra.com
   ```

4. **Deploy** and copy the service URL (e.g., `https://your-service.onrender.com`)

5. **Update Vercel Environment Variable**:
   - Go to your Vercel project settings
   - Add environment variable:
     ```
     ORACLE_BACKEND_URL=https://your-service.onrender.com
     ```
   - Redeploy Vercel

## API Endpoints

### `POST /api/roll-dice`
Complete dice roll (request + fulfill).

**Request**:
```json
{
  "gameCode": "ABC123",
  "roundNumber": 1
}
```

**Response**:
```json
{
  "success": true,
  "result": 2,
  "roundId": "1234567890",
  "txHash": "0x..."
}
```

### `POST /api/fulfill-roll`
Fulfill an existing roll request.

**Request**:
```json
{
  "roundId": "1234567890"
}
```

## Local Testing

```bash
cd oracle-backend
npm install
cp .env.example .env
# Edit .env with your keys
npm start
```

The server will run on `http://localhost:3001`.
