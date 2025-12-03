#!/usr/bin/env python3
"""
Batch Workflow Execution Test Script

This script:
1. Reads queries from queries.txt (one per line)
2. Processes queries using LLM (optional enhancement/transformation)
3. Saves processed queries to file
4. Generates workflows for each query using Copilot Autogen API
5. Uses LLM API to generate variable values
6. Executes workflows using workflow/initialize API
7. Polls workflow status until completion
8. Runs multiple workflows concurrently using thread pool

Usage:
    REFLY_EMAIL="your@email.com" REFLY_PASSWORD="your_password" LLM_ENDPOINT="https://litellm.powerformer.net/v1" LLM_API_KEY="your_key" python test-batch-workflow-autogen.py

    Optional:
    MODEL_NAME="openai/gpt-4o" (default if not specified)
    MAX_WORKERS=3 (default if not specified)
    QUERIES_FILE="queries.txt" (default if not specified)
    PROCESSED_QUERIES_FILE="queries-processed.txt" (auto-generated if not specified)
    PROMPT_FILE="prompt-process-query.md" (default: prompt-process-query.md in script directory)
"""

import json
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock

import requests

# Cookie name constant (matches backend)
ACCESS_TOKEN_COOKIE = "_rf_access"

# Global lock for thread-safe printing
print_lock = Lock()

# Statistics counters with detailed stages
stats = {
    "total": 0,
    "generating": 0,  # Generating workflow
    "initializing": 0,  # Initializing workflow execution
    "executing": 0,  # Workflow is executing (polling status)
    "success": 0,  # Successfully completed
    "failed": 0,  # Failed at any stage
    "last_print_time": 0,  # Last time progress was printed
}
stats_lock = Lock()


def safe_print(*args, **kwargs):
    """Thread-safe print function"""
    with print_lock:
        print(*args, **kwargs)
        sys.stdout.flush()


def login_with_session(api_url: str, email: str, password: str) -> requests.Session:
    """
    Login and establish authenticated session

    Args:
        api_url: Base API URL
        email: User email
        password: User password

    Returns:
        Authenticated requests.Session object
    """
    session = requests.Session()

    try:
        response = session.post(
            f"{api_url}/v1/auth/email/login",
            json={"email": email, "password": password},
            headers={"Content-Type": "application/json"},
            timeout=30,
        )
        response.raise_for_status()

        data = response.json()
        if not data.get("success"):
            raise Exception(f"Login failed: {data.get('message', 'Unknown error')}")

        # Extract access token from cookies and set Authorization header
        access_token = session.cookies.get(ACCESS_TOKEN_COOKIE)
        if not access_token:
            raise Exception(
                f"No access token cookie ({ACCESS_TOKEN_COOKIE}) found in response"
            )

        # Set Authorization header for subsequent requests
        session.headers.update({"Authorization": f"Bearer {access_token}"})

        return session

    except requests.exceptions.RequestException as e:
        raise Exception(f"Login request failed: {str(e)}")
    except Exception as e:
        raise Exception(f"Login error: {str(e)}")


def update_stats(old_status: str, new_status: str):
    """Thread-safe statistics update"""
    with stats_lock:
        # Decrement old status if it's not None
        if (
            old_status
            and old_status in stats
            and old_status not in ["total", "success", "failed", "last_print_time"]
        ):
            stats[old_status] = max(0, stats[old_status] - 1)

        # Increment new status
        if new_status in stats and new_status != "last_print_time":
            stats[new_status] += 1


def print_progress(force: bool = False):
    """Print current progress statistics with detailed stages

    Args:
        force: Force print even if within the time interval
    """
    current_time = time.time()

    with stats_lock:
        # Only print every 2 seconds unless forced
        if not force and (current_time - stats["last_print_time"]) < 2:
            return

        stats["last_print_time"] = current_time

        total = stats["total"]
        generating = stats["generating"]
        initializing = stats["initializing"]
        executing = stats["executing"]
        success = stats["success"]
        failed = stats["failed"]
        completed = success + failed

        # Build progress string with only non-zero stages
        parts = [f"{completed}/{total}"]

        if generating > 0:
            parts.append(f"🔄 生成:{generating}")
        if initializing > 0:
            parts.append(f"🚀 初始化:{initializing}")
        if executing > 0:
            parts.append(f"⏳ 执行:{executing}")

        parts.append(f"✅ {success}")

        if failed > 0:
            parts.append(f"❌ {failed}")

        # Print with newline instead of carriage return
        timestamp = time.strftime("%H:%M:%S")
        print(f"[{timestamp}] 📊 进度: {' | '.join(parts)}", flush=True)


def generate_variable_values(
    query: str,
    variables: list,
    llm_endpoint: str,
    llm_api_key: str,
    model_name: str,
    max_retries: int = 3,
) -> list:
    """
    Use LLM API to generate values for variables

    Args:
        query: User's original query
        variables: List of variables from WorkflowPlan
        llm_endpoint: LLM API endpoint
        llm_api_key: LLM API key
        model_name: Model name to use
        max_retries: Maximum number of retries (default: 3)

    Returns:
        List of variables with generated values
    """
    if not variables:
        return []

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

    last_error = None

    for attempt in range(max_retries):
        try:
            response = requests.post(
                chat_url,
                json=payload,
                headers=headers,
                timeout=60,
            )
            response.raise_for_status()

            data = response.json()
            content = data.get("choices", [{}])[0].get("message", {}).get("content", "")

            # Parse JSON from content
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

            return variables

        except requests.exceptions.RequestException as e:
            last_error = e
            if attempt < max_retries - 1:
                # Wait before retry with exponential backoff
                wait_time = min(2**attempt * 2, 10)
                time.sleep(wait_time)
                continue
        except (json.JSONDecodeError, KeyError) as e:
            last_error = e
            if attempt < max_retries - 1:
                # Wait before retry
                time.sleep(2)
                continue

    raise Exception(
        f"Failed to generate variable values after {max_retries} retries: {str(last_error)}"
    )


def initialize_workflow(
    canvas_id: str,
    variables: list,
    api_url: str,
    session: requests.Session,
    max_retries: int = 3,
) -> str:
    """
    Initialize workflow execution using workflow/initialize API

    Args:
        canvas_id: Canvas ID
        variables: List of workflow variables with values
        api_url: Base API URL
        session: Authenticated requests session
        max_retries: Maximum number of retries (default: 3)

    Returns:
        Execution ID
    """
    endpoint = f"{api_url}/v1/workflow/initialize"

    payload = {
        "canvasId": canvas_id,
        "variables": variables,
        "nodeBehavior": "update",
    }

    last_error = None

    for attempt in range(max_retries):
        try:
            response = session.post(
                endpoint,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=30,
            )
            response.raise_for_status()

            data = response.json()

            if not data.get("success"):
                raise Exception("Workflow initialization failed")

            execution_id = data.get("data", {}).get("workflowExecutionId")

            if not execution_id:
                raise Exception("No execution ID returned")

            return execution_id

        except requests.exceptions.RequestException as e:
            last_error = e
            if attempt < max_retries - 1:
                # Wait before retry with exponential backoff
                wait_time = min(2**attempt, 10)
                time.sleep(wait_time)
                continue
        except Exception as e:
            raise Exception(f"Failed to initialize workflow: {str(e)}")

    raise Exception(
        f"Failed to initialize workflow after {max_retries} retries: {str(last_error)}"
    )


def poll_workflow_status(
    execution_id: str,
    api_url: str,
    session: requests.Session,
    poll_interval: int = 10,
    max_wait_time: int = 1800,
    max_retries: int = 5,
) -> dict:
    """
    Poll workflow execution status until completion

    Args:
        execution_id: Workflow execution ID
        api_url: Base API URL
        session: Authenticated requests session
        poll_interval: Polling interval in seconds
        max_wait_time: Maximum wait time in seconds (default: 1800s = 30min)
        max_retries: Maximum number of retries for failed requests (default: 5)

    Returns:
        Final workflow execution detail
    """
    endpoint = f"{api_url}/v1/workflow/detail"

    start_time = time.time()
    consecutive_failures = 0

    try:
        while True:
            elapsed_time = time.time() - start_time

            # Check if exceeded max wait time
            if elapsed_time > max_wait_time:
                raise Exception(f"Timeout: exceeded {max_wait_time}s wait time")

            try:
                # Query workflow status
                response = session.get(
                    endpoint,
                    params={"executionId": execution_id},
                    headers={"Content-Type": "application/json"},
                    timeout=30,
                )
                response.raise_for_status()

                data = response.json()

                if not data.get("success"):
                    consecutive_failures += 1
                    if consecutive_failures >= max_retries:
                        raise Exception(
                            f"Failed to get workflow status after {max_retries} retries"
                        )
                    # Wait before retry
                    time.sleep(poll_interval)
                    continue

                # Reset failure counter on success
                consecutive_failures = 0

                workflow_detail = data.get("data", {})
                status = workflow_detail.get("status")

                # Check if workflow finished
                if status == "finish":
                    return workflow_detail

                elif status == "failed":
                    node_executions = workflow_detail.get("nodeExecutions", [])
                    failed_nodes = [
                        n for n in node_executions if n.get("status") == "failed"
                    ]
                    error_msg = "Workflow execution failed"
                    if failed_nodes:
                        error_msg += f" ({len(failed_nodes)} nodes failed)"
                    raise Exception(error_msg)

                # Wait before next poll
                time.sleep(poll_interval)

            except requests.exceptions.RequestException as e:
                # Handle network errors with retry
                consecutive_failures += 1
                if consecutive_failures >= max_retries:
                    raise Exception(
                        f"Network error after {max_retries} retries: {str(e)}"
                    )
                # Wait before retry with exponential backoff
                wait_time = min(poll_interval * (2 ** (consecutive_failures - 1)), 60)
                time.sleep(wait_time)
                continue

    except Exception as e:
        raise Exception(f"Polling failed: {str(e)}")


def process_single_query(
    query_index: int,
    query: str,
    session: requests.Session,
    api_url: str,
    llm_endpoint: str,
    llm_api_key: str,
    model_name: str,
    locale: str,
) -> dict:
    """
    Process a single query through the complete workflow

    Args:
        query_index: Index of the query (for logging)
        query: User query
        session: Authenticated requests session
        api_url: Base API URL
        llm_endpoint: LLM API endpoint
        llm_api_key: LLM API key
        model_name: Model name
        locale: Locale setting

    Returns:
        Result dictionary with success status and details
    """
    result = {
        "index": query_index,
        "query": query,
        "success": False,
        "canvas_id": None,
        "execution_id": None,
        "error": None,
        "nodes_count": 0,
        "duration": 0,
    }

    start_time = time.time()
    current_status = None

    try:
        # Stage 1: Generating workflow
        current_status = "generating"
        update_stats(None, "generating")
        print_progress(force=True)

        endpoint = f"{api_url}/v1/copilot-autogen/generate"
        payload = {
            "query": query,
            "locale": locale,
        }

        # Retry workflow generation with exponential backoff
        max_retries = 3

        for attempt in range(max_retries):
            try:
                response = session.post(
                    endpoint,
                    json=payload,
                    headers={"Content-Type": "application/json"},
                    timeout=600,  # Increased from 300s to 600s for complex workflows
                )
                response.raise_for_status()

                data = response.json()
                if not data.get("success"):
                    # Extract error message from API response
                    error_msg = (
                        data.get("message") or data.get("error") or "Unknown error"
                    )
                    error_detail = f"Workflow generation failed: {error_msg}"

                    # Print error information immediately
                    safe_print(f"\n❌ Query [{query_index}] generation failed:")
                    safe_print(f"   Query: {query[:80]}...")
                    safe_print(f"   Error: {error_msg}")
                    if data.get("data"):
                        safe_print(
                            f"   Details: {json.dumps(data.get('data'), ensure_ascii=False)}"
                        )

                    raise Exception(error_detail)

                # Extract workflow details
                workflow_result = data.get("data", {})
                canvas_id = workflow_result.get("canvasId")
                workflow_plan = workflow_result.get("workflowPlan", {})
                variables = workflow_plan.get("variables", [])

                result["canvas_id"] = canvas_id
                result["nodes_count"] = workflow_result.get("nodesCount", 0)

                # Generate variable values if needed (still in generating phase)
                if variables:
                    variables = generate_variable_values(
                        query, variables, llm_endpoint, llm_api_key, model_name
                    )

                # Success, break retry loop
                break

            except requests.exceptions.RequestException as e:
                error_msg = f"Network error: {str(e)}"
                if attempt < max_retries - 1:
                    # Print retry warning
                    safe_print(
                        f"\n⚠️  Query [{query_index}] generation attempt {attempt + 1} failed, retrying..."
                    )
                    safe_print(f"   Error: {error_msg}")
                    # Wait before retry with exponential backoff
                    wait_time = min(2**attempt * 5, 30)
                    time.sleep(wait_time)
                    continue
                else:
                    # Print final failure
                    safe_print(
                        f"\n❌ Query [{query_index}] generation failed after {max_retries} retries:"
                    )
                    safe_print(f"   Query: {query[:80]}...")
                    safe_print(f"   Error: {error_msg}")
                    raise Exception(
                        f"Workflow generation failed after {max_retries} retries: {str(e)}"
                    )
            except Exception as e:
                # Only re-raise if this is already our custom exception
                if "Workflow generation failed:" in str(e):
                    raise
                # Otherwise, wrap and print the error
                safe_print(f"\n❌ Query [{query_index}] generation error:")
                safe_print(f"   Query: {query[:80]}...")
                safe_print(f"   Error: {str(e)}")
                raise Exception(f"Workflow generation error: {str(e)}")

        # Stage 2: Initializing workflow execution
        old_status = current_status
        current_status = "initializing"
        update_stats(old_status, "initializing")
        print_progress(force=True)

        execution_id = initialize_workflow(canvas_id, variables, api_url, session)
        result["execution_id"] = execution_id

        # Stage 3: Executing workflow (polling status)
        old_status = current_status
        current_status = "executing"
        update_stats(old_status, "executing")
        print_progress(force=True)

        _ = poll_workflow_status(
            execution_id=execution_id,
            api_url=api_url,
            session=session,
            poll_interval=10,
            max_wait_time=1800,
            max_retries=5,
        )

        # Stage 4: Success
        result["success"] = True
        result["duration"] = time.time() - start_time
        update_stats(current_status, "success")
        print_progress(force=True)

    except Exception as e:
        result["error"] = str(e)
        result["duration"] = time.time() - start_time
        update_stats(current_status, "failed")
        print_progress(force=True)

    return result


def load_queries(queries_file: str) -> list:
    """
    Load queries from file

    Args:
        queries_file: Path to queries file

    Returns:
        List of query strings
    """
    if not os.path.exists(queries_file):
        safe_print(f"❌ Error: Queries file not found: {queries_file}")
        sys.exit(1)

    try:
        with open(queries_file, "r", encoding="utf-8") as f:
            queries = [line.strip() for line in f if line.strip()]

        if not queries:
            safe_print(f"❌ Error: No queries found in {queries_file}")
            sys.exit(1)

        return queries

    except Exception as e:
        safe_print(f"❌ Error reading queries file: {str(e)}")
        sys.exit(1)


def load_prompt_template(prompt_file: str) -> str:
    """
    Load prompt template from file

    Args:
        prompt_file: Path to prompt template file

    Returns:
        Prompt template string
    """
    try:
        with open(prompt_file, "r", encoding="utf-8") as f:
            return f.read()
    except Exception as e:
        raise Exception(f"Failed to load prompt template: {str(e)}")


def process_single_query_with_llm(
    query: str,
    prompt_template: str,
    llm_endpoint: str,
    llm_api_key: str,
    model_name: str,
    max_retries: int = 3,
) -> str:
    """
    Process a single query using LLM

    Args:
        query: Original query string
        prompt_template: Prompt template with {query} placeholder
        llm_endpoint: LLM API endpoint
        llm_api_key: LLM API key
        model_name: Model name to use
        max_retries: Maximum number of retries

    Returns:
        Processed query string
    """
    # Build full prompt by replacing {query} placeholder
    full_prompt = prompt_template.replace("{query}", query)

    # Construct API URL
    llm_endpoint = llm_endpoint.rstrip("/")
    if llm_endpoint.endswith("/v1"):
        chat_url = f"{llm_endpoint}/chat/completions"
    else:
        chat_url = f"{llm_endpoint}/v1/chat/completions"

    headers = {
        "Authorization": f"Bearer {llm_api_key}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": model_name,
        "messages": [{"role": "user", "content": full_prompt}],
        "temperature": 0.3,
    }

    last_error = None

    for attempt in range(max_retries):
        try:
            response = requests.post(
                chat_url,
                json=payload,
                headers=headers,
                timeout=60,
            )
            response.raise_for_status()

            data = response.json()
            processed_query = (
                data.get("choices", [{}])[0]
                .get("message", {})
                .get("content", "")
                .strip()
            )

            if not processed_query:
                raise Exception("Empty response from LLM")

            return processed_query

        except requests.exceptions.RequestException as e:
            last_error = e
            if attempt < max_retries - 1:
                wait_time = min(2**attempt * 2, 10)
                time.sleep(wait_time)
                continue
        except (KeyError, IndexError) as e:
            last_error = e
            if attempt < max_retries - 1:
                time.sleep(2)
                continue

    # If all retries failed, return original query
    safe_print(f"⚠️  处理查询失败 (使用原始查询): {query[:50]}... - {str(last_error)}")
    return query


def process_queries(
    queries: list,
    llm_endpoint: str,
    llm_api_key: str,
    model_name: str,
    output_file: str = None,
    prompt_file: str = None,
) -> list:
    """
    Process queries using LLM (e.g., enhance, validate, or transform queries)

    Args:
        queries: List of original query strings
        llm_endpoint: LLM API endpoint
        llm_api_key: LLM API key
        model_name: Model name to use
        output_file: Optional output file path to save processed queries
        prompt_file: Path to prompt template file (relative to script directory if not absolute)

    Returns:
        List of processed query strings
    """
    safe_print("🔄 处理查询中...")

    # If prompt_file is not provided or is relative, resolve it relative to script directory
    if prompt_file is None:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        prompt_file = os.path.join(script_dir, "prompt-process-query.md")
    elif not os.path.isabs(prompt_file):
        script_dir = os.path.dirname(os.path.abspath(__file__))
        prompt_file = os.path.join(script_dir, prompt_file)

    # Load prompt template
    try:
        prompt_template = load_prompt_template(prompt_file)
        safe_print(f"   已加载 prompt: {os.path.basename(prompt_file)}")
    except Exception as e:
        safe_print(f"⚠️  无法加载 prompt 文件 ({prompt_file}): {str(e)}")
        safe_print("⚠️  将使用原始查询\n")
        return queries

    processed_queries = []

    for idx, query in enumerate(queries):
        try:
            processed_query = process_single_query_with_llm(
                query, prompt_template, llm_endpoint, llm_api_key, model_name
            )
            processed_queries.append(processed_query)

            # Show progress for each query
            safe_print(f"   [{idx + 1}/{len(queries)}] 已处理")

        except Exception as e:
            safe_print(f"⚠️  处理第 {idx + 1} 个查询失败: {str(e)}")
            # Use original query on error
            processed_queries.append(query)

    safe_print(f"✅ 已处理 {len(processed_queries)} 个查询")

    # Write processed queries to output file if specified
    if output_file:
        try:
            with open(output_file, "w", encoding="utf-8") as f:
                for query in processed_queries:
                    f.write(f"{query}\n")
            safe_print(f"💾 已保存处理后的查询到: {output_file}\n")
        except Exception as e:
            safe_print(f"⚠️  保存查询文件失败: {str(e)}\n")
    else:
        safe_print()

    return processed_queries


def test_batch_workflow_execution():
    """Test batch workflow execution with concurrent processing"""

    # Configuration
    api_url = os.getenv("API_URL", "http://localhost:5800")
    queries_file = os.getenv("QUERIES_FILE", "queries.txt")
    max_workers = int(
        os.getenv("MAX_WORKERS", "3")
    )  # Reduced from 20 to 3 for stability

    safe_print("🚀 批量工作流执行测试")
    safe_print(f"API 地址: {api_url}")
    safe_print(f"查询文件: {queries_file}")
    safe_print(f"并发数: {max_workers}\n")

    # Get required environment variables
    email = os.getenv("REFLY_EMAIL")
    if not email:
        safe_print("❌ 错误: 未设置 REFLY_EMAIL 环境变量")
        safe_print("\n使用方法:")
        safe_print(
            '  REFLY_EMAIL="your@email.com" REFLY_PASSWORD="your_password" LLM_ENDPOINT="https://litellm.powerformer.net/v1" LLM_API_KEY="your_key" python test-batch-workflow-autogen.py'
        )
        sys.exit(1)

    password = os.getenv("REFLY_PASSWORD")
    if not password:
        safe_print("❌ 错误: 未设置 REFLY_PASSWORD 环境变量")
        sys.exit(1)

    llm_endpoint = os.getenv("LLM_ENDPOINT")
    if not llm_endpoint:
        safe_print("❌ 错误: 未设置 LLM_ENDPOINT 环境变量")
        sys.exit(1)

    llm_api_key = os.getenv("LLM_API_KEY")
    if not llm_api_key:
        safe_print("❌ 错误: 未设置 LLM_API_KEY 环境变量")
        sys.exit(1)

    # Get optional parameters
    model_name = os.getenv("MODEL_NAME", "openai/gpt-4o")
    locale = os.getenv("LOCALE", "en-US")

    # Login to establish authenticated session
    safe_print("🔐 登录中...")
    safe_print(f"   邮箱: {email}")
    try:
        session = login_with_session(api_url, email, password)
        safe_print("✅ 登录成功\n")
    except Exception as e:
        safe_print(f"❌ 登录失败: {str(e)}")
        sys.exit(1)

    safe_print(f"LLM 端点: {llm_endpoint}")
    safe_print(f"模型: {model_name}")
    safe_print(f"语言: {locale}\n")

    # Load queries
    queries = load_queries(queries_file)
    safe_print(f"📋 已加载 {len(queries)} 个查询\n")

    # Process queries (enhancement, validation, transformation, etc.)
    # Generate output file path: queries.txt -> queries-processed.txt
    processed_queries_file = os.getenv("PROCESSED_QUERIES_FILE")
    if not processed_queries_file:
        base_name = os.path.splitext(queries_file)[0]
        processed_queries_file = f"{base_name}-processed.txt"

    # Get prompt file path (default: prompt-process-query.md in script directory)
    prompt_file = os.getenv("PROMPT_FILE")

    queries = process_queries(
        queries,
        llm_endpoint,
        llm_api_key,
        model_name,
        processed_queries_file,
        prompt_file,
    )

    stats["total"] = len(queries)

    # Process queries concurrently
    results = []
    start_time = time.time()

    # Initialize progress display
    print_progress(force=True)

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Submit all tasks
        future_to_query = {
            executor.submit(
                process_single_query,
                idx + 1,
                query,
                session,
                api_url,
                llm_endpoint,
                llm_api_key,
                model_name,
                locale,
            ): (idx + 1, query)
            for idx, query in enumerate(queries)
        }

        # Collect results as they complete
        for future in as_completed(future_to_query):
            result = future.result()
            results.append(result)
            # Print progress after each completion (respects the 2s interval)
            print_progress()

    # Final progress print
    print_progress(force=True)
    safe_print()

    # Calculate total duration
    total_duration = time.time() - start_time

    # Sort results by index for consistent output
    results.sort(key=lambda x: x["index"])

    # Print detailed results
    safe_print("\n" + "=" * 80)
    safe_print("📊 执行结果")
    safe_print("=" * 80 + "\n")

    # Print successful executions
    successful_results = [r for r in results if r["success"]]
    if successful_results:
        safe_print(f"✅ 成功 ({len(successful_results)} 个):\n")
        for result in successful_results:
            safe_print(f"  [{result['index']}] {result['query'][:60]}...")
            safe_print(
                f"      Canvas: {result['canvas_id']} | "
                f"节点数: {result['nodes_count']} | "
                f"耗时: {result['duration']:.1f}s"
            )
            frontend_url = api_url.replace(":3000", ":5174").replace(":5800", ":5174")
            safe_print(f"      链接: {frontend_url}/canvas/{result['canvas_id']}")
            safe_print()

    # Print failed executions
    failed_results = [r for r in results if not r["success"]]
    if failed_results:
        safe_print(f"\n❌ 失败 ({len(failed_results)} 个):\n")
        for result in failed_results:
            safe_print(f"  [{result['index']}] {result['query'][:60]}...")
            safe_print(f"      错误: {result['error']}")
            safe_print()

    # Print summary statistics
    safe_print("=" * 80)
    safe_print("📈 总结")
    safe_print("=" * 80)
    safe_print(f"查询总数: {len(results)}")
    safe_print(
        f"成功: {len(successful_results)} ({len(successful_results) / len(results) * 100:.1f}%)"
    )
    safe_print(
        f"失败: {len(failed_results)} ({len(failed_results) / len(results) * 100:.1f}%)"
    )
    safe_print(f"总耗时: {total_duration:.1f}s")
    if successful_results:
        avg_duration = sum(r["duration"] for r in successful_results) / len(
            successful_results
        )
        safe_print(f"平均耗时 (成功): {avg_duration:.1f}s")
    safe_print("=" * 80)


if __name__ == "__main__":
    test_batch_workflow_execution()
