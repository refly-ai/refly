
import sys
import json
from urllib.parse import urlparse
import traceback

try:
    import trafilatura
except ImportError:
    print(json.dumps({
        "error": "Trafilatura is not installed. Please install with 'pip install trafilatura'."
    }))
    sys.exit(1)

def main():
    if len(sys.argv) < 2:
        print(json.dumps({
            "error": "URL parameter is required"
        }))
        sys.exit(1)
    
    url = sys.argv[1]
    
    try:
        # 验证URL格式
        parsed_url = urlparse(url)
        if not parsed_url.scheme or not parsed_url.netloc:
            print(json.dumps({
                "error": f"Invalid URL format: {url}"
            }))
            sys.exit(1)
            
        # 下载和提取内容
        downloaded = trafilatura.fetch_url(url)
        if not downloaded:
            print(json.dumps({
                "error": f"Failed to download content from URL: {url}"
            }))
            sys.exit(1)
            
        # 提取内容
        result = trafilatura.extract(downloaded, output_format='json', with_metadata=True, include_links=True)
        if not result:
            print(json.dumps({
                "error": f"Failed to extract content from URL: {url}"
            }))
            sys.exit(1)
            
        # 解析JSON结果
        result_obj = json.loads(result)
        
        # 返回提取的内容
        response = {
            "title": result_obj.get("title", ""),
            "content": result_obj.get("text", ""),
            "author": result_obj.get("author", ""),
            "date": result_obj.get("date", ""),
            "url": url
        }
        print(json.dumps(response))
        
    except Exception as e:
        print(json.dumps({
            "error": f"Exception: {str(e)}\n{traceback.format_exc()}"
        }))
        sys.exit(1)

if __name__ == "__main__":
    main()
    sys.stdout.flush()
