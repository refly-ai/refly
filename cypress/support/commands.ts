/// <reference types="cypress" />
// ***********************************************
// This example commands.ts shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add('login', (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add('dismiss', { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })
//
// declare global {
//   namespace Cypress {
//     interface Chainable {
//       login(email: string, password: string): Chainable<void>
//       drag(subject: string, options?: Partial<TypeOptions>): Chainable<Element>
//       dismiss(subject: string, options?: Partial<TypeOptions>): Chainable<Element>
//       visit(originalFn: CommandOriginalFn, url: string, options: Partial<VisitOptions>): Chainable<Element>
//     }
//   }
// }

declare namespace Cypress {
  interface Chainable {
    /**
     * Execute SQL query through Docker container
     * @param query - SQL query to execute
     * @example
     * cy.execSQL('SELECT * FROM users')
     */
    execSQL(query: string): Chainable<string>;
  }
}

Cypress.Commands.add('execSQL', (query: string) => {
  // Write query to temp file first to avoid shell escaping issues
  const tempFile = '/tmp/cypress-sql-query.sql';
  cy.writeFile(tempFile, query);

  const command = `docker exec -i refly_db psql -tA '${Cypress.env('databaseUrl')}' < ${tempFile}`;

  cy.log(`Executing SQL command: ${command}`);

  cy.exec(command).then((result) => {
    cy.log(`SQL execution result: ${result.stdout}`);
  });
});

// Intercept all requests to api.github.com
beforeEach(() => {
  cy.intercept('GET', 'https://api.github.com/**', {
    statusCode: 200,
    body: {
      // Provide mock data that matches the GitHub API response structure
      // you can customize this based on your needs
      stargazers_count: 1000,
      forks_count: 500,
      subscribers_count: 100,
    },
  }).as('githubApi');
});
