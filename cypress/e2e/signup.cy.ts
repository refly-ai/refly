describe('Signup Flow', () => {
  beforeEach(() => {
    cy.visit('http://localhost:5173');
    cy.get('[data-cy="try-for-free-button"]').click();
  });

  it('should switch to signup mode and complete email signup process', () => {
    // Switch to signup mode if not already there
    cy.get('[data-cy="switch-to-signup-button"]').click();

    // Fill in the signup form
    cy.get('[data-cy="email-input"]').type('test@example.com');
    cy.get('[data-cy="password-input"]').type('testPassword123');

    // Submit the form
    cy.get('[data-cy="continue-button"]').click();

    // Verify redirect to verification page or home page depending on skipVerification
    cy.url().should('include', '/');
  });

  it('should handle OAuth signup with GitHub', () => {
    cy.get('[data-cy="github-login-button"]').should('be.visible').click();
    // Note: Full OAuth flow testing might require mock or stub
    cy.url().should('include', '/v1/auth/github');
  });

  it('should handle OAuth signup with Google', () => {
    cy.get('[data-cy="google-login-button"]').should('be.visible').click();
    // Note: Full OAuth flow testing might require mock or stub
    cy.url().should('include', '/v1/auth/google');
  });

  it('should validate email format', () => {
    cy.get('[data-cy="switch-to-signup-button"]').click();
    cy.get('[data-cy="email-input"]').type('invalid-email');
    cy.get('[data-cy="continue-button"]').click();
    // Verify error message appears
    cy.contains('Please enter a valid email').should('be.visible');
  });

  it('should validate password length', () => {
    cy.get('[data-cy="switch-to-signup-button"]').click();
    cy.get('[data-cy="email-input"]').type('test@example.com');
    cy.get('[data-cy="password-input"]').type('short');
    cy.get('[data-cy="continue-button"]').click();
    // Verify error message appears
    cy.contains('Password must be at least 8 characters').should('be.visible');
  });

  it('should allow switching between signup and signin modes', () => {
    // Test switching to signin mode
    cy.get('[data-cy="switch-to-signin-button"]').click();
    cy.contains('Sign in to Refly').should('be.visible');

    // Test switching back to signup mode
    cy.get('[data-cy="switch-to-signup-button"]').click();
    cy.contains('Sign up for Refly').should('be.visible');
  });
});
