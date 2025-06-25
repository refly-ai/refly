# MCP Store Onboarding Guide

Welcome to the Refly Vibe Workflow Ecosystem! Joining MCP Store is not just a technical process, but an open, standardized, and innovative ecosystem-building journey. We are committed to enabling more excellent tool and service providers to seamlessly integrate through standardized and transparent processes.

---

## 🚀 Admission Standards

To ensure the ecosystem's high quality and security, all tools seeking to join MCP Store must meet the following admission standards:

- Technical Specifications: Must be implemented based on the Model Context Protocol (MCP) protocol.
- Security: Must pass our security audit to ensure no data leakage risks.
- Functionality: Provide a set of clear, definitive, and reusable tool sets.
- Documentation: Provide comprehensive API documentation and end-user instructions.

## 📝 Detailed Explanation for Launch Process

We have designed an open and standardized submission process to help your service transition from concept to reality. Please follow these steps:

1. Fork Official Repository
First, visit our official [GitHub repository](https://github.com/refly-ai/refly) and Fork it to your personal or organizational account.

2. Modify Configuration File
In your forked repository, locate and edit the refly/config/mcp-catalog.json file to add your service information.

Field Description:

```json
{
  "name": "Your MCP Service Name",
  "icon": "Your Service Icon URL (SVG or PNG recommended)",
  "description": "A concise introduction to your service",
  "type": ["streamable", "sse"],
  "url": "Your MCP Service Access Point URL",
  "auth": {
    "method": "Authentication method (e.g., 'bearer', 'api_key')",
    "details": "Authentication-related configuration or instructions"
  },
  "docs": {
    "link": "Your Service Detailed Integration Documentation Link"
  }
}
```

3. Submit Pull Request (PR)
  1. In your forked repository, create a new branch based on the main branch (e.g., feat/add-my-mcp-service).
  2. Commit your modified mcp-catalog.json file.
  3. Initiate a Pull Request to the main branch of our official repository refly-ai/refly.
  4. In the PR description, clearly explain the following :
    - Service Functionality: What problem does your MCP service solve.
    - Technical Details: Brief overview of the technical integration points.
    - Ecosystem Value: What value will your service bring to the Refly ecosystem.

4. Refly Team Review
- Upon receiving your PR, the Refly team will conduct a code review.
- We will assess whether your MCP service's technical implementation complies with protocol specifications and check its security and compatibility.
- If modifications are needed, we will communicate with you through the PR.

5. Merge and Release
- Once your PR passes review, the Refly team will merge it into the main branch.
- The merge will automatically trigger the Catalog configuration file release process, updating your service in the MCP Store directory.
- We typically perform a periodic release once a week.

6. Continuous Synchronization
After release, the Refly platform will automatically pull the latest configuration file, allowing users to discover and use your new service in the MCP Store.
