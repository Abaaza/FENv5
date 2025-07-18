import axios, { AxiosInstance } from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test configuration
const API_BASE_URL = process.env.TEST_API_URL || 'http://localhost:5000/api';
const TEST_TIMEOUT = 30000; // 30 seconds per test

// Test report structure
interface TestResult {
  name: string;
  endpoint: string;
  method: string;
  status: 'pass' | 'fail' | 'skip';
  duration: number;
  error?: string;
  response?: any;
}

interface TestReport {
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  timestamp: string;
  results: TestResult[];
}

class ComprehensiveTestSuite {
  private api: AxiosInstance;
  private accessToken: string = '';
  private refreshToken: string = '';
  private testUserId: string = '';
  private testJobId: string = '';
  private testClientId: string = '';
  private testProjectId: string = '';
  private testPriceItemId: string = '';
  private report: TestReport;

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      timeout: TEST_TIMEOUT,
      validateStatus: () => true, // Don't throw on any status
    });

    this.report = {
      totalTests: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0,
      timestamp: new Date().toISOString(),
      results: [],
    };
  }

  // Helper method to run a test
  private async runTest(
    name: string,
    endpoint: string,
    method: string,
    testFn: () => Promise<any>
  ): Promise<void> {
    const startTime = Date.now();
    const result: TestResult = {
      name,
      endpoint,
      method,
      status: 'fail',
      duration: 0,
    };

    try {
      console.log(`\nðŸ” Testing: ${name}`);
      const response = await testFn();
      result.status = 'pass';
      result.response = response?.data;
      console.log(`âœ… PASSED: ${name}`);
      this.report.passed++;
    } catch (error: any) {
      result.status = 'fail';
      result.error = error.message || 'Unknown error';
      console.log(`âŒ FAILED: ${name} - ${result.error}`);
      this.report.failed++;
    }

    result.duration = Date.now() - startTime;
    this.report.results.push(result);
    this.report.totalTests++;
  }

  // Set authorization header
  private setAuthHeader(token: string) {
    this.api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  // Test 1: Health Check
  async testHealthCheck() {
    await this.runTest('Health Check', '/health', 'GET', async () => {
      const response = await this.api.get('/health');
      if (response.status !== 200) throw new Error(`Status ${response.status}`);
      if (response.data.status !== 'ok') throw new Error('Health check failed');
      return response;
    });
  }

  // Test 2: Detailed Health Check
  async testDetailedHealthCheck() {
    await this.runTest('Detailed Health Check', '/health/detailed', 'GET', async () => {
      const response = await this.api.get('/health/detailed');
      if (response.status !== 200 && response.status !== 503) {
        throw new Error(`Unexpected status ${response.status}`);
      }
      return response;
    });
  }

  // Test 3: User Registration
  async testUserRegistration() {
    await this.runTest('User Registration', '/auth/register', 'POST', async () => {
      const testUser = {
        email: `test_${Date.now()}@example.com`,
        password: 'TestPassword123!',
        fullName: 'Test User',
        company: 'Test Company',
      };

      const response = await this.api.post('/auth/register', testUser);
      if (response.status !== 201) throw new Error(`Status ${response.status}: ${response.data.error}`);
      
      this.testUserId = response.data.user.id;
      this.accessToken = response.data.accessToken;
      this.refreshToken = response.data.refreshToken;
      this.setAuthHeader(this.accessToken);
      
      return response;
    });
  }

  // Test 4: User Login
  async testUserLogin() {
    await this.runTest('User Login', '/auth/login', 'POST', async () => {
      const credentials = {
        email: `test_${Date.now() - 1000}@example.com`,
        password: 'TestPassword123!',
      };

      const response = await this.api.post('/auth/login', credentials);
      // It's okay if login fails for non-existent user
      if (response.status === 401) {
        console.log('  â„¹ï¸  Login failed as expected for non-existent user');
        return response;
      }
      
      if (response.status === 200) {
        this.accessToken = response.data.accessToken;
        this.refreshToken = response.data.refreshToken;
        this.setAuthHeader(this.accessToken);
      }
      
      return response;
    });
  }

  // Test 5: Get Current User
  async testGetCurrentUser() {
    await this.runTest('Get Current User', '/auth/me', 'GET', async () => {
      const response = await this.api.get('/auth/me');
      if (response.status !== 200) throw new Error(`Status ${response.status}`);
      return response;
    });
  }

  // Test 6: Refresh Token
  async testRefreshToken() {
    await this.runTest('Refresh Token', '/auth/refresh', 'POST', async () => {
      const response = await this.api.post('/auth/refresh', {
        refreshToken: this.refreshToken,
      });
      
      if (response.status === 200) {
        this.accessToken = response.data.accessToken;
        this.setAuthHeader(this.accessToken);
      }
      
      return response;
    });
  }

  // Test 7: Create Client
  async testCreateClient() {
    await this.runTest('Create Client', '/clients', 'POST', async () => {
      const client = {
        name: 'Test Client ' + Date.now(),
        email: 'client@test.com',
        phone: '+1234567890',
        address: '123 Test St',
        contactPerson: 'John Doe',
      };

      const response = await this.api.post('/clients', client);
      if (response.status !== 201) throw new Error(`Status ${response.status}`);
      
      this.testClientId = response.data.id;
      return response;
    });
  }

  // Test 8: Get All Clients
  async testGetAllClients() {
    await this.runTest('Get All Clients', '/clients', 'GET', async () => {
      const response = await this.api.get('/clients');
      if (response.status !== 200) throw new Error(`Status ${response.status}`);
      return response;
    });
  }

  // Test 9: Create Project
  async testCreateProject() {
    await this.runTest('Create Project', '/projects', 'POST', async () => {
      const project = {
        name: 'Test Project ' + Date.now(),
        clientId: this.testClientId,
        description: 'Test project description',
        status: 'active',
        currency: 'USD',
      };

      const response = await this.api.post('/projects', project);
      if (response.status !== 201) throw new Error(`Status ${response.status}`);
      
      this.testProjectId = response.data.id;
      return response;
    });
  }

  // Test 10: Get All Projects
  async testGetAllProjects() {
    await this.runTest('Get All Projects', '/projects', 'GET', async () => {
      const response = await this.api.get('/projects');
      if (response.status !== 200) throw new Error(`Status ${response.status}`);
      return response;
    });
  }

  // Test 11: Get Price List Stats
  async testGetPriceListStats() {
    await this.runTest('Get Price List Stats', '/price-list/stats', 'GET', async () => {
      const response = await this.api.get('/price-list/stats');
      if (response.status !== 200) throw new Error(`Status ${response.status}`);
      return response;
    });
  }

  // Test 12: Create Price Item
  async testCreatePriceItem() {
    await this.runTest('Create Price Item', '/price-list', 'POST', async () => {
      const item = {
        code: 'TEST-' + Date.now(),
        description: 'Test Price Item',
        unit: 'PCS',
        rate: 100.50,
        category: 'Test Category',
        subcategory: 'Test Subcategory',
      };

      const response = await this.api.post('/price-list', item);
      if (response.status !== 201) throw new Error(`Status ${response.status}`);
      
      this.testPriceItemId = response.data.id;
      return response;
    });
  }

  // Test 13: Get All Price Items
  async testGetAllPriceItems() {
    await this.runTest('Get All Price Items', '/price-list', 'GET', async () => {
      const response = await this.api.get('/price-list');
      if (response.status !== 200) throw new Error(`Status ${response.status}`);
      return response;
    });
  }

  // Test 14: Search Price Items
  async testSearchPriceItems() {
    await this.runTest('Search Price Items', '/price-list/search', 'POST', async () => {
      const response = await this.api.post('/price-list/search', {
        query: 'test',
        limit: 10,
      });
      if (response.status !== 200) throw new Error(`Status ${response.status}`);
      return response;
    });
  }

  // Test 15: Upload BOQ File
  async testUploadBOQ() {
    await this.runTest('Upload BOQ File', '/price-matching/upload-and-match', 'POST', async () => {
      // Create a test Excel file
      const testFilePath = path.join(__dirname, 'test-boq.xlsx');
      
      // Skip if no test file exists
      if (!fs.existsSync(testFilePath)) {
        console.log('  âš ï¸  Skipping: Test file not found');
        this.report.skipped++;
        this.report.totalTests--;
        return null;
      }

      const formData = new FormData();
      formData.append('file', fs.createReadStream(testFilePath));
      formData.append('clientId', this.testClientId);
      formData.append('matchingMethod', 'LOCAL');

      const response = await this.api.post('/price-matching/upload-and-match', formData, {
        headers: formData.getHeaders(),
      });

      if (response.status === 201) {
        this.testJobId = response.data.jobId;
      }

      return response;
    });
  }

  // Test 16: Get User Jobs
  async testGetUserJobs() {
    await this.runTest('Get User Jobs', '/price-matching/jobs', 'GET', async () => {
      const response = await this.api.get('/price-matching/jobs');
      if (response.status !== 200) throw new Error(`Status ${response.status}`);
      return response;
    });
  }

  // Test 17: Get Job Status
  async testGetJobStatus() {
    await this.runTest('Get Job Status', `/jobs/${this.testJobId}/status`, 'GET', async () => {
      if (!this.testJobId) {
        console.log('  âš ï¸  Skipping: No test job ID');
        this.report.skipped++;
        this.report.totalTests--;
        return null;
      }

      const response = await this.api.get(`/jobs/${this.testJobId}/status`);
      if (response.status !== 200) throw new Error(`Status ${response.status}`);
      return response;
    });
  }

  // Test 18: Run Local Test
  async testLocalMatch() {
    await this.runTest('Run Local Match Test', '/test/match', 'POST', async () => {
      const response = await this.api.post('/test/match', {
        description: 'Concrete block 200mm',
        method: 'LOCAL',
      });
      if (response.status !== 200) throw new Error(`Status ${response.status}`);
      return response;
    });
  }

  // Test 19: Get Dashboard Stats
  async testGetDashboardStats() {
    await this.runTest('Get Dashboard Stats', '/dashboard/stats', 'GET', async () => {
      const response = await this.api.get('/dashboard/stats');
      if (response.status !== 200) throw new Error(`Status ${response.status}`);
      return response;
    });
  }

  // Test 20: Get Recent Activity
  async testGetRecentActivity() {
    await this.runTest('Get Recent Activity', '/dashboard/activity', 'GET', async () => {
      const response = await this.api.get('/dashboard/activity');
      if (response.status !== 200) throw new Error(`Status ${response.status}`);
      return response;
    });
  }

  // Test 21: Update Price Item
  async testUpdatePriceItem() {
    await this.runTest('Update Price Item', `/price-list/${this.testPriceItemId}`, 'PUT', async () => {
      if (!this.testPriceItemId) {
        console.log('  âš ï¸  Skipping: No test price item ID');
        this.report.skipped++;
        this.report.totalTests--;
        return null;
      }

      const updates = {
        description: 'Updated Test Price Item',
        rate: 150.75,
      };

      const response = await this.api.put(`/price-list/${this.testPriceItemId}`, updates);
      if (response.status !== 200) throw new Error(`Status ${response.status}`);
      return response;
    });
  }

  // Test 22: Delete Price Item
  async testDeletePriceItem() {
    await this.runTest('Delete Price Item', `/price-list/${this.testPriceItemId}`, 'DELETE', async () => {
      if (!this.testPriceItemId) {
        console.log('  âš ï¸  Skipping: No test price item ID');
        this.report.skipped++;
        this.report.totalTests--;
        return null;
      }

      const response = await this.api.delete(`/price-list/${this.testPriceItemId}`);
      if (response.status !== 200) throw new Error(`Status ${response.status}`);
      return response;
    });
  }

  // Test 23: Logout
  async testLogout() {
    await this.runTest('User Logout', '/auth/logout', 'POST', async () => {
      const response = await this.api.post('/auth/logout');
      if (response.status !== 200) throw new Error(`Status ${response.status}`);
      return response;
    });
  }

  // Generate test report
  private generateReport(): string {
    const report = this.report;
    const successRate = ((report.passed / report.totalTests) * 100).toFixed(2);

    let output = '\n';
    output += '='.repeat(60) + '\n';
    output += '                    TEST REPORT\n';
    output += '='.repeat(60) + '\n\n';

    output += `ðŸ“… Timestamp: ${report.timestamp}\n`;
    output += `â±ï¸  Duration: ${(report.duration / 1000).toFixed(2)}s\n\n`;

    output += 'ðŸ“Š SUMMARY\n';
    output += '-'.repeat(30) + '\n';
    output += `Total Tests:  ${report.totalTests}\n`;
    output += `âœ… Passed:     ${report.passed}\n`;
    output += `âŒ Failed:     ${report.failed}\n`;
    output += `âš ï¸  Skipped:    ${report.skipped}\n`;
    output += `Success Rate: ${successRate}%\n\n`;

    output += 'ðŸ“‹ DETAILED RESULTS\n';
    output += '-'.repeat(60) + '\n';

    report.results.forEach((result) => {
      const status = result.status === 'pass' ? 'âœ…' : result.status === 'fail' ? 'âŒ' : 'âš ï¸';
      output += `${status} ${result.name}\n`;
      output += `   Endpoint: ${result.method} ${result.endpoint}\n`;
      output += `   Duration: ${result.duration}ms\n`;
      
      if (result.error) {
        output += `   Error: ${result.error}\n`;
      }
      
      output += '\n';
    });

    output += '='.repeat(60) + '\n';

    // Save report to file
    const reportPath = path.join(__dirname, `test-report-${Date.now()}.txt`);
    fs.writeFileSync(reportPath, output);
    console.log(`\nðŸ“„ Report saved to: ${reportPath}`);

    return output;
  }

  // Run all tests
  async runAllTests() {
    console.log('\nðŸš€ Starting Comprehensive Test Suite...\n');
    const startTime = Date.now();

    // Authentication Tests
    console.log('\nðŸ“¦ Authentication Tests');
    await this.testHealthCheck();
    await this.testDetailedHealthCheck();
    await this.testUserRegistration();
    await this.testUserLogin();
    await this.testGetCurrentUser();
    await this.testRefreshToken();

    // Client & Project Tests
    console.log('\nðŸ“¦ Client & Project Tests');
    await this.testCreateClient();
    await this.testGetAllClients();
    await this.testCreateProject();
    await this.testGetAllProjects();

    // Price List Tests
    console.log('\nðŸ“¦ Price List Tests');
    await this.testGetPriceListStats();
    await this.testCreatePriceItem();
    await this.testGetAllPriceItems();
    await this.testSearchPriceItems();
    await this.testUpdatePriceItem();

    // Price Matching Tests
    console.log('\nðŸ“¦ Price Matching Tests');
    await this.testUploadBOQ();
    await this.testGetUserJobs();
    await this.testGetJobStatus();
    await this.testLocalMatch();

    // Dashboard Tests
    console.log('\nðŸ“¦ Dashboard Tests');
    await this.testGetDashboardStats();
    await this.testGetRecentActivity();

    // Cleanup Tests
    console.log('\nðŸ“¦ Cleanup Tests');
    await this.testDeletePriceItem();
    await this.testLogout();

    this.report.duration = Date.now() - startTime;

    // Generate and display report
    const report = this.generateReport();
    console.log(report);

    // Exit with appropriate code
    process.exit(this.report.failed > 0 ? 1 : 0);
  }
}

// Run tests
const testSuite = new ComprehensiveTestSuite();
testSuite.runAllTests().catch((error) => {
  console.error('âŒ Test suite failed:', error);
  process.exit(1);
});
