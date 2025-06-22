#!/usr/bin/env node

/**
 * ConnAI Protocol Server Test Script
 * 
 * Tests the protocol server endpoints to ensure they're working correctly
 */

const http = require('http');

const SERVER_URL = 'http://localhost:8080';

// Test configurations
const tests = [
  {
    name: 'Health Check',
    method: 'GET',
    path: '/health',
    body: null
  },
  {
    name: 'Get Workspace Info',
    method: 'POST',
    path: '/api/request',
    body: {
      id: 'test_1',
      type: 'request',
      timestamp: Date.now(),
      operation: 'get_workspace_info',
      payload: {}
    }
  },
  {
    name: 'Get Context',
    method: 'POST', 
    path: '/api/request',
    body: {
      id: 'test_2',
      type: 'request',
      timestamp: Date.now(),
      operation: 'get_context',
      payload: {
        type: 'editor_state',
        workspaceId: 'default'
      }
    }
  },
  {
    name: 'Authentication',
    method: 'POST',
    path: '/api/request', 
    body: {
      id: 'test_3',
      type: 'request',
      timestamp: Date.now(),
      operation: 'authenticate',
      payload: {
        token: 'test_token_123'
      }
    }
  },
  {
    name: 'Send Event',
    method: 'POST',
    path: '/api/event',
    body: {
      id: 'test_4',
      type: 'event',
      timestamp: Date.now(),
      event: 'test_event',
      payload: {
        message: 'Hello from test script'
      }
    }
  }
];

/**
 * Make HTTP request
 */
function makeRequest(test) {
  return new Promise((resolve, reject) => {
    const url = new URL(test.path, SERVER_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      method: test.method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (test.body) {
      const body = JSON.stringify(test.body);
      options.headers['Content-Length'] = Buffer.byteLength(body);
    }

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = data ? JSON.parse(data) : null;
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: response
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data,
            parseError: error.message
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (test.body) {
      req.write(JSON.stringify(test.body));
    }
    
    req.end();
  });
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('🧪 Testing ConnAI Protocol Server');
  console.log(`📍 Server URL: ${SERVER_URL}`);
  console.log(''); 

  let passedTests = 0;
  let totalTests = tests.length;

  for (const test of tests) {
    console.log(`🔍 Testing: ${test.name}`);
    
    try {
      const response = await makeRequest(test);
      
      if (response.statusCode >= 200 && response.statusCode < 300) {
        console.log(`✅ PASS - Status: ${response.statusCode}`);
        if (response.body) {
          console.log(`📦 Response: ${JSON.stringify(response.body, null, 2)}`);
        }
        passedTests++;
      } else {
        console.log(`❌ FAIL - Status: ${response.statusCode}`);
        console.log(`📦 Response: ${JSON.stringify(response.body, null, 2)}`);
      }
    } catch (error) {
      console.log(`❌ ERROR - ${error.message}`);
    }
    
    console.log('');
  }

  console.log('📊 Test Results:');
  console.log(`✅ Passed: ${passedTests}/${totalTests}`);
  console.log(`❌ Failed: ${totalTests - passedTests}/${totalTests}`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! Protocol server is working correctly.');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed. Check VS Code extension logs.');
    process.exit(1);
  }
}

// Check if server is reachable first
async function checkServer() {
  try {
    const response = await makeRequest({ 
      name: 'Server Check',
      method: 'GET', 
      path: '/health',
      body: null 
    });
    
    if (response.statusCode === 200) {
      console.log('✅ Server is reachable');
      return true;
    } else {
      console.log(`❌ Server returned status: ${response.statusCode}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Cannot reach server: ${error.message}`);
    return false;
  }
}

// Main execution
async function main() {
  console.log('🚀 ConnAI Protocol Server Test');
  console.log('===============================');
  
  const serverReachable = await checkServer();
  if (!serverReachable) {
    console.log('\n💡 Make sure to:');
    console.log('1. Open the ConnAI project in VS Code');
    console.log('2. Run the extension (F5 to debug)');
    console.log('3. Check the Output panel for "ConnAI Protocol Server started"');
    console.log('4. Verify the server is running on the correct port');
    process.exit(1);
  }
  
  console.log('');
  await runTests();
}

main().catch(console.error);
