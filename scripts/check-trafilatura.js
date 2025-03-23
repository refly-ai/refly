#!/usr/bin/env node
/**
 * 用于检查Trafilatura安装的脚本
 * 可以在项目根目录下运行:
 * node scripts/check-trafilatura.js
 */

const { spawnSync } = require('child_process');
const { existsSync } = require('fs');
const path = require('path');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

console.log(`${colors.cyan}===== Trafilatura 环境检查 =====${colors.reset}`);

// 检查Python环境
function checkPython() {
  console.log(`\n${colors.blue}检查Python环境...${colors.reset}`);
  
  let pythonCmd = null;
  let pythonVersion = null;
  
  // 尝试python命令
  try {
    const pythonResult = spawnSync('python', ['--version']);
    if (pythonResult.status === 0) {
      pythonCmd = 'python';
      pythonVersion = pythonResult.stdout?.toString().trim() || pythonResult.stderr?.toString().trim();
      console.log(`${colors.green}✓ 检测到Python: ${pythonVersion}${colors.reset}`);
    }
  } catch (error) {
    console.log(`${colors.yellow}Python命令不可用${colors.reset}`);
  }
  
  // 尝试python3命令
  if (!pythonCmd) {
    try {
      const python3Result = spawnSync('python3', ['--version']);
      if (python3Result.status === 0) {
        pythonCmd = 'python3';
        pythonVersion = python3Result.stdout?.toString().trim() || python3Result.stderr?.toString().trim();
        console.log(`${colors.green}✓ 检测到Python3: ${pythonVersion}${colors.reset}`);
      }
    } catch (error) {
      console.log(`${colors.yellow}Python3命令不可用${colors.reset}`);
    }
  }
  
  if (!pythonCmd) {
    console.log(`${colors.red}✗ 未检测到可用的Python环境${colors.reset}`);
    console.log(`${colors.yellow}请安装Python 3.6+: https://www.python.org/downloads/${colors.reset}`);
    return null;
  }
  
  return pythonCmd;
}

// 检查pip
function checkPip(pythonCmd) {
  console.log(`\n${colors.blue}检查pip...${colors.reset}`);
  
  try {
    const pipResult = spawnSync(pythonCmd, ['-m', 'pip', '--version']);
    if (pipResult.status === 0) {
      const pipVersion = pipResult.stdout?.toString().trim();
      console.log(`${colors.green}✓ 检测到pip: ${pipVersion}${colors.reset}`);
      return true;
    } else {
      console.log(`${colors.red}✗ pip不可用${colors.reset}`);
      console.log(`${colors.yellow}请安装pip: https://pip.pypa.io/en/stable/installation/${colors.reset}`);
      return false;
    }
  } catch (error) {
    console.log(`${colors.red}✗ 检查pip失败: ${error.message}${colors.reset}`);
    return false;
  }
}

// 检查Trafilatura
function checkTrafilatura(pythonCmd) {
  console.log(`\n${colors.blue}检查Trafilatura...${colors.reset}`);
  
  try {
    const trafilaturaResult = spawnSync(pythonCmd, ['-m', 'trafilatura', '--version']);
    if (trafilaturaResult.status === 0) {
      const version = trafilaturaResult.stdout?.toString().trim() || 
                     trafilaturaResult.stderr?.toString().trim() || 
                     '已安装 (版本未知)';
      console.log(`${colors.green}✓ 检测到Trafilatura: ${version}${colors.reset}`);
      return true;
    } else {
      console.log(`${colors.yellow}Trafilatura未安装${colors.reset}`);
      return false;
    }
  } catch (error) {
    console.log(`${colors.yellow}Trafilatura未安装: ${error.message}${colors.reset}`);
    return false;
  }
}

// 安装Trafilatura
function installTrafilatura(pythonCmd) {
  console.log(`\n${colors.blue}正在安装Trafilatura...${colors.reset}`);
  
  try {
    console.log('执行: ' + `${pythonCmd} -m pip install trafilatura --user`);
    const installResult = spawnSync(pythonCmd, ['-m', 'pip', 'install', 'trafilatura', '--user'], {
      stdio: 'inherit'
    });
    
    if (installResult.status === 0) {
      console.log(`${colors.green}✓ Trafilatura安装成功${colors.reset}`);
      return true;
    } else {
      console.log(`${colors.red}✗ Trafilatura安装失败${colors.reset}`);
      return false;
    }
  } catch (error) {
    console.log(`${colors.red}✗ Trafilatura安装失败: ${error.message}${colors.reset}`);
    return false;
  }
}

// 测试Trafilatura
function testTrafilatura(pythonCmd) {
  console.log(`\n${colors.blue}测试Trafilatura...${colors.reset}`);
  
  const testUrl = 'https://github.blog/2019-03-29-leader-spotlight-erin-spiceland/';
  console.log(`测试URL: ${testUrl}`);
  
  const scriptContent = `
import sys
import json
try:
    import trafilatura
    url = "${testUrl}"
    print("正在下载URL...")
    downloaded = trafilatura.fetch_url(url)
    if downloaded:
        print("正在提取内容...")
        result = trafilatura.extract(downloaded, output_format="json", with_metadata=True)
        print("提取结果:")
        print(result)
        sys.exit(0)
    else:
        print(json.dumps({"error": "Failed to download URL"}))
        sys.exit(1)
except Exception as e:
    print(json.dumps({"error": str(e)}))
    sys.exit(1)
  `;
  
  try {
    const testResult = spawnSync(pythonCmd, ['-c', scriptContent], {
      stdio: 'inherit',
      encoding: 'utf-8'
    });
    
    if (testResult.status === 0) {
      console.log(`${colors.green}✓ Trafilatura测试成功${colors.reset}`);
      return true;
    } else {
      console.log(`${colors.red}✗ Trafilatura测试失败${colors.reset}`);
      return false;
    }
  } catch (error) {
    console.log(`${colors.red}✗ Trafilatura测试失败: ${error.message}${colors.reset}`);
    return false;
  }
}

// 主函数
function main() {
  // 检查Python
  const pythonCmd = checkPython();
  if (!pythonCmd) {
    process.exit(1);
  }
  
  // 检查pip
  const pipAvailable = checkPip(pythonCmd);
  if (!pipAvailable) {
    process.exit(1);
  }
  
  // 检查Trafilatura
  let trafilaturaInstalled = checkTrafilatura(pythonCmd);
  
  // 如果未安装，尝试安装
  if (!trafilaturaInstalled) {
    console.log(`\n${colors.yellow}Trafilatura未安装，将尝试安装${colors.reset}`);
    trafilaturaInstalled = installTrafilatura(pythonCmd);
  }
  
  // 测试Trafilatura
  if (trafilaturaInstalled) {
    const testSuccess = testTrafilatura(pythonCmd);
    if (testSuccess) {
      console.log(`\n${colors.green}✅ Trafilatura环境检查完成，一切正常！${colors.reset}`);
      process.exit(0);
    } else {
      console.log(`\n${colors.red}❌ Trafilatura安装正常，但测试失败${colors.reset}`);
      process.exit(1);
    }
  } else {
    console.log(`\n${colors.red}❌ Trafilatura安装失败${colors.reset}`);
    process.exit(1);
  }
}

// 执行主函数
main(); 