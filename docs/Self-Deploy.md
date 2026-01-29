# Self-Deploy

**Version:** v2.0 (Updated based on PR #2141)  
**Last Updated:** January 29, 2026

---

## What's New in v2.0

- Production environment variables: `NODE_ENV=production`, `PROVIDER_DEFAULT_MODE=custom`
- Separate deployment config: New `deploy/docker/env.example` isolated from local development
- Unlocked model provider configuration: Full control over AI model selection
- Fixed frontend caching and onboarding issues

---

## Prerequisites

### Hardware Requirements

- **CPU:** 2 cores minimum
- **RAM:** 4GB minimum (8GB recommended)
- **Storage:** 20GB+ available

### Software Requirements

- **Docker:** Version 24.0+
- **Docker Compose:** Version 2.20+
- **Git**

Verify installation:

```bash
docker --version
docker compose version
```

---

## Quick Start

### Step 1: Clone Repository

```bash
git clone https://github.com/refly-ai/refly.git
cd refly
```

### Step 2: Configure Environment

```bash
# Use production template (NEW in v2.0)
cp deploy/docker/env.example .env
```

Edit `.env` with required settings.

#### 2.1: Add Resend API Key (Optional)

If you need to send emails, please get your own key from https://resend.com/ and fill it in `.env`:

```
RESEND_API_KEY=your_resend_api_key
```

#### 2.2: Add Fal API Key (Optional)

If you need to generate image/audio/video, please get your own key from https://fal.ai/ and fill it in `.env`:

```
TOOLSET_FAL_API_KEY=your_fal_api_key
```

### Step 3: Start Services

```bash
cd deploy/docker
docker compose up -d
```

First-time startup takes 5–10 minutes for image downloads.

Check status:

```bash
docker compose ps
```

All containers should show **Up** or **Healthy**.

---

## Verify Deployment

1. Open browser: **http://localhost:5800**
2. Complete first-time setup to create admin account
3. Check **Settings → System Status** for green indicators

---

## Start Using Refly

To start using the self-deployed version of Refly, first register an account with your email and password.

<!-- Image placeholders - replace with your screenshots -->

![Register step 1](path/to/register-1.png)

![Register step 2](path/to/register-2.png)

After signing in, configure providers and models. Click the account icon in the bottom-left corner and select **Settings**.

![Settings](path/to/settings.png)

Add your first provider:

![Settings - Provider](path/to/settings-provider.png)

![Settings - Provider modal](path/to/settings-provider-modal.png)

Add your first chat model:

![Add model](path/to/add-model.png)

![Add model modal](path/to/add-model-modal.png)

Configure embedding and reranker models:

![Other models](path/to/other-models.png)

Happy chatting!

![Start chat](path/to/start-chat.png)

---

## Troubleshooting

### Port Already in Use

**Error:** `port 5700 already allocated`

**Solution:** Change port in `docker-compose.yml`:

```yaml
services:
  web:
    ports:
      - 5700:80
```

### Support

- **GitHub Issues:** https://github.com/refly-ai/refly/issues
- **API Reference:** https://docs.refly.ai/api
