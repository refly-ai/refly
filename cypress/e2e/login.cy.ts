describe('Login Flow', () => {
  before(() => {
    cy.fixture('users-setup.sql').then((sql) => {
      cy.execSQL(sql);
    });
  });

  after(() => {
    cy.fixture('users-cleanup.sql').then((sql) => {
      cy.execSQL(sql);
    });
  });

  beforeEach(() => {
    cy.visit('/');
    cy.get('[data-cy="try-for-free-button"]').click();
  });

  it('should successfully login with valid credentials', () => {
    // Fill in the login form
    cy.get('[data-cy="email-input"]').type('alice@example.com');
    cy.get('[data-cy="password-input"]').type('testPassword123');

    // Submit the form
    cy.get('[data-cy="continue-button"]').click();

    // Verify successful login
    cy.location('pathname').should('eq', '/canvas/empty');
    cy.get('[data-cy="settings-menu-item"]').should('be.visible');
    cy.getCookie('_rf_uid').should('exist');
    cy.getCookie('_rf_access').should('exist');
    cy.getCookie('_rf_refresh').should('exist');
  });

  it('should show error with invalid password', () => {
    // Fill in the login form with wrong password
    cy.get('[data-cy="email-input"]').type('alice@example.com');
    cy.get('[data-cy="password-input"]').type('wrongpassword');

    // Submit the form
    cy.get('[data-cy="continue-button"]').click();

    // Verify error message
    cy.contains('Password incorrect').should('be.visible');
  });

  it('should show error with non-existent email', () => {
    // Fill in the login form with non-existent email
    cy.get('[data-cy="email-input"]').type('nonexistent@example.com');
    cy.get('[data-cy="password-input"]').type('testPassword123');

    // Submit the form
    cy.get('[data-cy="continue-button"]').click();

    // Verify error message
    cy.contains('Account not found').should('be.visible');
  });

  it('should validate email format', () => {
    // Try submitting with invalid email format
    cy.get('[data-cy="email-input"]').type('invalid-email');
    cy.get('[data-cy="password-input"]').type('testPassword123');
    cy.get('[data-cy="continue-button"]').click();

    // Verify validation message
    cy.contains('Please enter a valid email').should('be.visible');
  });
});
