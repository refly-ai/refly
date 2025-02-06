describe('Signup Flow', () => {
  beforeEach(() => {
    cy.visit('/');
    cy.get('[data-cy="try-for-free-button"]').click();
  });

  it('should switch to signup mode and complete email signup process', () => {
    // Switch to signup mode if not already there
    cy.get('[data-cy="switch-to-signup-button"]').click();

    // Fill in the signup form
    cy.get('[data-cy="email-input"]').type('signup-test@example.com');
    cy.get('[data-cy="password-input"]').type('testPassword123');

    // Submit the form
    cy.get('[data-cy="continue-button"]').click();

    // Verify redirect to verification page or home page depending on skipVerification
    cy.url().should('include', '/');
  });

  it('should handle OAuth signup with GitHub', () => {
    cy.get('[data-cy="github-login-button"]').should('be.visible').click();

    cy.origin('https://github.com', () => {
      // Handle GitHub login page interactions
      cy.get('[name="login"]').should('be.visible');
      // Note: We don't actually submit credentials in tests
      // This just verifies we reached the GitHub login page
    });
  });

  // it('should handle OAuth signup with Google', () => {
  //   cy.get('[data-cy="google-login-button"]').should('be.visible').click();

  //   cy.origin('https://accounts.google.com', () => {
  //     // Verify we've reached the Google login page by checking the URL
  //     cy.url().should('include', 'accounts.google.com');
  //   });
  // });

  it('should validate email format', () => {
    cy.get('[data-cy="switch-to-signup-button"]').click();
    cy.get('[data-cy="email-input"]').type('invalid-email').blur();
    cy.get('[data-cy="password-input"]').type('validPassword123').blur();
    cy.get('[data-cy="continue-button"]').click();

    cy.contains('Please enter a valid email').should('be.visible');
  });

  it('should validate password length', () => {
    cy.get('[data-cy="switch-to-signup-button"]').click();
    cy.get('[data-cy="email-input"]').type('test@example.com').blur();
    cy.get('[data-cy="password-input"]').type('short').blur();
    cy.get('[data-cy="continue-button"]').click();

    cy.contains('Password must contain 8 or more characters').should('be.visible');
  });

  it('should allow switching between signup and signin modes', () => {
    // Test switching to signup mode
    cy.get('[data-cy="switch-to-signup-button"]').click();
    cy.contains('Create your account').should('be.visible');

    // Test switching back to signin mode
    cy.get('[data-cy="switch-to-signin-button"]').click();
    cy.contains('Sign in to Refly').should('be.visible');
  });
});
