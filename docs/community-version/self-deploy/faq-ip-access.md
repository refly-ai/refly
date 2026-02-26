# FAQ: Accessing via IP address

If you are deploying Refly on a cloud server and accessing it via `http://<Public IP>:5700`, you might encounter issues with redirection after login. This is caused by mismatched Cookie domain configurations.

Please follow these steps to adjust your configuration:

## Step 1: Confirm Server Information

Get your cloud server's public IP address, for example: `a.b.c.d`.

## Step 2: Modify Environment Variables

Edit the `deploy/docker/.env` file:

```bash
# Set ORIGIN to the full URL used in the browser, including protocol and port
ORIGIN=http://a.b.c.d:5700

# Set REFLY_COOKIE_DOMAIN to the IP address, without the protocol prefix
REFLY_COOKIE_DOMAIN=a.b.c.d

# Set REFLY_COOKIE_SECURE to empty
REFLY_COOKIE_SECURE=
```

## Step 3: Restart Services

After modifying the configuration file, restart the services for the changes to take effect:

```bash
docker compose down
docker compose up -d
```

## Step 4: Verification and Testing

Run the following command to check if the container's environment variables are correct:

```bash
docker exec refly_api env | egrep 'REFLY_COOKIE|ORIGIN'
```

Example of correct environment variables:

```bash
ORIGIN=http://a.b.c.d:5700
REFLY_COOKIE_DOMAIN=a.b.c.d
REFLY_COOKIE_SECURE=
REFLY_COOKIE_SAME_SITE=Lax
```

Once the environment variables are correct, clear your browser cache and cookies, then try logging in again.
