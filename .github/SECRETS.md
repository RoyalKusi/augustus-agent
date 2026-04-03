# GitHub Secrets Required for CI/CD

Go to: GitHub repo → Settings → Secrets and variables → Actions → New repository secret

## SSH / Deployment Secrets

| Secret | Description | Example |
|--------|-------------|---------|
| `HOSTINGER_HOST` | Your Hostinger server IP or hostname | `123.456.789.0` |
| `HOSTINGER_USER` | SSH username (usually `root` or your account) | `u123456789` |
| `HOSTINGER_SSH_KEY` | Private SSH key (full content of `~/.ssh/id_rsa`) | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `HOSTINGER_APP_PATH` | Absolute path to app on server | `/home/u123456789/domains/augustus.silverconne.com/public_nodejs` |

## Database Secrets

| Secret | Description |
|--------|-------------|
| `DB_HOST` | PostgreSQL host |
| `DB_PORT` | PostgreSQL port (usually `5432`) |
| `DB_NAME` | Database name (`augustus`) |
| `DB_USER` | Database user |
| `DB_PASSWORD` | Database password |

## Redis

| Secret | Description |
|--------|-------------|
| `REDIS_URL` | Full Redis connection URL (e.g. `redis://user:pass@host:6379`) |

## S3 Storage

| Secret | Description |
|--------|-------------|
| `S3_ENDPOINT` | S3-compatible endpoint URL |
| `S3_REGION` | Region (e.g. `auto` for Cloudflare R2) |
| `S3_ACCESS_KEY_ID` | Access key |
| `S3_SECRET_ACCESS_KEY` | Secret key |
| `S3_BUCKET` | Bucket name |

## API Keys

| Secret | Description |
|--------|-------------|
| `CLAUDE_API_KEY` | Anthropic Claude API key |
| `META_APP_ID` | Meta App ID |
| `META_APP_SECRET` | Meta App Secret |
| `META_WEBHOOK_VERIFY_TOKEN` | WhatsApp webhook verify token |
| `META_EMBEDDED_SIGNUP_CONFIG_ID` | Meta Embedded Signup Config ID |
| `PAYNOW_INTEGRATION_ID` | Paynow Integration ID |
| `PAYNOW_INTEGRATION_KEY` | Paynow Integration Key |
| `EMAIL_API_KEY` | SendGrid API key |
| `EMAIL_FROM_ADDRESS` | From email address |

## Security Keys

| Secret | Description | How to generate |
|--------|-------------|-----------------|
| `JWT_SECRET` | JWT signing secret (64 hex chars) | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ENCRYPTION_KEY` | AES-256 encryption key (64 hex chars) | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

---

## Setting up SSH access to Hostinger

1. Generate an SSH key pair locally:
   ```bash
   ssh-keygen -t ed25519 -C "github-actions-augustus" -f ~/.ssh/augustus_deploy
   ```

2. Add the **public key** (`augustus_deploy.pub`) to Hostinger:
   - hPanel → SSH Access → Add SSH Key

3. Add the **private key** (`augustus_deploy`) content as the `HOSTINGER_SSH_KEY` GitHub secret

---

## GitHub Environment Protection

The `deploy` job uses the `production` environment. To add approval gates:
1. GitHub repo → Settings → Environments → production
2. Enable "Required reviewers" and add yourself
3. This means every deploy to main requires manual approval
