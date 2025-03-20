# Secret Sharing App

A secure, zero-trust secret-sharing app built with **Cloudflare Pages** and **KV**. Features optional E2EE, server-side encryption, auto-expiry with timers, OTP verification, and QR code sharing. Includes a dark-themed UI and API for effortless secret management.

## Features
- **UI and API**: Create, retrieve, and remove secrets via a dark-themed web interface or programmatically.
- **Zero Trust**: Server never sees plaintext secrets; encryption is client-side.
- **Encryption**: Optional client-side AES-GCM (user password or auto-generated key) + server-side AES-GCM (session key encrypted with master key).
- **Auto-Expiry**: Options for 5 minutes, 10 minutes, 1 day (default), or 1 week with a countdown timer.
- **Retrieval Limits**: Configurable max attempts (1-10), with removal option and initial code existence check.
- **Secret Link**: 6-character short code + 4-digit OTP, with optional 4-character key for non-E2EE secrets.
- **QR Code**: Generated for easy sharing with clear instructions.
- **Security**: Autocomplete/autofill disabled for all fields.
- **Styling**: Dark theme using Tailwind CSS via CDN.

## Prerequisites
- A Cloudflare account with Pages and KV enabled.
- Node.js and npm installed locally for development.
- `wrangler` CLI installed (`npm install -g wrangler`).

## Setup

### 1. Clone the Repository
```bash
git clone <repository-url>
cd secret-sharing-app
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Cloudflare KV
- In the Cloudflare dashboard, go to **Workers & Pages > KV**.
- Create a namespace (e.g., `secrets`).
- Note the KV namespace ID.
- Update `wrangler.toml` with the ID:
  ```toml
  [[kv_namespaces]]
  binding = "SECRETS_KV"
  id = "<your-kv-namespace-id>"
  ```

### 4. Set Up Master Server Key
- Generate a 256-bit key:
  ```bash
  openssl rand -base64 32
  ```
  Example output: `X7k9p2mQv8sL4nJ6tR3wY5zA1bC0dE2f`
- For local dev, add to `.dev.vars`:
  ```bash
  echo "MASTER_SERVER_KEY=X7k9p2mQv8sL4nJ6tR3wY5zA1bC0dE2f" > .dev.vars
  ```
- For production, in Cloudflare Pages, go to **Settings > Environment Variables > Secrets**, add `MASTER_SERVER_KEY`.

### 5. Deploy to Cloudflare Pages
- Link your repository to Cloudflare Pages via GitHub/GitLab.
- Or deploy manually:
  ```bash
  npx wrangler pages deploy ./public --project-name secret-sharing-app
  ```

## Development

### 1. Run Locally
- Start a local dev server:
  ```bash
  npx wrangler pages dev ./public --kv SECRETS_KV
  ```
- Open `http://localhost:8788` to test the app.

### 2. Test Features
- **Create a Secret**: Visit `/index.html`, enter a secret, toggle E2EE, set expiry and attempts, and submit. Share the generated link/QR code and OTP.
- **Retrieve a Secret**: Use the link or go to `/retrieve.html?code=<short-code>&key=<optional-key>`. Page checks code existence on load; input OTP and (if E2EE) password. View timer and removal option.
- **Remove a Secret**: After retrieval, click "Remove Secret" to delete it from KV.

### 3. Debugging
- Check logs in the terminal or add `console.log` in Functions and `script.js`.

## Customization

### 1. Modify Expiry Options
- Edit `public/index.html` to change expiry options:
  ```html
  <select id="expiry" class="w-full p-2 border border-gray-600 rounded bg-gray-700 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
    <option value="300">5 Minutes</option>
    <option value="600">10 Minutes</option>
    <option value="86400" selected>1 Day</option>
    <option value="604800">1 Week</option>
    <!-- Add more options here -->
  </select>
  ```

### 2. Adjust Styling
- Modify Tailwind classes in `public/index.html` and `public/retrieve.html` via the CDN script (e.g., toggle dark/light theme by removing `dark` class from `<html>`).

### 3. Change Short Code or Key Length
- In `functions/api/create.js`, adjust the short code length:
  ```javascript
  const code = crypto.randomUUID().slice(0, 8); // Change 6 to desired length
  ```
- In `script.js`, adjust the offline key length:
  ```javascript
  function generateOfflineKey() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let key = "";
    for (let i = 0; i = 8; i++) { // Change 4 to desired length
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
  }
  ```

### 4. API Customization
- Modify responses in `functions/api/create.js`, `functions/api/retrieve.js`, `functions/api/remove.js`, or `functions/api/check.js`.

## Production Use

### 1. Deploy to Production
- Push changes to your linked Git repository, and Cloudflare Pages will auto-deploy.
- Or use:
  ```bash
  npx wrangler pages deploy ./public --project-name secret-sharing-app
  ```

### 2. API Usage
- **Create Secret**:
  ```bash
  curl -X POST https://<your-pages-domain>/api/create \
  -H "Content-Type: application/json" \
  -d '{"encrypted": "<base64-encrypted-secret>", "iv": "<base64-iv>", "expiry": 86400, "maxAttempts": 3, "isE2EE": true}'
  ```
  Response:
  ```json
  {"success": true, "code": "abc123", "otp": "4567"}
  ```

- **Check Secret Existence**:
  ```bash
  curl https://<your-pages-domain>/api/check?code=abc123
  ```
  Response:
  ```json
  {"success": true, "message": "Secret exists"}
  ```

- **Retrieve Secret**:
  ```bash
  curl https://<your-pages-domain>/api/retrieve?code=abc123&otp=4567
  ```
  Response:
  ```json
  {"success": true, "encrypted": "<base64-encrypted-secret>", "iv": "<base64-iv>", "attemptsLeft": 2, "isE2EE": true, "expiry": 1641234567890}
  ```

- **Remove Secret**:
  ```bash
  curl -X DELETE https://<your-pages-domain>/api/remove?code=abc123
  ```
  Response:
  ```json
  {"success": true}
  ```

### 3. Security Considerations
- Ensure `MASTER_SERVER_KEY` is kept secret and rotated periodically.
- Use HTTPS (automatic with Cloudflare).
- Autocomplete/autofill disabled for all fields to prevent browser caching.
- Monitor KV usage to avoid exceeding free tier limits (100K reads/day).
- The 4-character offline key is basic; consider increasing length for non-E2EE secrets.

### 4. Scaling
- For high traffic, consider Cloudflare’s paid KV plans.
- Optimize QR code generation for performance if needed.

## Project Structure
```
my-secret-app/
├── functions/
│   ├── api/
│   │   ├── create.js      # API to create a secret
│   │   ├── retrieve.js    # API to retrieve a secret
│   │   ├── remove.js      # API to remove a secret
│   │   └── check.js       # API to check secret existence
├── public/
│   ├── index.html         # UI for creating secrets
│   ├── retrieve.html      # UI for retrieving secrets
│   ├── script.js          # Client-side logic
├── wrangler.toml          # Cloudflare configuration
└── package.json           # Dependencies
```

## License
MIT License - feel free to use and modify!