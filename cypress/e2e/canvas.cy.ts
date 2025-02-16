describe('Canvas Flow', () => {
  before(() => {
    cy.fixture('users-setup.sql').then((sql) => {
      cy.execSQL(sql);
    });
    cy.fixture('models-setup.sql').then((sql) => {
      cy.execSQL(sql);
    });
  });

  after(() => {
    cy.fixture('users-cleanup.sql').then((sql) => {
      cy.execSQL(sql);
    });
  });

  beforeEach(() => {
    cy.login('bob@example.com', 'testPassword123');
  });

  it('should create and interact with canvas', () => {
    // Create new canvas from empty state
    cy.get('[data-cy="empty-canvas-create-button"]').should('be.visible').click();

    // Wait for canvas to be created and loaded
    cy.location('pathname').should('match', /\/canvas\/[a-zA-Z0-9-]+$/);

    // Verify canvas toolbar is visible
    cy.get('[data-cy="canvas-toolbar"]').should('be.visible');
    cy.get('[data-cy="canvas-title-edit"]').should('be.visible').contains('Untitled');

    // Create a new document from canvas hint text
    // cy.get('[data-cy="canvas-create-document-button"]').should('be.visible').click();

    cy.get('[data-cy="launchpad-chat-panel"]').should('be.visible');
    cy.get('[data-cy="chat-input"]')
      .should('be.visible')
      .type('Say this is a test')
      .type('{enter}');

    // Wait for the response node to be visible first
    cy.get('[data-cy="skill-response-node"]').should('be.visible');

    // Then wait for the input to be visible and have the correct value
    cy.get('[data-cy="skill-response-node-header-input"]')
      .should('be.visible')
      .should('have.value', 'Say this is a test');

    // Verify the response is displayed in the chat
    cy.get('[data-cy="skill-response-node"]').should('be.visible').contains('This is a test');
  });
});
