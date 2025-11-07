import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Generate test CSV data for evaluation
 */

// Create test-data directory
const testDataDir = path.join(__dirname, 'test-data');
if (!fs.existsSync(testDataDir)) {
  fs.mkdirSync(testDataDir, { recursive: true });
}

/**
 * Generate sales.csv
 */
function generateSalesData() {
  const products = [
    'Laptop',
    'Phone',
    'Tablet',
    'Monitor',
    'Keyboard',
    'Mouse',
    'Headphones',
    'Webcam',
    'Speaker',
    'Charger',
  ];
  const categories = ['Electronics', 'Accessories', 'Computer', 'Mobile'];
  const regions = ['North', 'South', 'East', 'West'];

  const rows = ['date,product_id,product_name,category,quantity,price,total,region'];

  const startDate = new Date('2023-01-01');

  for (let i = 0; i < 1000; i++) {
    const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000 * (Math.random() * 2));
    const dateStr = date.toISOString().split('T')[0];
    const productId = Math.floor(Math.random() * products.length);
    const product = products[productId];
    const category = categories[Math.floor(Math.random() * categories.length)];
    const quantity = Math.floor(Math.random() * 10) + 1;
    const price = Math.round((Math.random() * 1000 + 100) * 100) / 100;
    const total = Math.round(quantity * price * 100) / 100;
    const region = regions[Math.floor(Math.random() * regions.length)];

    rows.push(
      `${dateStr},${productId},${product},${category},${quantity},${price},${total},${region}`,
    );
  }

  fs.writeFileSync(path.join(testDataDir, 'sales.csv'), rows.join('\n'));

  console.log('✅ Generated sales.csv (1000 rows)');
}

/**
 * Generate customers.csv
 */
function generateCustomersData() {
  const names = [
    'Alice',
    'Bob',
    'Charlie',
    'David',
    'Emma',
    'Frank',
    'Grace',
    'Henry',
    'Ivy',
    'Jack',
  ];
  const cities = [
    'Beijing',
    'Shanghai',
    'Guangzhou',
    'Shenzhen',
    'Hangzhou',
    'Chengdu',
    'Wuhan',
    'Xian',
    'Nanjing',
    'Tianjin',
  ];

  const rows = ['customer_id,name,age,gender,city,signup_date,total_spent'];

  for (let i = 0; i < 500; i++) {
    const customerId = i + 1;
    const name = names[Math.floor(Math.random() * names.length)] + i;
    const age = Math.floor(Math.random() * 50) + 18;
    const gender = Math.random() > 0.5 ? 'M' : 'F';
    const city = cities[Math.floor(Math.random() * cities.length)];
    const signupDate = new Date(
      2020 + Math.floor(Math.random() * 4),
      Math.floor(Math.random() * 12),
      Math.floor(Math.random() * 28) + 1,
    )
      .toISOString()
      .split('T')[0];
    const totalSpent = Math.round((Math.random() * 10000 + 500) * 100) / 100;

    rows.push(`${customerId},${name},${age},${gender},${city},${signupDate},${totalSpent}`);
  }

  fs.writeFileSync(path.join(testDataDir, 'customers.csv'), rows.join('\n'));

  console.log('✅ Generated customers.csv (500 rows)');
}

/**
 * Generate inventory.csv
 */
function generateInventoryData() {
  const warehouses = ['WH-North', 'WH-South', 'WH-East', 'WH-West'];

  const rows = ['product_id,warehouse,stock_level,reorder_point,last_updated'];

  for (let i = 0; i < 200; i++) {
    const productId = Math.floor(i / 4);
    const warehouse = warehouses[i % 4];
    const stockLevel = Math.floor(Math.random() * 1000);
    const reorderPoint = Math.floor(Math.random() * 200) + 50;
    const lastUpdated = new Date(
      2024,
      Math.floor(Math.random() * 11),
      Math.floor(Math.random() * 28) + 1,
    )
      .toISOString()
      .split('T')[0];

    rows.push(`${productId},${warehouse},${stockLevel},${reorderPoint},${lastUpdated}`);
  }

  fs.writeFileSync(path.join(testDataDir, 'inventory.csv'), rows.join('\n'));

  console.log('✅ Generated inventory.csv (200 rows)');
}

/**
 * Generate timeseries.csv
 */
function generateTimeseriesData() {
  const rows = ['date,value,category'];

  const startDate = new Date('2023-01-01');
  const categories = ['A', 'B', 'C'];

  for (let i = 0; i < 365; i++) {
    const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split('T')[0];

    for (const category of categories) {
      // Add trend + seasonality + noise
      const trend = i * 0.5;
      const seasonality = 50 * Math.sin((i * 2 * Math.PI) / 365);
      const noise = (Math.random() - 0.5) * 20;
      const value = Math.round((100 + trend + seasonality + noise) * 100) / 100;

      rows.push(`${dateStr},${value},${category}`);
    }
  }

  fs.writeFileSync(path.join(testDataDir, 'timeseries.csv'), rows.join('\n'));

  console.log('✅ Generated timeseries.csv (1095 rows)');
}

/**
 * Generate reviews.csv
 */
function generateReviewsData() {
  const reviewTexts = [
    'Great product, highly recommend!',
    'Good quality but a bit expensive',
    'Not what I expected, disappointed',
    'Excellent service and fast delivery',
    'Average product, nothing special',
    'Terrible experience, would not buy again',
    'Best purchase I made this year',
    'Decent value for money',
    'Poor quality, broke after a week',
    'Amazing features, love it!',
  ];

  const rows = ['review_id,product_id,rating,review_text,date'];

  const startDate = new Date('2023-01-01');

  for (let i = 0; i < 1000; i++) {
    const reviewId = i + 1;
    const productId = Math.floor(Math.random() * 50);
    const rating = Math.floor(Math.random() * 5) + 1;
    const reviewText = reviewTexts[Math.floor(Math.random() * reviewTexts.length)];
    const date = new Date(startDate.getTime() + Math.random() * 365 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    rows.push(`${reviewId},${productId},${rating},"${reviewText}",${date}`);
  }

  fs.writeFileSync(path.join(testDataDir, 'reviews.csv'), rows.join('\n'));

  console.log('✅ Generated reviews.csv (1000 rows)');
}

/**
 * Generate data.csv (simple test file)
 */
function generateSimpleData() {
  const rows = ['id,name,value,category'];

  for (let i = 0; i < 100; i++) {
    const id = i + 1;
    const name = `Item_${i}`;
    const value = Math.round(Math.random() * 1000 * 100) / 100;
    const category = ['A', 'B', 'C'][Math.floor(Math.random() * 3)];

    rows.push(`${id},${name},${value},${category}`);
  }

  fs.writeFileSync(path.join(testDataDir, 'data.csv'), rows.join('\n'));

  console.log('✅ Generated data.csv (100 rows)');
}

/**
 * Generate housing.csv (for ML tasks)
 */
function generateHousingData() {
  const rows = ['id,area,bedrooms,bathrooms,location_score,age,price'];

  for (let i = 0; i < 500; i++) {
    const id = i + 1;
    const area = Math.floor(Math.random() * 200) + 50; // 50-250 sqm
    const bedrooms = Math.floor(Math.random() * 5) + 1;
    const bathrooms = Math.floor(Math.random() * 3) + 1;
    const locationScore = Math.round(Math.random() * 10 * 10) / 10; // 0-10
    const age = Math.floor(Math.random() * 30); // 0-30 years

    // Price formula with some randomness
    const basePrice = area * 5000 + bedrooms * 100000 + bathrooms * 50000;
    const locationFactor = locationScore * 50000;
    const ageFactor = -age * 2000;
    const noise = (Math.random() - 0.5) * 100000;
    const price = Math.round((basePrice + locationFactor + ageFactor + noise) / 1000) * 1000;

    rows.push(`${id},${area},${bedrooms},${bathrooms},${locationScore},${age},${price}`);
  }

  fs.writeFileSync(path.join(testDataDir, 'housing.csv'), rows.join('\n'));

  console.log('✅ Generated housing.csv (500 rows)');
}

/**
 * Generate README for test data
 */
function generateReadme() {
  const content = `# Test Data for Sandbox Agent Evaluation

This directory contains test datasets for evaluating the Sandbox Agent.

## Available Datasets

### 1. sales.csv (1000 rows)
Sales transaction data with columns:
- date: Transaction date
- product_id: Product identifier
- product_name: Product name
- category: Product category
- quantity: Quantity sold
- price: Unit price
- total: Total amount
- region: Sales region

### 2. customers.csv (500 rows)
Customer information with columns:
- customer_id: Unique customer ID
- name: Customer name
- age: Customer age
- gender: M/F
- city: City of residence
- signup_date: Account creation date
- total_spent: Lifetime spending

### 3. inventory.csv (200 rows)
Inventory data with columns:
- product_id: Product identifier
- warehouse: Warehouse location
- stock_level: Current stock
- reorder_point: Reorder threshold
- last_updated: Last update date

### 4. timeseries.csv (1095 rows)
Time series data with trend and seasonality:
- date: Date
- value: Metric value
- category: Category A/B/C

### 5. reviews.csv (1000 rows)
Product reviews with columns:
- review_id: Review identifier
- product_id: Product being reviewed
- rating: 1-5 star rating
- review_text: Review content
- date: Review date

### 6. data.csv (100 rows)
Simple test data:
- id: Row identifier
- name: Item name
- value: Numeric value
- category: Category A/B/C

### 7. housing.csv (500 rows)
Housing data for ML tasks:
- id: Property ID
- area: Area in sqm
- bedrooms: Number of bedrooms
- bathrooms: Number of bathrooms
- location_score: Location rating (0-10)
- age: Property age in years
- price: Property price

## Usage

These datasets are used by the evaluation runner to test various capabilities:
- Data analysis
- Visualization
- File processing
- Machine learning
- Statistical analysis

## Regeneration

To regenerate all test data:

\`\`\`bash
npx tsx generate-test-data.ts
\`\`\`

---
Generated: ${new Date().toISOString()}
`;

  fs.writeFileSync(path.join(testDataDir, 'README.md'), content);

  console.log('✅ Generated README.md');
}

/**
 * Main function
 */
function main() {
  console.log('🚀 Generating test data for Sandbox Agent evaluation...\n');

  generateSalesData();
  generateCustomersData();
  generateInventoryData();
  generateTimeseriesData();
  generateReviewsData();
  generateSimpleData();
  generateHousingData();
  generateReadme();

  console.log('\n✨ All test data generated successfully!');
  console.log(`📁 Location: ${testDataDir}`);
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { main as generateTestData };
