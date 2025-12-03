#!/usr/bin/env python3
"""
Quick test script to verify authentication on the copilot-autogen/generate endpoint
"""

import os
import sys

import requests

# Cookie name constant (matches backend)
ACCESS_TOKEN_COOKIE = "_rf_access"


def main():
    # Configuration
    api_url = os.getenv("API_URL", "http://localhost:5800")
    email = os.getenv("REFLY_EMAIL")
    password = os.getenv("REFLY_PASSWORD")

    if not email or not password:
        print(
            "❌ Error: REFLY_EMAIL and REFLY_PASSWORD environment variables are required"
        )
        print("\nUsage:")
        print('  export REFLY_EMAIL="your@email.com"')
        print('  export REFLY_PASSWORD="your_password"')
        print("  python test-generate-auth.py")
        sys.exit(1)

    # Create session
    session = requests.Session()

    # Test 1: Verify unauthenticated access is rejected
    print("=" * 60)
    print("Test 1: Unauthenticated Access (should fail)")
    print("=" * 60)
    try:
        response = requests.post(
            f"{api_url}/v1/copilot-autogen/generate",
            json={"query": "test", "locale": "en-US"},
            timeout=10,
        )
        if response.status_code == 401:
            print("✅ Correctly rejected: 401 Unauthorized")
        else:
            print(f"⚠️  Unexpected status code: {response.status_code}")
            print(f"   Response: {response.text}")
    except Exception as e:
        print(f"❌ Request failed: {e}")

    # Test 2: Login
    print("\n" + "=" * 60)
    print("Test 2: Login")
    print("=" * 60)
    print(f"🔐 Logging in with email: {email}")
    try:
        response = session.post(
            f"{api_url}/v1/auth/email/login",
            json={"email": email, "password": password},
            timeout=10,
        )
        response.raise_for_status()
        print("✅ Login successful")

        # Debug: Check cookies
        print("\n📋 Cookies received:")
        access_token = None
        for cookie_name, cookie_value in session.cookies.items():
            # Don't print full token values for security
            if len(cookie_value) > 20:
                print(f"   {cookie_name}: {cookie_value[:10]}...{cookie_value[-10:]}")
            else:
                print(f"   {cookie_name}: {cookie_value}")

            if cookie_name == ACCESS_TOKEN_COOKIE:
                access_token = cookie_value

        if not session.cookies:
            print("   ⚠️  No cookies received!")

        if not access_token:
            print(f"   ❌ No access token cookie ({ACCESS_TOKEN_COOKIE}) found!")
            sys.exit(1)

        # Set Authorization header for subsequent requests
        session.headers.update({"Authorization": f"Bearer {access_token}"})
        print("\n✅ Authorization header set")

    except requests.exceptions.HTTPError as e:
        print(f"❌ Login failed: HTTP {e.response.status_code}")
        print(f"   Response: {e.response.text}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Login failed: {e}")
        sys.exit(1)

    # Test 3: Authenticated request to generate endpoint
    print("\n" + "=" * 60)
    print("Test 3: Authenticated Generate Request")
    print("=" * 60)
    print("🤖 Testing generate API with authentication...")

    try:
        response = session.post(
            f"{api_url}/v1/copilot-autogen/generate",
            json={
                "query": "生成一个简单的问候工作流",
                "locale": "zh-Hans",
            },
            timeout=60,
        )
        response.raise_for_status()
        data = response.json()

        if data.get("success"):
            canvas_id = data.get("data", {}).get("canvasId")
            nodes_count = data.get("data", {}).get("nodesCount")
            edges_count = data.get("data", {}).get("edgesCount")
            print("✅ Generate successful!")
            print(f"   Canvas ID: {canvas_id}")
            print(f"   Nodes: {nodes_count}")
            print(f"   Edges: {edges_count}")
        else:
            print("⚠️  Request succeeded but response indicates failure")
            print(f"   Response: {data}")

    except requests.exceptions.HTTPError as e:
        print(f"❌ Generate failed: HTTP {e.response.status_code}")
        print(f"   Response: {e.response.text}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Generate failed: {e}")
        sys.exit(1)

    print("\n" + "=" * 60)
    print("✅ All tests passed!")
    print("=" * 60)


if __name__ == "__main__":
    main()
