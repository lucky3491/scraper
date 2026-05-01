# Programming Assessment: Web Scraper Development with TypeScript and Playwright

## Objective:

To assess your ability to design and implement a functional web scraper using **TypeScript** and **Playwright**, your code organization, and your ability to work with external data sources.

## Instructions:

1. You are tasked with creating a web scraper that fetches product details for a list of SKUs from **Amazon** and **Walmart**.
2. The scraper should extract the following details for each product:
   - **Price**
   - **Title**
   - **Description**
   - **Number of Reviews**
3. Save the extracted information into a **CSV file** named `product_data.csv`.

## Requirements:

- **Input:**  
  A list of product SKUs in a JSON file named `skus.json`. The structure of the file is:
  \`\`\`json
  {
  "skus": [{"Type": "Amazon", "SKU": "B0CT4BB651"},{"Type": "Walmart", "SKU": "5326288985"}, {"Type": "Amazon", "SKU": "B01LR5S6HK"}]
  }
  \`\`\`
- **Output:**  
  A CSV file (`product_data.csv`) with the following columns:

  - SKU
  - Source (Amazon/Walmart)
  - Title
  - Description
  - Price
  - Number of Reviews and rating

- **Technologies to Use:**
  - TypeScript
  - Playwright

## Tasks:

1. **Setup Playwright:**  
   Initialize Playwright and configure it to work with Amazon and Walmart product pages.
2. **Scraper Functionality:**
   - Fetch product details for each SKU from Amazon and Walmart.
   - Handle dynamic content (ensure Playwright waits for necessary elements to load).
   - Handle potential CAPTCHA challenges or anti-bot measures.
3. **Error Handling:**

   - Handle cases where a product is not found on a site.
   - Log any errors or failed fetches in a `errors.log` file.

4. **Data Storage:**

   - Use a CSV library (e.g., `papaparse` or `csv-writer`) to save the extracted data.
   - Ensure the data is appended correctly for each SKU and source.

5. **Documentation:**
   - Include a **README.md** with:
     - How to install and run the scraper.
     - Assumptions made during development.
     - Limitations of the solution.

## Evaluation Criteria:

- **Code Quality:**  
  Is the code modular, readable, and follows best practices for TypeScript?
- **Functionality:**  
  Does the scraper successfully fetch and save the required data?

- **Error Handling:**  
  Are exceptions handled gracefully, and are errors logged appropriately?

- **Documentation:**  
  Is the README clear and helpful for someone setting up the project?

## Bonus Points:

- Implementing retries for failed fetches.
- Managing concurrent scraping to improve efficiency.
- Writing unit tests for key functions.

---

## Deliverables:

Submit your solution as a GitHub repository with the following structure:
\`\`\`
/project-root
|-- /src
| |-- scraper.ts
| |-- utils.ts
|-- skus.json
|-- package.json
|-- tsconfig.json
|-- product_data.csv
|-- errors.log
|-- README.md
\`\`\`

---

## Timeline:

You have **48 hours** to complete the assessment and submit your solution.

Good luck! 🚀
