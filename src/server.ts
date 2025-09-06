import express, { Request, Response } from 'express';
import cors from 'cors';
import multer from 'multer';
import csv from 'csv-parser';
import fs from 'fs';
import { graph } from './agent/graph.js';
import { Profile, Product, Options } from './agent/state.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Ensure uploads directory exists
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'Fashion Creative Agent'
  });
});

// Test BFL API connectivity
app.get('/test-bfl', async (_req: Request, res: Response) => {
  try {
    const bflApiKey = process.env.BFL_API_KEY || 'c437e6fb-d7e2-4953-b238-44fe1656ca02';
    
    console.log('🧪 Testing BFL API connectivity...');
    console.log('🔑 API Key present:', !!bflApiKey);
    console.log('🔑 API Key (first 10 chars):', bflApiKey.substring(0, 10) + '...');
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch('https://api.bfl.ai/v1/flux-pro-1.1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-key': bflApiKey,
        'accept': 'application/json',
        'User-Agent': 'Fashion-Creative-Agent/1.0'
      },
      body: JSON.stringify({
        prompt: 'test image generation',
        width: 1024,
        height: 1024
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    const responseText = await response.text();
    
    res.json({
      status: response.ok ? 'success' : 'error',
      statusCode: response.status,
      statusText: response.statusText,
      headers: {
        'content-type': response.headers.get('content-type'),
        'content-length': response.headers.get('content-length'),
        'x-ratelimit-remaining': response.headers.get('x-ratelimit-remaining')
      },
      body: responseText,
      apiKeyPresent: !!bflApiKey,
      apiKeyLength: bflApiKey.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ BFL API test failed:', error);
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      apiKeyPresent: !!process.env.BFL_API_KEY,
      timestamp: new Date().toISOString()
    });
  }
});

// Poll for BFL image generation result
app.get('/api/poll-image/:requestId', async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const bflApiKey = process.env.BFL_API_KEY || 'c437e6fb-d7e2-4953-b238-44fe1656ca02';
    
    // Try different regional endpoints
    const endpoints = [
      `https://api.eu2.bfl.ai/v1/get_result?id=${requestId}`,
      `https://api.eu4.bfl.ai/v1/get_result?id=${requestId}`,
      `https://api.us1.bfl.ai/v1/get_result?id=${requestId}`
    ];
    
    let response = null;
    let lastError = null;
    
    for (const pollingUrl of endpoints) {
      try {
        console.log(`🔄 Trying polling URL: ${pollingUrl}`);
        response = await fetch(pollingUrl, {
          method: 'GET',
          headers: {
            'accept': 'application/json',
            'x-key': bflApiKey
          }
        });
        
        if (response.ok) {
          console.log(`✅ Success with URL: ${pollingUrl}`);
          break;
        } else {
          console.log(`❌ Failed with URL: ${pollingUrl} - ${response.status}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.log(`❌ Error with URL: ${pollingUrl} - ${errorMessage}`);
        lastError = error;
      }
    }
    
    if (!response || !response.ok) {
      return res.status(500).json({
        error: `All polling endpoints failed. Last error: ${lastError instanceof Error ? lastError.message : 'Unknown error'}`,
        status: 'error'
      });
    }
    
    const data = await response.json();
    
    return res.json({
      status: data.status,
      result: data.result,
      error: data.error,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Polling failed:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
      status: 'error'
    });
  }
});

// Generate creative from JSON input
app.post('/api/generate-creative', async (req: Request, res: Response) => {
  try {
    console.log('🔍 DEBUG - Received request body:', JSON.stringify(req.body, null, 2));
    const { profile, product, options } = req.body;

    // Validate required fields
    if (!profile || !product) {
      console.log('❌ DEBUG - Missing required fields:', { profile: !!profile, product: !!product });
      return res.status(400).json({
        error: 'Missing required fields: profile and product are required'
      });
    }

    // Set default options if not provided
    const defaultOptions: Options = {
      aspect: '1:1',
      channel: 'instagram_feed',
      fallback_image_url: 'https://dummyimage.com/1080x1080/111827/f5f5f5.png&text=Backup',
      ab_variant: 'A',
      ...options
    };

    console.log('Generating creative for:', profile.firstname, profile.email);

    // Run the LangGraph workflow
    const result = await graph.invoke({
      profile,
      product,
      options: defaultOptions
    });

    // Check for errors - but still return creative if it has fallback content
    if (result.error?.error) {
      // If we have creative content (even with fallback), return it
      if (result.creative?.image_url) {
        return res.json({
          success: true,
          creative: result.creative,
          persona: result.persona,
          status: result.status || 'fallback',
          timestamp: new Date().toISOString(),
          warning: result.error.error
        });
      }
      
      // Only return error if no creative content at all
      return res.status(500).json({
        error: result.error.error,
        status: 'error'
      });
    }

    // Return the creative content
    return res.json({
      success: true,
      creative: result.creative,
      persona: result.persona,
      status: result.status,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error generating creative:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      status: 'error'
    });
  }
});

// Process CSV file and generate creatives
app.post('/api/process-csv', upload.single('csvFile'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No CSV file uploaded' });
    }

    const results: any[] = [];
    const errors: any[] = [];

    // Parse CSV file
    const csvData: any[] = [];
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    await new Promise((resolve, reject) => {
      fs.createReadStream(req.file!.path)
        .pipe(csv())
        .on('data', (row) => csvData.push(row))
        .on('end', resolve)
        .on('error', reject);
    });

    console.log(`Processing ${csvData.length} rows from CSV`);

    // Process each row
    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];
      
      try {
        // Split semicolon-separated strings into arrays
        const splitString = (str: string) => {
          if (!str || typeof str !== 'string') return [];
          return str.split(';').map(s => s.trim()).filter(s => s.length > 0);
        };

        // Build profile from CSV data
        const profile: Profile = {
          contact_id: row.contact_id || `FASH-${Date.now()}-${i}`,
          email: row.email || 'demo@example.com',
          firstname: row.firstname || 'Demo',
          locale: row.locale || 'en-US',
          country: row.country || 'US',
          city: row.city || 'New York',
          tags: splitString(row.tags),
          interest_keywords: splitString(row.interest_keywords)
        };

        // Use hardcoded product for demo (can be made dynamic)
        const product: Product = {
          sku: 'SKU-DEMO-001',
          title: 'Premium Fashion Item',
          category: 'hoodies',
          colorways: ['#000000', '#F5F5F5', '#FF6B6B'],
          price_band: 'mid',
          launch_type: 'drop',
          brand_name: 'Demo Brand'
        };

        const options: Options = {
          aspect: '1:1',
          channel: 'instagram_feed',
          fallback_image_url: 'https://dummyimage.com/1080x1080/111827/f5f5f5.png&text=Backup',
          ab_variant: 'A'
        };

        // Generate creative for this row
        const result = await graph.invoke({
          profile,
          product,
          options
        });

        if (result.error?.error) {
          errors.push({
            row: i + 1,
            contact_id: profile.contact_id,
            error: result.error.error
          });
        } else {
          results.push({
            row: i + 1,
            contact_id: profile.contact_id,
            creative: result.creative,
            persona: result.persona,
            status: result.status
          });
        }

      } catch (error) {
        errors.push({
          row: i + 1,
          contact_id: row.contact_id || `ROW-${i + 1}`,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Clean up uploaded file
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }

    return res.json({
      success: true,
      processed: csvData.length,
      successful: results.length,
      errorCount: errors.length,
      results,
      errors,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error processing CSV:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      status: 'error'
    });
  }
});

// Serve a simple HTML interface for testing
app.get('/', (_req: Request, res: Response) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Fashion Creative Agent</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .container { max-width: 800px; margin: 0 auto; }
            .section { margin: 20px 0; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
            button { padding: 10px 20px; margin: 5px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; }
            button:hover { background: #0056b3; }
            input, textarea { width: 100%; padding: 8px; margin: 5px 0; border: 1px solid #ddd; border-radius: 4px; }
            .result { margin: 10px 0; padding: 10px; background: #f8f9fa; border-radius: 4px; }
            .error { background: #f8d7da; color: #721c24; }
            .success { background: #d4edda; color: #155724; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🎨 Fashion Creative Agent</h1>
            <p>Generate personalized fashion creatives using AI-powered image generation and copywriting.</p>
            
            <div class="section">
                <h2>Test with JSON Input</h2>
                <button onclick="testWithSampleData()">Test with Sample Data</button>
                <div id="jsonResult" class="result" style="display: none;"></div>
            </div>
            
            <div class="section">
                <h2>Upload CSV File</h2>
                <input type="file" id="csvFile" accept=".csv" />
                <button onclick="processCSV()">Process CSV</button>
                <div id="csvResult" class="result" style="display: none;"></div>
            </div>
            
            <div class="section">
                <h2>API Endpoints</h2>
                <ul>
                    <li><strong>POST /api/generate-creative</strong> - Generate creative from JSON</li>
                    <li><strong>POST /api/process-csv</strong> - Process CSV file</li>
                    <li><strong>GET /health</strong> - Health check</li>
                </ul>
            </div>
        </div>

        <script>
            async function testWithSampleData() {
                const sampleData = {
                    profile: {
                        contact_id: "FASH-0001",
                        email: "uma.schmidt@example.com",
                        firstname: "Uma",
                        locale: "de-DE",
                        country: "IT",
                        city: "Milano",
                        tags: ["graffiti", "urban"],
                        interest_keywords: ["street", "sneakers"]
                    },
                    product: {
                        sku: "SKU-DEMO-001",
                        title: "Premium Streetwear Hoodie",
                        category: "hoodies",
                        colorways: ["#000000", "#F5F5F5"],
                        price_band: "mid",
                        launch_type: "drop",
                        brand_name: "Demo Brand"
                    },
                    options: {
                        aspect: "1:1",
                        channel: "instagram_feed",
                        fallback_image_url: "https://dummyimage.com/1080x1080/111827/f5f5f5.png&text=Backup",
                        ab_variant: "A"
                    }
                };

                try {
                    const response = await fetch('/api/generate-creative', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(sampleData)
                    });
                    
                    const result = await response.json();
                    displayResult('jsonResult', result, response.ok);
                } catch (error) {
                    displayResult('jsonResult', { error: error.message }, false);
                }
            }

            async function processCSV() {
                const fileInput = document.getElementById('csvFile');
                const file = fileInput.files[0];
                
                if (!file) {
                    alert('Please select a CSV file');
                    return;
                }

                const formData = new FormData();
                formData.append('csvFile', file);

                try {
                    const response = await fetch('/api/process-csv', {
                        method: 'POST',
                        body: formData
                    });
                    
                    const result = await response.json();
                    displayResult('csvResult', result, response.ok);
                } catch (error) {
                    displayResult('csvResult', { error: error.message }, false);
                }
            }

            function displayResult(elementId, data, isSuccess) {
                const element = document.getElementById(elementId);
                element.style.display = 'block';
                element.className = 'result ' + (isSuccess ? 'success' : 'error');
                element.innerHTML = '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
            }
        </script>
    </body>
    </html>
  `);
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 Fashion Creative Agent running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🎨 Web interface: http://localhost:${PORT}`);
  console.log(`📝 API docs: http://localhost:${PORT}/api/generate-creative`);
});

// Set server timeout
server.timeout = 120000; // 2 minutes
server.keepAliveTimeout = 65000; // 65 seconds
server.headersTimeout = 66000; // 66 seconds

export default app;
