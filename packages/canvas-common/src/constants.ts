export const SPACING = {
  X: 400, // Keep original X spacing
  Y: 30, // Fixed vertical spacing between nodes
  INITIAL_X: 100,
  INITIAL_Y: 300,
};

// Max number of transactions in a state
// If the number of transactions is greater than this threshold, a new version should be created
export const MAX_STATE_TX_COUNT = 100;

// Max version age (1 hour) in milliseconds
// If the last transaction is older than this threshold, a new version should be created
export const MAX_VERSION_AGE = 1000 * 60 * 60;

export const CONTEXT_FILTER_NODE_TYPES = ['skill', 'group', 'start', 'mediaSkill'];
