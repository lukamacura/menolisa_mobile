# Environment Variables Setup

## Quick fix: "Could not reach the server" in Lisa chat

If you see that error when using the app on a **phone or tablet**:

1. On your **computer** (where the Next.js app runs), get your IP:
   - **Windows:** Open Command Prompt, run `ipconfig`, and note the **IPv4 Address** (e.g. `192.168.1.5`).
   - **Mac/Linux:** Run `ifconfig` or `ipconfig getifaddr en0` and note the IP.
2. In **womenreset-mobile**, open `.env` and set:
   ```env
   EXPO_PUBLIC_API_URL=http://YOUR_IP:3000
   ```
   Example: `EXPO_PUBLIC_API_URL=http://192.168.1.5:3000`
3. Make sure the **Next.js** app is running on that machine (`npm run dev` in the womenreset folder).
4. Restart the Expo app (stop and run `npx expo start` again, then reopen the app on the device).

---

## How to View Your Environment Variables

### Option 1: Check your web app's .env file

Your web app (`womenreset`) should have a `.env.local` file. You can copy the values from there:

1. Open `womenreset/.env.local` (or `.env`)
2. Copy the values for:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Option 2: View in Supabase Dashboard

1. Go to https://app.supabase.com
2. Select your project
3. Go to **Settings** → **API**
4. You'll see:
   - **Project URL** → Use this for `EXPO_PUBLIC_SUPABASE_URL`
   - **anon/public key** → Use this for `EXPO_PUBLIC_SUPABASE_ANON_KEY`

### Option 3: Check in Cursor/VS Code

1. In Cursor, open the file explorer
2. Look for `.env.local` or `.env` in the `womenreset` folder
3. The file might be hidden - enable "Show Hidden Files" in file explorer

## Create Your .env File

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Or create `.env` manually in the `womenreset-mobile` root folder

3. Fill in the values:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   EXPO_PUBLIC_API_URL=http://localhost:3000
   ```

## Important Notes

- **EXPO_PUBLIC_** prefix is required for Expo to expose variables to your app
- For local API development, use your computer's IP address (not localhost)
  - Windows: Run `ipconfig` and find your IPv4 address
  - Mac/Linux: Run `ifconfig` and find your IP
  - Example: `http://192.168.1.100:3000`
- Never commit `.env` to git (it's in `.gitignore`)

## Verify Environment Variables

After setting up, you can verify they're loaded by adding this temporarily to `App.tsx`:

```typescript
console.log('Supabase URL:', process.env.EXPO_PUBLIC_SUPABASE_URL);
console.log('API URL:', process.env.EXPO_PUBLIC_API_URL);
```

Then check the console when running `npx expo start`.
