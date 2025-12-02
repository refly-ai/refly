#!/usr/bin/env python3
"""
Workflow Execution Test Script

This script:
1. Generates a workflow using Copilot Autogen API
2. Uses LLM API to generate variable values
3. Executes the workflow using workflow/initialize API
4. Polls workflow status until completion

Usage:
    # Using command line argument (recommended)
    python test-workflow-autogen.py --query "Your workflow query here"

    # With environment variables
    REFLY_USER_ID="your_user_id" LLM_ENDPOINT="https://litellm.powerformer.net/v1" LLM_API_KEY="your_key" python test-workflow-autogen.py --query "Your query"

    # Optional parameters
    MODEL_NAME="openai/gpt-4o" (default if not specified)
    LOCALE="en-US" (default if not specified)
    API_URL="http://localhost:5800" (default if not specified)

    # Without query argument (uses default query)
    python test-workflow-autogen.py
"""

import argparse
import json
import os
import sys
import time

import requests

DEFAULT_QUERY = """
输入一周工作总结，自动提炼并生成 3 篇专业、有洞察力的 LinkedIn 帖子。
"""


def generate_variable_values(
    query: str, variables: list, llm_endpoint: str, llm_api_key: str, model_name: str
) -> list:
    """
    Use LLM API to generate values for variables

    Args:
        query: User's original query
        variables: List of variables from WorkflowPlan
        llm_endpoint: LLM API endpoint
        llm_api_key: LLM API key
        model_name: Model name to use

    Returns:
        List of variables with generated values
    """
    if not variables:
        return []

    print("🤖 Generating variable values with LLM...")

    # Format variables for prompt
    variables_desc = []
    for var in variables:
        var_info = f"- {var.get('name')}: {var.get('description', 'No description')}"
        variables_desc.append(var_info)

    variables_text = "\n".join(variables_desc)

    # Build prompt
    prompt = f"""Given a user's workflow request and variables, generate appropriate values for each variable.

User Query: {query}

Variables:
{variables_text}

Return JSON only in this exact format:
{{
  "variables": [
    {{"name": "variable_name", "value": "generated_value"}},
    ...
  ]
}}

Generate specific, realistic values based on the user query context."""

    # Construct API URL with smart path handling
    llm_endpoint = llm_endpoint.rstrip("/")
    if llm_endpoint.endswith("/v1"):
        chat_url = f"{llm_endpoint}/chat/completions"
    else:
        chat_url = f"{llm_endpoint}/v1/chat/completions"

    # Call LLM API
    headers = {
        "Authorization": f"Bearer {llm_api_key}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": model_name,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.7,
    }

    print(f"   请求 URL: {chat_url}")
    print(f"   使用模型: {model_name}")

    try:
        response = requests.post(
            chat_url,
            json=payload,
            headers=headers,
            timeout=30,
        )
        response.raise_for_status()

        data = response.json()
        content = data.get("choices", [{}])[0].get("message", {}).get("content", "")

        # Parse JSON from content
        # Try to extract JSON if it's wrapped in markdown code blocks
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()

        generated = json.loads(content)
        generated_vars = generated.get("variables", [])

        # Map generated values back to original variables
        value_map = {v["name"]: v["value"] for v in generated_vars}

        # Update variables with generated values
        for var in variables:
            var_name = var.get("name")
            if var_name in value_map:
                var["value"] = [{"type": "text", "text": value_map[var_name]}]
                print(
                    f'   - {var_name}: "{value_map[var_name][:50]}{"..." if len(value_map[var_name]) > 50 else ""}"'
                )

        return variables

    except requests.exceptions.HTTPError as e:
        print(f"❌ Error calling LLM API: HTTP {e.response.status_code}")
        try:
            print(json.dumps(e.response.json(), indent=2))
        except (json.JSONDecodeError, ValueError):
            print(e.response.text)
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"❌ Error parsing LLM response as JSON: {str(e)}")
        print(f"   Response content: {content}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error generating variable values: {str(e)}")
        sys.exit(1)


def initialize_workflow(canvas_id: str, variables: list, api_url: str, uid: str) -> str:
    """
    Initialize workflow execution using workflow/initialize-test API

    Args:
        canvas_id: Canvas ID
        variables: List of workflow variables with values
        api_url: Base API URL
        uid: User ID

    Returns:
        Execution ID
    """
    endpoint = f"{api_url}/v1/workflow/initialize-test"

    print("\n🚀 Initializing workflow execution...")

    payload = {
        "uid": uid,
        "canvasId": canvas_id,
        "variables": variables,
        "nodeBehavior": "update",
    }

    try:
        response = requests.post(
            endpoint,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=30,
        )
        response.raise_for_status()

        data = response.json()

        if not data.get("success"):
            print("❌ Workflow initialization failed:")
            print(json.dumps(data, indent=2))
            sys.exit(1)

        execution_id = data.get("data", {}).get("workflowExecutionId")

        if execution_id:
            print(f"   Execution ID: {execution_id}")
            return execution_id
        else:
            print("❌ No execution ID returned")
            sys.exit(1)

    except requests.exceptions.HTTPError as e:
        print(f"❌ Error initializing workflow: HTTP {e.response.status_code}")
        try:
            print(json.dumps(e.response.json(), indent=2))
        except (json.JSONDecodeError, ValueError):
            print(e.response.text)
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        sys.exit(1)


def poll_workflow_status(
    execution_id: str,
    api_url: str,
    uid: str,
    poll_interval: int = 2,
    max_wait_time: int = 600,
) -> dict:
    """
    Poll workflow execution status until completion

    Args:
        execution_id: Workflow execution ID
        api_url: Base API URL
        uid: User ID
        poll_interval: Polling interval in seconds (default: 2)
        max_wait_time: Maximum wait time in seconds (default: 600 = 10 minutes)

    Returns:
        Final workflow execution detail
    """
    endpoint = f"{api_url}/v1/workflow/detail-test"

    print("\n⏳ Polling workflow execution status...")
    print(f"   Poll interval: {poll_interval}s")
    print(f"   Max wait time: {max_wait_time}s")

    start_time = time.time()
    poll_count = 0

    try:
        while True:
            poll_count += 1
            elapsed_time = time.time() - start_time

            # Check if exceeded max wait time
            if elapsed_time > max_wait_time:
                print(
                    f"\n⏰ Timeout: Workflow execution exceeded {max_wait_time}s wait time"
                )
                print("   Status check stopped but workflow may still be running")
                sys.exit(1)

            # Query workflow status
            response = requests.get(
                endpoint,
                params={"executionId": execution_id, "uid": uid},
                headers={"Content-Type": "application/json"},
                timeout=10,
            )
            response.raise_for_status()

            data = response.json()

            if not data.get("success"):
                print("❌ Failed to get workflow status:")
                print(json.dumps(data, indent=2))
                sys.exit(1)

            workflow_detail = data.get("data", {})
            status = workflow_detail.get("status")

            # Display progress
            node_executions = workflow_detail.get("nodeExecutions", [])
            total_nodes = len(node_executions)
            finished_nodes = sum(
                1 for n in node_executions if n.get("status") == "finish"
            )
            failed_nodes = sum(
                1 for n in node_executions if n.get("status") == "failed"
            )
            executing_nodes = sum(
                1 for n in node_executions if n.get("status") == "executing"
            )

            print(
                f"   [{poll_count}] Status: {status} | "
                f"Progress: {finished_nodes}/{total_nodes} | "
                f"Failed: {failed_nodes} | "
                f"Executing: {executing_nodes} | "
                f"Time: {elapsed_time:.1f}s"
            )

            # Check if workflow finished
            if status == "finish":
                print("\n✅ Workflow completed successfully!")
                print(f"   Total time: {elapsed_time:.1f}s")
                print(f"   Total polls: {poll_count}")
                print(f"   Nodes executed: {finished_nodes}/{total_nodes}")
                return workflow_detail

            elif status == "failed":
                print("\n❌ Workflow execution failed!")
                print(f"   Total time: {elapsed_time:.1f}s")
                print(f"   Failed nodes: {failed_nodes}/{total_nodes}")

                # Show failed node details
                failed_node_details = [
                    n for n in node_executions if n.get("status") == "failed"
                ]
                if failed_node_details:
                    print("\n   Failed nodes:")
                    for node in failed_node_details:
                        print(
                            f"     - {node.get('nodeId')}: {node.get('title', 'N/A')}"
                        )
                        error_msg = node.get("error", "")
                        if error_msg:
                            print(f"       Error: {error_msg[:100]}...")

                sys.exit(1)

            # Wait before next poll
            time.sleep(poll_interval)

    except requests.exceptions.HTTPError as e:
        print(f"\n❌ Error polling workflow status: HTTP {e.response.status_code}")
        try:
            print(json.dumps(e.response.json(), indent=2))
        except (json.JSONDecodeError, ValueError):
            print(e.response.text)
        sys.exit(1)
    except KeyboardInterrupt:
        print("\n\n⚠️  Polling interrupted by user")
        print(f"   Workflow may still be running (Execution ID: {execution_id})")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Error during polling: {str(e)}")
        sys.exit(1)


def test_workflow_execution(query: str):
    """
    Test complete workflow: generation, variable filling, and execution

    Args:
        query: The workflow query to process
    """

    # Configuration
    api_url = os.getenv("API_URL", "http://localhost:5800")
    endpoint = f"{api_url}/v1/copilot-autogen/generate"

    print("Testing Workflow Execution...")
    print(f"Endpoint: {endpoint}\n")

    # Get required environment variables
    uid = os.getenv("REFLY_USER_ID")
    if not uid:
        print("❌ Error: REFLY_USER_ID environment variable is not set")
        print("\nUsage:")
        print(
            '  REFLY_USER_ID="your_user_id" LLM_ENDPOINT="https://litellm.powerformer.net/v1" LLM_API_KEY="your_key" python test-workflow-autogen.py --query "Your query"'
        )
        sys.exit(1)

    llm_endpoint = os.getenv("LLM_ENDPOINT")
    if not llm_endpoint:
        print("❌ Error: LLM_ENDPOINT environment variable is not set")
        print("\nUsage:")
        print(
            '  REFLY_USER_ID="your_user_id" LLM_ENDPOINT="https://litellm.powerformer.net/v1" LLM_API_KEY="your_key" python test-workflow-autogen.py --query "Your query"'
        )
        sys.exit(1)

    llm_api_key = os.getenv("LLM_API_KEY")
    if not llm_api_key:
        print("❌ Error: LLM_API_KEY environment variable is not set")
        print("\nUsage:")
        print(
            '  REFLY_USER_ID="your_user_id" LLM_ENDPOINT="https://litellm.powerformer.net/v1" LLM_API_KEY="your_key" python test-workflow-autogen.py --query "Your query"'
        )
        sys.exit(1)

    # Get optional parameters
    model_name = os.getenv("MODEL_NAME", "openai/gpt-4o")
    locale = os.getenv("LOCALE", "en-US")

    print(f"User ID: {uid}")
    print(f"LLM Endpoint: {llm_endpoint}")
    print(f"Model: {model_name}")
    print(f"Query: {query}")
    print(f"Locale: {locale}\n")

    # Step 1: Generate Workflow
    print("Sending request...\n")

    payload = {
        "uid": uid,
        "query": query,
        "locale": locale,
    }

    try:
        # Make API request to generate workflow
        response = requests.post(
            endpoint,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=300,  # 5 minutes timeout
        )

        # Check response status
        response.raise_for_status()

        # Parse response
        data = response.json()

        if not data.get("success"):
            print("❌ API returned error:")
            print(json.dumps(data, indent=2))
            sys.exit(1)

        # Display workflow generation results
        result = data.get("data", {})
        canvas_id = result.get("canvasId")
        workflow_plan = result.get("workflowPlan", {})
        variables = workflow_plan.get("variables", [])

        print("✅ Workflow generated successfully!")
        print(f"   Canvas ID: {canvas_id}")
        print(f"   Nodes Count: {result.get('nodesCount')}")
        print(f"   Edges Count: {result.get('edgesCount')}")
        print(f"   Variables: {len(variables)}\n")

        # Step 2: Generate variable values if variables exist
        if variables:
            variables = generate_variable_values(
                query, variables, llm_endpoint, llm_api_key, model_name
            )
        else:
            print("ℹ️  No variables to generate\n")

        # Step 3: Initialize workflow execution
        execution_id = initialize_workflow(canvas_id, variables, api_url, uid)

        print("\n✅ Workflow execution started!")
        frontend_url = api_url.replace(":3000", ":5174").replace(":5800", ":5174")
        print(f"   Canvas URL: {frontend_url}/canvas/{canvas_id}")
        print(f"   Execution ID: {execution_id}")

        # Step 4: Poll workflow status until completion
        workflow_detail = poll_workflow_status(
            execution_id=execution_id,
            api_url=api_url,
            uid=uid,
            poll_interval=10,  # Check every 10 seconds
            max_wait_time=600,  # Wait up to 10 minutes
        )

        # Display final results
        print("\n📊 Final Results:")
        print(f"   Canvas URL: {frontend_url}/canvas/{canvas_id}")
        print(f"   Execution ID: {execution_id}")
        print(f"   Status: {workflow_detail.get('status')}")
        node_executions = workflow_detail.get("nodeExecutions", [])
        if node_executions:
            finished = sum(1 for n in node_executions if n.get("status") == "finish")
            print(f"   Completed nodes: {finished}/{len(node_executions)}")

    except requests.exceptions.Timeout:
        print("❌ Error: Request timeout (waited 5 minutes)")
        print("   The Copilot might be taking longer than expected.")
        sys.exit(1)

    except requests.exceptions.ConnectionError as e:
        print("❌ Error: Connection failed")
        print(f"   Make sure the API server is running at {api_url}")
        print(f"   Details: {str(e)}")
        sys.exit(1)

    except requests.exceptions.HTTPError:
        print(f"❌ Error: HTTP {response.status_code}")
        try:
            error_data = response.json()
            print(json.dumps(error_data, indent=2, ensure_ascii=False))
        except (json.JSONDecodeError, ValueError):
            print(response.text)
        sys.exit(1)

    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback

        traceback.print_exc()
        sys.exit(1)


def main():
    """Main function with argument parsing"""
    parser = argparse.ArgumentParser(
        description="Test Workflow Execution with Copilot Autogen API",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Using command line argument
  python test-workflow-autogen.py --query "Generate LinkedIn posts from weekly summary"
  
  # With all parameters
  REFLY_USER_ID="user_123" LLM_ENDPOINT="https://api.example.com/v1" LLM_API_KEY="sk-xxx" \\
    python test-workflow-autogen.py --query "Your query here"
  
  # Using default query
  python test-workflow-autogen.py
        """,
    )

    parser.add_argument(
        "--query",
        "-q",
        type=str,
        default=None,
        help="Workflow query to process (default: use built-in default query)",
    )

    args = parser.parse_args()

    # Use provided query or default
    query = args.query if args.query else DEFAULT_QUERY.strip()

    if not query:
        print("❌ Error: Query cannot be empty")
        sys.exit(1)

    # Run the workflow execution test
    test_workflow_execution(query)


if __name__ == "__main__":
    main()
